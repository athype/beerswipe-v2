import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

// Long-lived programmatic credential. Only the SHA-256 digest (keyHash) and a
// 12-char display prefix are stored — the plaintext key is shown once at
// creation and never persisted or logged.
const ApiKey = sequelize.define("ApiKey", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 50],
    },
  },
  keyHash: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true,
  },
  prefix: {
    type: DataTypes.STRING(12),
    allowNull: false,
  },
  scope: {
    type: DataTypes.ENUM("admin", "seller"),
    allowNull: false,
    defaultValue: "admin",
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  isRevoked: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  lastUsedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

export default ApiKey;
