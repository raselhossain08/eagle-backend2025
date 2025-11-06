const app = require("./src/app");

// Port
const PORT = process.env.PORT || 5000;

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

// Optional: Graceful shutdown handling
process.on("unhandledRejection", (err) => {
  console.error("💥 Unhandled Rejection:", err.message);
  console.error(err.stack);
  server.close(() => process.exit(1));
});

process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught Exception:", err.message);
  console.error(err.stack);
  process.exit(1);
});
