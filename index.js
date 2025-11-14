// Load environment variables FIRST before anything else
require('dotenv').config();

const connectDB = require("./src/config/db");

// Port
const PORT = process.env.PORT || 5000;

// Initialize server with database connection
const startServer = async () => {
  try {
    // Connect to database first
    console.log("🔄 Initializing database connection...");
    await connectDB();
    console.log("✅ Database connected successfully");

    // Then require and start the app
    const app = require("./src/app");

    // Start server
    const server = app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 API Base URL: http://localhost:${PORT}/api`);
      console.log(`❤️  Health Check: http://localhost:${PORT}/api/health`);
    });

    // Handle server startup errors
    server.on('error', (err) => {
      console.error('❌ Server Error:', err.message);
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please use a different port or stop the existing process.`);
      }
      process.exit(1);
    });

    return server;
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

// Start the server
startServer();

// Optional: Graceful shutdown handling
process.on("unhandledRejection", (err) => {
  console.error("💥 Unhandled Rejection:", err.message);
  console.error(err.stack);
  // Exit immediately since we can't gracefully shutdown at this point
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught Exception:", err.message);
  console.error(err.stack);
  process.exit(1);
});
