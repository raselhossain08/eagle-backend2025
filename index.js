const app = require("./src/app");

// Port
const PORT = process.env.PORT || 5000;

// Start server
const server = app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});

// Optional: Graceful shutdown handling
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection 💥", err.message);
  server.close(() => process.exit(1));
});
