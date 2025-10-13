import { User } from "../models/index.js";

export async function seedAdminUser() {
  try {
    const existingAdmin = await User.findOne({
      where: { userType: "admin" },
    });

    if (existingAdmin) {
      console.log("Admin user already exists, skipping seed");
      return;
    }

    const admin = await User.create({
      username: "pos",
      password: "ADAdeventer",
      userType: "admin",
      credits: 0,
    });

    console.log("✅ Default admin user created successfully:");
    console.log(`   Username: ${admin.username}`);
    console.log(`   Password: ADAdeventer`);
    console.log(`   User Type: ${admin.userType}`);
  }
  catch (error) {
    console.error("❌ Failed to seed admin user:", error);
    throw error;
  }
}
