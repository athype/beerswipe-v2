import { seedAdminUser } from './adminSeed.js';

export const runSeeds = async () => {
  console.log('Running database seeds...');
  
  try {
    await seedAdminUser();
    console.log('All seeds completed successfully');
  } catch (error) {
    console.error('Seed operation failed:', error);
    throw error;
  }
};
