import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  drinkId: {
    type: DataTypes.INTEGER,
    allowNull: true, // null for credit additions
    references: {
      model: 'Drinks',
      key: 'id'
    }
  },
  adminId: {
    type: DataTypes.INTEGER,
    allowNull: false, // admin who processed the transaction
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.ENUM('sale', 'credit_addition'),
    allowNull: false
  },
  amount: {
    type: DataTypes.INTEGER, // credits involved
    allowNull: false
  },
  quantity: {
    type: DataTypes.INTEGER, // for sales, number of drinks
    allowNull: true,
    defaultValue: 1
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true
  },
  transactionDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
});

export default Transaction;
