import dotenv from "dotenv";
import mongoose from "mongoose";
import { Package } from "../models/Package";
import connectdb from "../db/index";

// Load environment variables
dotenv.config({ path: "./.env" });

/**
 * Seed script to populate packages/plans data
 * Based on the package data from the UI
 */
const packageData = [
  {
    packageName: "Solar Starter",
    minAmount: "100",
    maxAmount: "2000",
    roi: 1.75,
    duration: 150,
    binaryBonus: 10.00,
    cappingLimit: "2000.00",
    principleReturn: 50.00,
    levelOneReferral: 9,
    status: "Active" as const,
  },
  {
    packageName: "Power Growth",
    minAmount: "2000",
    maxAmount: "7000",
    roi: 2.18,
    duration: 140,
    binaryBonus: 10.00,
    cappingLimit: "7000.00",
    principleReturn: 60.00,
    levelOneReferral: 10,
    status: "Active" as const,
  },
  {
    packageName: "Elite Energy",
    minAmount: "7000",
    maxAmount: "20000",
    roi: 2.55,
    duration: 130,
    binaryBonus: 10.00,
    cappingLimit: "20000.00",
    principleReturn: 80.00,
    levelOneReferral: 11,
    status: "Active" as const,
  },
  {
    packageName: "Turbo Watt",
    minAmount: "2000",
    maxAmount: "4500",
    roi: 2.00,
    duration: 100,
    binaryBonus: 10.00,
    cappingLimit: "4500.00",
    principleReturn: 200.00,
    levelOneReferral: 10,
    status: "Active" as const,
  },
  {
    packageName: "Solar Mini",
    minAmount: "100",
    maxAmount: "1000",
    roi: 1.20,
    duration: 110,
    binaryBonus: 10.00,
    cappingLimit: "1000.00",
    principleReturn: 132.00,
    levelOneReferral: 7,
    status: "Active" as const,
  },
  {
    packageName: "Basic $100",
    minAmount: "100",
    maxAmount: "100",
    roi: 1.50,
    duration: 150,
    binaryBonus: 0,
    cappingLimit: "0",
    principleReturn: 0,
    levelOneReferral: 0,
    status: "Active" as const,
  },
  {
    packageName: "Premium $2500",
    minAmount: "2500",
    maxAmount: "2500",
    roi: 1.80,
    duration: 150,
    binaryBonus: 0,
    cappingLimit: "0",
    principleReturn: 0,
    levelOneReferral: 0,
    status: "Active" as const,
  },
];

async function seedPackages() {
  try {
    console.log("🌱 Starting package seeding...");

    // Connect to database
    await connectdb();
    console.log("✅ Database connected");

    // Wait for mongoose to be ready
    if (mongoose.connection.readyState !== 1) {
      await new Promise((resolve) => {
        mongoose.connection.once("connected", resolve);
      });
    }

    // Clear existing packages (optional - comment out if you want to keep existing)
    // await Package.deleteMany({});
    // console.log("✅ Cleared existing packages");

    // Insert packages
    const packages = await Package.insertMany(packageData);
    console.log(`✅ Successfully seeded ${packages.length} packages`);

    // Display summary
    console.log("\n📦 Seeded Packages:");
    packages.forEach((pkg, index) => {
      console.log(
        `${index + 1}. ${pkg.packageName} - ROI: ${pkg.roi}% - Duration: ${pkg.duration} days - Status: ${pkg.status}`
      );
    });

    console.log("\n✨ Package seeding completed successfully!");
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding packages:", error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  seedPackages();
}

export { seedPackages };

