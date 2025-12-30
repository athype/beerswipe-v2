import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

const Passkey = sequelize.define("Passkey", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "Users",
      key: "id",
    },
  },
  credentialId: {
    type: DataTypes.TEXT,
    allowNull: false,
    unique: true,
  },
  publicKey: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  counter: {
    type: DataTypes.BIGINT,
    allowNull: false,
    defaultValue: 0,
  },
  transports: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
  },
  deviceName: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  lastUsedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

export default Passkey;
