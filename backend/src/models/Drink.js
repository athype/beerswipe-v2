import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

const Drink = sequelize.define("Drink", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true,
      len: [1, 100],
    },
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  price: {
    type: DataTypes.INTEGER, // Price in credits
    allowNull: false,
    validate: {
      min: 1,
    },
  },
  stock: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0,
    },
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: "beverage",
  },
});

// Instance methods
Drink.prototype.addStock = function (quantity) {
  if (quantity <= 0) {
    throw new Error("Stock quantity must be positive");
  }
  this.stock += quantity;
  return this.save();
};

Drink.prototype.deductStock = function (quantity = 1) {
  if (this.stock < quantity) {
    throw new Error("Insufficient stock");
  }
  this.stock -= quantity;
  return this.save();
};

Drink.prototype.isInStock = function () {
  return this.stock > 0 && this.isActive;
};

export default Drink;
