import jwt from "jsonwebtoken";
import { Op } from "sequelize";
import { env } from "../env.js";
import { ApiKey, User } from "../models/index.js";
import { apiKeyPrefix, hashApiKey } from "../utils/apiKeyCrypto.js";

export async function authenticateToken(req, res, next) {
  // Try to get token from cookie first (most secure)
  let token = req.cookies?.authToken;

  // Fallback to Authorization header for backward compatibility
  if (!token) {
    const authHeader = req.headers.authorization;
    token = authHeader && authHeader.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    const user = await User.findByPk(decoded.id);

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Invalid token or user inactive" });
    }

    req.user = user;
    next();
  }
  catch (error) {
    return res.status(403).json({ error: "Invalid token" });
  }
}

// lastUsedAt is throttled to one write per minute per key so high-frequency
// clients (e.g. a kiosk selling) don't write on every request.
const LAST_USED_THROTTLE_MS = 60 * 1000;

export async function authenticateApiKey(req, res, next) {
  try {
    const apiKeyHeader = req.headers["x-api-key"];
    if (!apiKeyHeader) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    const apiKey = await ApiKey.findOne({
      where: {
        prefix: apiKeyPrefix(apiKeyHeader),
        keyHash: hashApiKey(apiKeyHeader),
      },
    });

    if (!apiKey || apiKey.isRevoked || (apiKey.expiresAt && apiKey.expiresAt.getTime() <= Date.now())) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    const user = await User.findByPk(apiKey.createdBy);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Invalid API key" });
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

    return next();
  }
  catch (error) {
    console.error("API key auth error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// Combined guard: cookie/Bearer JWT if one is presented (today's behavior,
// including 403 for a presented-but-invalid JWT), else X-API-Key, else 401.
export function authenticateRequest(req, res, next) {
  const bearer = req.headers.authorization && req.headers.authorization.split(" ")[1];
  if (req.cookies?.authToken || bearer) {
    return authenticateToken(req, res, next);
  }
  if (req.headers["x-api-key"]) {
    return authenticateApiKey(req, res, next);
  }
  return res.status(401).json({ error: "Access token required" });
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.userType !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

export function requireAdminOrSeller(req, res, next) {
  if (!req.user || (req.user.userType !== "admin" && req.user.userType !== "seller")) {
    return res.status(403).json({ error: "Admin or seller access required" });
  }
  next();
}

export function generateToken(user) {
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
