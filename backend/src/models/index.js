import Drink from "./Drink.js";
import Transaction from "./Transaction.js";
import User from "./User.js";
import Passkey from "./Passkey.js";

// Define associations
User.hasMany(Transaction, {
  foreignKey: "userId",
  as: "transactions",
});

User.hasMany(Transaction, {
  foreignKey: "adminId",
  as: "processedTransactions",
});

User.hasMany(Passkey, {
  foreignKey: "userId",
  as: "passkeys",
  onDelete: "CASCADE",
});

Drink.hasMany(Transaction, {
  foreignKey: "drinkId",
  as: "transactions",
});

Transaction.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

Transaction.belongsTo(User, {
  foreignKey: "adminId",
  as: "admin",
});

Transaction.belongsTo(Drink, {
  foreignKey: "drinkId",
  as: "drink",
});

Passkey.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

export {
  Drink,
  Passkey,
  Transaction,
  User,
};
