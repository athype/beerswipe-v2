import { seedAdminUser } from "./adminSeed.ts";

export async function runSeeds(): Promise<void> {
  console.log("Running database seeds...");

  try {
    await seedAdminUser();
    console.log("All seeds completed successfully");
  }
  catch (error) {
    console.error("Seed operation failed:", error);
    throw error;
  }
}
