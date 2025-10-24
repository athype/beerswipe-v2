import express from "express";
import { Op } from "sequelize";
import { authenticateToken, requireAdmin, generateToken } from "../middleware/auth.js";
import { User } from "../models/index.js";

const router = express.Router();

// Get all admin users (admin only)
router.get("/", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const admins = await User.findAll({
      where: {
        userType: "admin",
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
    if (username) updates.username = username;
    if (password) updates.password = password;

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

// Create new admin (admin only)
router.post("/", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
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
      admin: {
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

// Update another admin (admin only)
router.put("/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, password } = req.body;
    const adminId = req.params.id;

    if (Number.parseInt(adminId, 10) === req.user.id) {
      return res.status(400).json({ error: "Use /profile endpoint to update your own account" });
    }

    const admin = await User.findOne({
      where: {
        id: adminId,
        userType: "admin",
      },
    });

    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
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

    const updates = {};
    if (username) updates.username = username;
    if (password) updates.password = password;

    await admin.update(updates);

    res.json({
      message: "Admin updated successfully",
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

// Deactivate admin (admin only)
router.delete("/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const adminId = req.params.id;

    if (Number.parseInt(adminId, 10) === req.user.id) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    const admin = await User.findOne({
      where: {
        id: adminId,
        userType: "admin",
      },
    });

    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    const activeAdminCount = await User.count({
      where: {
        userType: "admin",
        isActive: true,
      },
    });

    if (activeAdminCount <= 1) {
      return res.status(400).json({ error: "Cannot delete the last active admin" });
    }

    await admin.update({ isActive: false });

    res.json({ message: "Admin deactivated successfully" });
  }
  catch (error) {
    console.error("Delete admin error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
