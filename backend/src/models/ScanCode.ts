import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

// Per-user opaque scan code (QR/barcode) resolved by the kiosk. Unlike an API
// key the code is stored in plaintext by design: it must stay re-displayable
// (operator QR pull-up, ADA member page). There is one row per user and
// regenerating overwrites `code` in place, so the old value stops resolving
// immediately.
const ScanCode = sequelize.define("ScanCode", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: {
      model: "Users",
      key: "id",
    },
  },
  code: {
    type: DataTypes.STRING(32),
    allowNull: false,
    unique: true,
  },
});

export default ScanCode;
