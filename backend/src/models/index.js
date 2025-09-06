import User from './User.js';
import Drink from './Drink.js';
import Transaction from './Transaction.js';

// Define associations
User.hasMany(Transaction, { 
  foreignKey: 'userId', 
  as: 'transactions' 
});

User.hasMany(Transaction, { 
  foreignKey: 'adminId', 
  as: 'processedTransactions' 
});

Drink.hasMany(Transaction, { 
  foreignKey: 'drinkId', 
  as: 'transactions' 
});

Transaction.belongsTo(User, { 
  foreignKey: 'userId', 
  as: 'user' 
});

Transaction.belongsTo(User, { 
  foreignKey: 'adminId', 
  as: 'admin' 
});

Transaction.belongsTo(Drink, { 
  foreignKey: 'drinkId', 
  as: 'drink' 
});

export {
  User,
  Drink,
  Transaction
};
