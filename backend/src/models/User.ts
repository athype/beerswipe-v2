import type { UserType } from "@beerswipe/types";
import type { Model, SaveOptions } from "sequelize";
import bcrypt from "bcryptjs";
import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.ts";

export interface UserAttributes {
  id: number;
  username: string;
  password: string | null;
  credits: number;
  dateOfBirth: string | null;
  userType: UserType;
  isActive: boolean;
}

export interface UserCreationAttributes
  extends Omit<UserAttributes, "id" | "password" | "credits" | "dateOfBirth" | "isActive"> {
  id?: number;
  password?: string | null;
  credits?: number;
  dateOfBirth?: string | null;
  isActive?: boolean;
}

export interface UserInstance
  extends Model<UserAttributes, UserCreationAttributes>, UserAttributes {
  validatePassword: (password: string) => Promise<boolean>;
  canLogin: () => boolean;
  addCredits: (amount: number, options?: SaveOptions) => Promise<UserInstance>;
  deductCredits: (amount: number, options?: SaveOptions) => Promise<UserInstance>;
  addCreditsUnchecked: (amount: number, options?: SaveOptions) => Promise<UserInstance>;
  deductCreditsUnchecked: (amount: number, options?: SaveOptions) => Promise<UserInstance>;
}

const User = sequelize.define<UserInstance, UserAttributes>("User", {
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

// Sequelize types the prototype as Model<any, any>; cast once for the assignments.
const userPrototype = User.prototype as UserInstance;

userPrototype.validatePassword = async function (this: UserInstance, password: string): Promise<boolean> {
  if (!this.password)
    return false;
  return bcrypt.compare(password, this.password);
};

userPrototype.canLogin = function (this: UserInstance): boolean {
  return (this.userType === "admin" || this.userType === "seller") && this.password !== null;
};

userPrototype.addCredits = function (this: UserInstance, amount: number, options?: SaveOptions): Promise<UserInstance> {
  // Only allow adding credits in blocks of 10
  if (amount % 10 !== 0) {
    throw new Error("Credits can only be added in blocks of 10");
  }
  this.credits += amount;
  return this.save(options);
};

userPrototype.deductCredits = function (this: UserInstance, amount: number, options?: SaveOptions): Promise<UserInstance> {
  if (this.credits < amount) {
    throw new Error("Insufficient credits");
  }
  this.credits -= amount;
  return this.save(options);
};

// Bypass methods for undo operations - these don't enforce the 10-credit rule
userPrototype.addCreditsUnchecked = function (this: UserInstance, amount: number, options?: SaveOptions): Promise<UserInstance> {
  this.credits += amount;
  return this.save(options);
};

userPrototype.deductCreditsUnchecked = function (this: UserInstance, amount: number, options?: SaveOptions): Promise<UserInstance> {
  if (this.credits < amount) {
    throw new Error("Insufficient credits");
  }
  this.credits -= amount;
  return this.save(options);
};

export default User;
