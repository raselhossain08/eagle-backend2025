#!/usr/bin/env node

/**
 * Cron job script to process scheduled subscription downgrades
 * This should be scheduled to run daily via crontab or similar
 *
 * Example crontab entry (runs daily at 2 AM):
 * 0 2 * * * /usr/bin/node /path/to/your/backend/src/scripts/processDowngrades.js
 */

const mongoose = require("mongoose");
const DowngradeProcessor = require("../services/downgradeProcessor");

// Load environment variables
require("dotenv").config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/eagle-investors";

async function main() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB successfully");

    const processor = new DowngradeProcessor();
    await processor.processScheduledDowngrades();

    console.log("Downgrade processing completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("Error running downgrade processor:", error);
    process.exit(1);
  } finally {
    try {
      await mongoose.disconnect();
      console.log("Disconnected from MongoDB");
    } catch (error) {
      console.error("Error disconnecting from MongoDB:", error);
    }
  }
}

// Handle process termination gracefully
process.on("SIGINT", async () => {
  console.log("\nReceived SIGINT, shutting down gracefully...");
  try {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  } catch (error) {
    console.error("Error during graceful shutdown:", error);
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\nReceived SIGTERM, shutting down gracefully...");
  try {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  } catch (error) {
    console.error("Error during graceful shutdown:", error);
  }
  process.exit(0);
});

// Run the main function
main();
