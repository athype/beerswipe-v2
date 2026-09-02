import express from "express";
import { Op } from "sequelize";
import { authenticateToken, generateToken, requireAdmin } from "../middleware/auth.js";
import { User } from "../models/index.js";

const router = express.Router();

// Get all admin users (admin only)
/**
 * @openapi
 * /admin:
 *   get:
 *     summary: List active admins and sellers
 *     tags: [Admin]
 *     security:
 *       - authToken: []
 *     responses:
 *       200:
 *         description: Active admin/seller accounts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 admins:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       username: { type: string }
 *                       userType: { type: string, enum: [admin, seller] }
 *                       createdAt: { type: string, format: date-time }
 *                       updatedAt: { type: string, format: date-time }
 *       401:
 *         description: Missing or invalid authToken cookie
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
router.get("/", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const admins = await User.findAll({
      where: {
        userType: { [Op.in]: ["admin", "seller"] },
        isActive: true,
      },
      attributes: ["id", "username", "userType", "createdAt", "updatedAt"],
      order: [["username", "ASC"]],
    });

    res.json({ admins });
  }
  catch (error) {
    console.error("Get admins error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get current admin profile (admin only)
/**
 * @openapi
 * /admin/profile:
 *   get:
 *     summary: Get the current admin's profile
 *     tags: [Admin]
 *     security:
 *       - authToken: []
 *     responses:
 *       200:
 *         description: The current admin
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 admin:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     username: { type: string }
 *                     userType: { type: string }
 *                     createdAt: { type: string, format: date-time }
 *                     updatedAt: { type: string, format: date-time }
 *       401:
 *         description: Missing or invalid authToken cookie
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
router.get("/profile", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const admin = await User.findByPk(req.user.id, {
      attributes: ["id", "username", "userType", "createdAt", "updatedAt"],
    });

    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    res.json({ admin });
  }
  catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update current admin profile (admin only)
/**
 * @openapi
 * /admin/profile:
 *   put:
 *     summary: Update the current admin's own profile
 *     description: >
 *       Changing the username also returns a fresh JWT `token` — the old one
 *       encodes the previous username and should be replaced (the authToken
 *       cookie is not rotated automatically).
 *     tags: [Admin]
 *     security:
 *       - authToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username: { type: string }
 *               password: { type: string, format: password, minLength: 6 }
 *               currentPassword:
 *                 type: string
 *                 format: password
 *                 description: Required when changing the password
 *     responses:
 *       200:
 *         description: Profile updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 admin:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     username: { type: string }
 *                     userType: { type: string }
 *                 token:
 *                   type: string
 *                   nullable: true
 *                   description: Fresh JWT when the username changed
 *       400:
 *         description: Current password missing, password too short, or username taken
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       401:
 *         description: Current password is incorrect
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
router.put("/profile", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, password, currentPassword } = req.body;

    const admin = await User.findByPk(req.user.id);
    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    if (password) {
      if (!currentPassword) {
        return res.status(400).json({ error: "Current password required to change password" });
      }

      const isValidPassword = await admin.validatePassword(currentPassword);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }
    }

    if (username && username !== admin.username) {
      const existingUser = await User.findOne({
        where: {
          username,
          id: { [Op.ne]: admin.id },
        },
      });

      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }
    }

    const updates = {};
    if (username)
      updates.username = username;
    if (password)
      updates.password = password;

    await admin.update(updates);

    const token = username ? generateToken(admin) : undefined;

    res.json({
      message: "Profile updated successfully",
      admin: {
        id: admin.id,
        username: admin.username,
        userType: admin.userType,
      },
      ...(token && { token }),
    });
  }
  catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create new admin or seller (admin only)
/**
 * @openapi
 * /admin:
 *   post:
 *     summary: Create an admin or seller account
 *     tags: [Admin]
 *     security:
 *       - authToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username: { type: string, maxLength: 50 }
 *               password: { type: string, format: password, minLength: 6 }
 *               userType: { type: string, enum: [admin, seller], default: admin }
 *             required: [username, password]
 *     responses:
 *       201:
 *         description: Account created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 admin:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     username: { type: string }
 *                     userType: { type: string }
 *       400:
 *         description: Missing fields, short password, invalid user type, or username taken
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       401:
 *         description: Missing or invalid authToken cookie
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
router.post("/", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, password, userType = "admin" } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    if (!["admin", "seller"].includes(userType)) {
      return res.status(400).json({ error: "Invalid user type. Must be 'admin' or 'seller'" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const user = await User.create({
      username,
      password,
      userType,
    });

    res.status(201).json({
      message: `${userType.charAt(0).toUpperCase() + userType.slice(1)} created successfully`,
      admin: {
        id: user.id,
        username: user.username,
        userType: user.userType,
      },
    });
  }
  catch (error) {
    console.error("Create admin/seller error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update another admin (admin only)
/**
 * @openapi
 * /admin/{id}:
 *   put:
 *     summary: Update another admin or seller
 *     description: Updating your own account is refused — use PUT /admin/profile.
 *     tags: [Admin]
 *     security:
 *       - authToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username: { type: string, maxLength: 50 }
 *               password: { type: string, format: password, minLength: 6 }
 *               userType: { type: string, enum: [admin, seller] }
 *     responses:
 *       200:
 *         description: Account updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 admin:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     username: { type: string }
 *                     userType: { type: string }
 *       400:
 *         description: Self-update refused, username taken, short password, or invalid user type
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       401:
 *         description: Missing or invalid authToken cookie
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       404:
 *         description: Admin or seller not found
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
router.put("/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, password, userType } = req.body;
    const adminId = req.params.id;

    if (Number.parseInt(adminId, 10) === req.user.id) {
      return res.status(400).json({ error: "Use /profile endpoint to update your own account" });
    }

    const admin = await User.findOne({
      where: {
        id: adminId,
        userType: { [Op.in]: ["admin", "seller"] },
      },
    });

    if (!admin) {
      return res.status(404).json({ error: "Admin or seller not found" });
    }

    if (username && username !== admin.username) {
      const existingUser = await User.findOne({
        where: {
          username,
          id: { [Op.ne]: admin.id },
        },
      });

      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }
    }

    if (password && password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    if (userType && !["admin", "seller"].includes(userType)) {
      return res.status(400).json({ error: "Invalid user type. Must be 'admin' or 'seller'" });
    }

    const updates = {};
    if (username)
      updates.username = username;
    if (password)
      updates.password = password;
    if (userType)
      updates.userType = userType;

    await admin.update(updates);

    res.json({
      message: "User updated successfully",
      admin: {
        id: admin.id,
        username: admin.username,
        userType: admin.userType,
      },
    });
  }
  catch (error) {
    console.error("Update admin error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Deactivate admin or seller (admin only)
/**
 * @openapi
 * /admin/{id}:
 *   delete:
 *     summary: Deactivate an admin or seller
 *     description: Soft-deletes (isActive false). Own account and the last active admin are protected.
 *     tags: [Admin]
 *     security:
 *       - authToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Account deactivated
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Message" }
 *       400:
 *         description: Cannot delete your own account or the last active admin
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       401:
 *         description: Missing or invalid authToken cookie
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       404:
 *         description: Admin or seller not found
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
router.delete("/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const adminId = req.params.id;

    if (Number.parseInt(adminId, 10) === req.user.id) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    const admin = await User.findOne({
      where: {
        id: adminId,
        userType: { [Op.in]: ["admin", "seller"] },
      },
    });

    if (!admin) {
      return res.status(404).json({ error: "Admin or seller not found" });
    }

    const activeAdminCount = await User.count({
      where: {
        userType: "admin",
        isActive: true,
      },
    });

    if (admin.userType === "admin" && activeAdminCount <= 1) {
      return res.status(400).json({ error: "Cannot delete the last active admin" });
    }

    await admin.update({ isActive: false });

    res.json({ message: `${admin.userType.charAt(0).toUpperCase() + admin.userType.slice(1)} deactivated successfully` });
  }
  catch (error) {
    console.error("Delete admin/seller error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
