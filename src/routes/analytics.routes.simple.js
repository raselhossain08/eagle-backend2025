const express = require("express");
const router = express.Router();

// Simple test endpoints first
router.post("/events/batch", (req, res) => {
  res.json({
    success: true,
    message: "Batch events endpoint working",
    data: { received: req.body }
  });
});

router.post("/events/single", (req, res) => {
  res.json({
    success: true,
    message: "Single event endpoint working",
    data: { received: req.body }
  });
});

router.get("/events", (req, res) => {
  res.json({
    success: true,
    message: "Get events endpoint working",
    data: { query: req.query }
  });
});

router.get("/dashboard", (req, res) => {
  res.json({
    success: true,
    message: "Dashboard endpoint working"
  });
});

router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Analytics service is healthy",
    timestamp: new Date().toISOString()
  });
});

module.exports = router;