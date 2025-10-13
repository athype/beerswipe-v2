import jwt from "jsonwebtoken";
import { env } from "../env.js";
import { User } from "../models/index.js";

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

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

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.userType !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
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
