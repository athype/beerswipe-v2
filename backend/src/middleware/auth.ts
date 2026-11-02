import type { UserType } from "@beerswipe/types";
import type { NextFunction, Request, Response } from "express";
import type { Model } from "sequelize";
import type { ApiKeyAttributes } from "../models/ApiKey.ts";
import jwt from "jsonwebtoken";
import { Op } from "sequelize";
import { env } from "../env.ts";
import { ApiKey, User } from "../models/index.ts";
import { apiKeyPrefix, hashApiKey } from "../utils/apiKeyCrypto.ts";

type TokenUser = {
  id: number;
  username: string;
  userType: UserType;
};

// ApiKey is a data-only define(), so its instance type is Model<any, any>.
// Read the row through the attribute interface the model exports.
type ApiKeyInstance = Model<ApiKeyAttributes, ApiKeyAttributes> & ApiKeyAttributes;

export async function authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Try to get token from cookie first (most secure)
  let token = req.cookies?.authToken;

  // Fallback to Authorization header for backward compatibility
  if (!token) {
    const authHeader = req.headers.authorization;
    token = authHeader && authHeader.split(" ")[1];
  }

  if (!token) {
    res.status(401).json({ error: "Access token required" });
    return;
  }

  try {
    // jwt.verify returns either the payload object or a plain string payload.
    // A string cannot carry an id, so it takes the same path as an unknown user.
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded === "string") {
      res.status(401).json({ error: "Invalid token or user inactive" });
      return;
    }

    const user = await User.findByPk(decoded.id);

    if (!user || !user.isActive) {
      res.status(401).json({ error: "Invalid token or user inactive" });
      return;
    }

    req.user = user;
    next();
  }
  catch {
    res.status(403).json({ error: "Invalid token" });
  }
}

// lastUsedAt is throttled to one write per minute per key so high-frequency
// clients (e.g. a kiosk selling) don't write on every request.
const LAST_USED_THROTTLE_MS = 60 * 1000;

export async function authenticateApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const apiKeyHeader = req.headers["x-api-key"];
    if (!apiKeyHeader || Array.isArray(apiKeyHeader)) {
      res.status(401).json({ error: "Invalid API key" });
      return;
    }

    const apiKey = (await ApiKey.findOne({
      where: {
        prefix: apiKeyPrefix(apiKeyHeader),
        keyHash: hashApiKey(apiKeyHeader),
      },
    })) as ApiKeyInstance | null;

    if (!apiKey || apiKey.isRevoked || (apiKey.expiresAt && apiKey.expiresAt.getTime() <= Date.now())) {
      res.status(401).json({ error: "Invalid API key" });
      return;
    }

    const user = await User.findByPk(apiKey.createdBy);
    if (!user || !user.isActive) {
      res.status(401).json({ error: "Invalid API key" });
      return;
    }

    // The key acts as the admin who created it, restricted to the key's scope.
    // Overlay userType on this per-request instance so inline checks (e.g. the
    // seller undo window in sales.js) behave consistently. Routes only read
    // req.user fields; nothing persists this change.
    user.userType = apiKey.scope;
    req.user = user;
    req.apiKey = {
      id: apiKey.id,
      name: apiKey.name,
      scope: apiKey.scope,
      prefix: apiKey.prefix,
      createdBy: apiKey.createdBy,
    };

    // Throttled touch: only write lastUsedAt when it is null or older than 60s.
    const throttleBefore = new Date(Date.now() - LAST_USED_THROTTLE_MS);
    if (!apiKey.lastUsedAt || apiKey.lastUsedAt.getTime() < throttleBefore.getTime()) {
      try {
        await ApiKey.update(
          { lastUsedAt: new Date() },
          {
            where: {
              id: apiKey.id,
              [Op.or]: [
                { lastUsedAt: null },
                { lastUsedAt: { [Op.lt]: throttleBefore } },
              ],
            },
          },
        );
      }
      catch (e) {
        console.error("API key lastUsedAt update error:", e);
      }
    }

    next();
  }
  catch (error) {
    console.error("API key auth error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Combined guard: cookie/Bearer JWT if one is presented (today's behavior,
// including 403 for a presented-but-invalid JWT), else X-API-Key, else 401.
export function authenticateRequest(req: Request, res: Response, next: NextFunction): Promise<void> | void {
  const hasAuthorizationHeader = typeof req.headers.authorization === "string" && req.headers.authorization.length > 0;
  if (req.cookies?.authToken || hasAuthorizationHeader) {
    return authenticateToken(req, res, next);
  }
  if (req.headers["x-api-key"]) {
    return authenticateApiKey(req, res, next);
  }
  res.status(401).json({ error: "Access token required" });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.userType !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

export function requireAdminOrSeller(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || (req.user.userType !== "admin" && req.user.userType !== "seller")) {
    res.status(403).json({ error: "Admin or seller access required" });
    return;
  }
  next();
}

export function generateToken(user: TokenUser): string {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      userType: user.userType,
    },
    env.JWT_SECRET,
    { expiresIn: "24h" },
  );
}
