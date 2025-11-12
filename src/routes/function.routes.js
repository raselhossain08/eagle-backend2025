const express = require("express");
const createError = require("http-errors");
const { protect } = require("../middlewares/auth.middleware");

const router = express.Router();
/**
 * @swagger
 * tags:
 *   - name: Functions
 *     description: Functions API endpoints
 */

// Function registry - store your functions here
const functionRegistry = {
  // Example function: Get market data
  getMarketData: async (params = {}) => {
    const { symbols = ["AAPL", "MSFT", "GOOGL"] } = params;
    
    // In a real implementation, you would fetch actual market data
    // This is just a mock response
    const mockMarketData = symbols.map(symbol => ({
      symbol,
      price: (Math.random() * 500 + 100).toFixed(2),
      change: (Math.random() * 10 - 5).toFixed(2),
      volume: Math.floor(Math.random() * 10000000),
      marketCap: `$${Math.floor(Math.random() * 1000) + 100}B`,
    }));
    
    return { marketData: mockMarketData, timestamp: new Date().toISOString() };
  },
  
  // Example function: Calculate risk score
  calculateRisk: async (params = {}) => {
    const { portfolio = [], riskTolerance = "medium" } = params;
    
    // Mock risk calculation
    const riskFactors = {
      low: 0.3,
      medium: 0.5,
      high: 0.8
    };
    
    const baseRiskScore = riskFactors[riskTolerance] || 0.5;
    const portfolioFactor = portfolio.length ? 1 - (1 / portfolio.length) * 0.5 : 1;
    const finalScore = baseRiskScore * portfolioFactor;
    
    return { 
      riskScore: parseFloat(finalScore.toFixed(2)),
      riskLevel: finalScore < 0.4 ? "Low" : finalScore < 0.7 ? "Medium" : "High",
      recommendations: [
        "Diversify across sectors",
        "Consider adjusting asset allocation",
        "Review investment timeframe"
      ]
    };
  }
};

// Execute a function
const executeFunction = async (req, res, next) => {
  try {
    const { functionName, params } = req.body;

    if (!functionName) {
      throw createError(400, "Function name is required");
    }

    // Check if function exists
    if (!functionRegistry[functionName]) {
      throw createError(404, `Function "${functionName}" not found`);
    }

    // Execute the function with timeout protection
    const startTime = Date.now();
    
    // Create a promise with timeout
    const functionPromise = Promise.race([
      functionRegistry[functionName](params || {}),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Function execution timed out")), 10000)
      )
    ]);
    
    const result = await functionPromise;
    const executionTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        result,
        executionTime,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Get available functions
const getAvailableFunctions = async (req, res, next) => {
  try {
    const functions = Object.keys(functionRegistry).map(name => ({
      name,
      description: getFunctionDescription(name)
    }));
    
    res.json({
      success: true,
      data: functions,
    });
  } catch (err) {
    next(err);
  }
};

// Helper to get function descriptions
function getFunctionDescription(functionName) {
  const descriptions = {
    getMarketData: "Retrieves current market data for specified stock symbols",
    calculateRisk: "Calculates risk assessment score based on portfolio composition"
  };
  
  return descriptions[functionName] || "No description available";
}

// All routes require authentication
router.use(protect);

// @route   POST /api/functions/execute
// @desc    Execute a function
// @access  Protected
router.post("/execute", executeFunction);

// @route   GET /api/functions/available
// @desc    Get available functions
// @access  Protected
router.get("/available", getAvailableFunctions);

module.exports = router;
