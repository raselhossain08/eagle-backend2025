const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const connectDB = async () => {
  try {
    // Configure mongoose for better connection handling
    mongoose.set('strictQuery', false);
    
    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log("✅ MongoDB connected:", conn.connection.host);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
    });

    // Graceful close on app termination
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('📴 MongoDB connection closed through app termination');
      process.exit(0);
    });

  } catch (error) {
    console.error("❌ DB connection error:", error.message);
    
    // Don't exit process in serverless environments
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    } else {
      // In production, log error but continue (for serverless functions)
      console.log('⚠️ Running without database connection in production');
    }
  }
};

module.exports = connectDB;
