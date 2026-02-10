import bcrypt from "bcryptjs";
import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

const User = sequelize.define("User", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  username: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 50],
    },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true, // null for members/non-members who cannot log in
    validate: {
      len: [6, 255],
    },
  },
  credits: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0,
    },
  },
  dateOfBirth: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  userType: {
    type: DataTypes.ENUM("admin", "seller", "member", "non-member"),
    allowNull: false,
    defaultValue: "member",
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        user.password = await bcrypt.hash(user.password, 10);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed("password") && user.password) {
        user.password = await bcrypt.hash(user.password, 10);
      }
    },
  },
});

// Instance methods
User.prototype.validatePassword = async function (password) {
  if (!this.password)
    return false;
  return bcrypt.compare(password, this.password);
};

User.prototype.canLogin = function () {
  return (this.userType === "admin" || this.userType === "seller") && this.password !== null;
};

User.prototype.addCredits = function (amount) {
  // Only allow adding credits in blocks of 10
  if (amount % 10 !== 0) {
    throw new Error("Credits can only be added in blocks of 10");
  }
  this.credits += amount;
  return this.save();
};

User.prototype.deductCredits = function (amount) {
  if (this.credits < amount) {
    throw new Error("Insufficient credits");
  }
  this.credits -= amount;
  return this.save();
};

// Bypass methods for undo operations - these don't enforce the 10-credit rule
User.prototype.addCreditsUnchecked = function (amount) {
  this.credits += amount;
  return this.save();
};

User.prototype.deductCreditsUnchecked = function (amount) {
  if (this.credits < amount) {
    throw new Error("Insufficient credits");
  }
  this.credits -= amount;
  return this.save();
};

export default User;
