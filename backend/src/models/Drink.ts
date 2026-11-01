import type { Model, SaveOptions } from "sequelize";
import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.ts";

export interface DrinkAttributes {
  id: number;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  isActive: boolean;
  isAlcohol: boolean;
  category: string | null;
  lastRestockedAt: Date | null;
}

export interface DrinkCreationAttributes
  extends Omit<DrinkAttributes, "id" | "description" | "stock" | "isActive" | "isAlcohol" | "category" | "lastRestockedAt"> {
  id?: number;
  description?: string | null;
  stock?: number;
  isActive?: boolean;
  isAlcohol?: boolean;
  category?: string | null;
  lastRestockedAt?: Date | null;
}

export interface DrinkInstance
  extends Model<DrinkAttributes, DrinkCreationAttributes>, DrinkAttributes {
  addStock: (quantity: number, options?: SaveOptions) => Promise<DrinkInstance>;
  deductStock: (quantity?: number, options?: SaveOptions) => Promise<DrinkInstance>;
  isInStock: () => boolean;
}

const Drink = sequelize.define<DrinkInstance, DrinkAttributes>("Drink", {
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
  isAlcohol: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: "beverage",
  },
  // When stock last went up through a restock write path (add-stock, edit,
  // import, create). Null until the first one; deducts and the stock raises
  // that undo performs never touch it.
  lastRestockedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null,
  },
});

// Sequelize types the prototype as Model<any, any>; cast once for the assignments.
const drinkPrototype = Drink.prototype as DrinkInstance;

drinkPrototype.addStock = function (this: DrinkInstance, quantity: number, options?: SaveOptions): Promise<DrinkInstance> {
  if (quantity <= 0) {
    throw new Error("Stock quantity must be positive");
  }
  this.stock += quantity;
  return this.save(options);
};

drinkPrototype.deductStock = function (this: DrinkInstance, quantity = 1, options?: SaveOptions): Promise<DrinkInstance> {
  if (this.stock < quantity) {
    throw new Error("Insufficient stock");
  }
  this.stock -= quantity;
  return this.save(options);
};

drinkPrototype.isInStock = function (this: DrinkInstance): boolean {
  return this.stock > 0 && this.isActive;
};

export default Drink;
