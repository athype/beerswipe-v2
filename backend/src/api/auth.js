import express from "express";
import { env } from "../env.js";
import { authenticateRequest, generateToken } from "../middleware/auth.js";
import { User } from "../models/index.js";
import { loginRequestSchema } from "../validation/contracts.js";

const router = express.Router();

// Admin login
/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Log in with username and password
 *     description: >
 *       Validates credentials and sets the `authToken` httpOnly cookie on the
 *       response. Users without a password (members) cannot log in.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/LoginRequest"
 *           example:
 *             username: admin
 *             password: secret
 *     responses:
 *       200:
 *         description: Login successful — sets the authToken cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 user: { $ref: "#/components/schemas/AuthUser" }
 *       400:
 *         description: Username and password are required
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       401:
 *         description: Invalid credentials or unauthorized user
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
router.post("/login", async (req, res) => {
  try {
    const parsedBody = loginRequestSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: "Username and password required" });
    }

    const { username, password } = parsedBody.data;

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

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Get the current session's user
 *     tags: [Auth]
 *     security:
 *       - authToken: []
 *     responses:
 *       200:
 *         description: The authenticated user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user: { $ref: "#/components/schemas/AuthUser" }
 *       401:
 *         description: Missing or invalid authToken cookie
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
router.get("/me", authenticateRequest, async (req, res) => {
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

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Log out — clears the authToken cookie
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Message"
 */
router.post("/logout", (req, res) => {
  res.clearCookie("authToken", {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
  });
  res.json({ message: "Logout successful" });
});

/**
 * @openapi
 * /auth/create-admin:
 *   post:
 *     summary: Create the first admin user (development only)
 *     description: >
 *       Refused with 403 when NODE_ENV is "production". Used to bootstrap an
 *       admin account in a fresh database.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username: { type: string }
 *               password: { type: string, format: password }
 *             required: [username, password]
 *     responses:
 *       201:
 *         description: Admin created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     username: { type: string }
 *                     userType: { type: string }
 *       400:
 *         description: Username and password are required, or username taken
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       403:
 *         description: Admin creation is not allowed in production
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
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
