import express from "express";
import { authenticateToken, generateToken } from "../middleware/auth.js";
import { User } from "../models/index.js";
import { env } from "../env.js";

const router = express.Router();

// Admin login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    const user = await User.findOne({ where: { username } });

    if (!user || !user.canLogin()) {
      return res.status(401).json({ error: "Invalid credentials or unauthorized user" });
    }

    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = generateToken(user);

    // Set httpOnly cookie for security
    res.cookie("authToken", token, {
      httpOnly: true, // Cannot be accessed by JavaScript (XSS protection)
      secure: env.NODE_ENV === "production", // Only sent over HTTPS in production
      sameSite: "strict", // CSRF protection
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        username: user.username,
        userType: user.userType,
        credits: user.credits,
      },
    });
  }
  catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/me", authenticateToken, async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user.id,
        username: req.user.username,
        userType: req.user.userType,
        credits: req.user.credits,
      },
    });
  }
  catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("authToken", {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
  });
  res.json({ message: "Logout successful" });
});

router.post("/create-admin", async (req, res) => {
  try {
    if (env.NODE_ENV === "production") {
      return res.status(403).json({ error: "Admin creation not allowed in production" });
    }
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const admin = await User.create({
      username,
      password,
      userType: "admin",
    });

    res.status(201).json({
      message: "Admin created successfully",
      user: {
        id: admin.id,
        username: admin.username,
        userType: admin.userType,
      },
    });
  }
  catch (error) {
    console.error("Create admin error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
