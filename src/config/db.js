const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const connectDB = async () => {
  try {
    console.log("🔄 Attempting MongoDB connection...");
    console.log("📍 MongoDB URI:", process.env.MONGO_URI ? "Found" : "Missing");

    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI environment variable is not defined");
    }

    // Configure mongoose for better connection handling
    mongoose.set('strictQuery', false);

    // Connection options for production reliability
    const options = {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4, skip trying IPv6
      retryWrites: true,
      w: 'majority'
    };

    const conn = await mongoose.connect(process.env.MONGO_URI, options);

    console.log("✅ MongoDB connected:", conn.connection.host);
    console.log("📊 Connection state:", mongoose.connection.readyState);

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected - attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

    // Graceful close on app termination
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('📴 MongoDB connection closed through app termination');
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await mongoose.connection.close();
      console.log('📴 MongoDB connection closed through SIGTERM');
      process.exit(0);
    });

    return conn;

  } catch (error) {
    console.error("❌ DB connection error:", error.message);
    console.error("Stack:", error.stack);

    // Always throw error to let caller handle it
    throw error;
  }
};

module.exports = connectDB;
