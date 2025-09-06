#!/usr/bin/env node

import { initializeDatabase } from '../src/config/database.js';
import { runSeeds } from '../src/seeds/index.js';

console.log('Starting manual database seeding...');

try {
  await initializeDatabase();
  
  await runSeeds();
  
  console.log('Manual seeding completed successfully');
  process.exit(0);
} catch (error) {
  console.error('Manual seeding failed:', error);
  process.exit(1);
}
