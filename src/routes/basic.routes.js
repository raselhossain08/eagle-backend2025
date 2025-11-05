const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth.middleware");
const { requirePackage } = require("../middlewares/packageAccess.middleware");

/**
 * @swagger
 * tags:
 *   name: Basic
 *   description: Basic package features (free tier)
 */

// Protect all basic routes
router.use(protect);
// Basic features are available to all subscription levels

// Market Education
router.get("/education", (req, res) => {
  res.json({
    success: true,
    education: {
      categories: [
        {
          name: "Trading Basics",
          description: "Fundamental trading concepts",
          articles: [
            {
              title: "Introduction to Stock Trading",
              url: "/education/intro-to-trading",
              readTime: "10 minutes",
              difficulty: "Beginner",
            },
            {
              title: "Understanding Market Orders",
              url: "/education/market-orders",
              readTime: "8 minutes",
              difficulty: "Beginner",
            },
            {
              title: "Risk Management Basics",
              url: "/education/risk-management",
              readTime: "15 minutes",
              difficulty: "Beginner",
            },
          ],
        },
        {
          name: "Investment Fundamentals",
          description: "Long-term investment strategies",
          articles: [
            {
              title: "Building Your First Portfolio",
              url: "/education/first-portfolio",
              readTime: "20 minutes",
              difficulty: "Beginner",
            },
            {
              title: "Understanding P/E Ratios",
              url: "/education/pe-ratios",
              readTime: "12 minutes",
              difficulty: "Intermediate",
            },
            {
              title: "Dividend Investing Guide",
              url: "/education/dividend-investing",
              readTime: "18 minutes",
              difficulty: "Beginner",
            },
          ],
        },
        {
          name: "Market Analysis",
          description: "Basic market analysis techniques",
          articles: [
            {
              title: "Reading Stock Charts",
              url: "/education/reading-charts",
              readTime: "25 minutes",
              difficulty: "Intermediate",
            },
            {
              title: "Support and Resistance",
              url: "/education/support-resistance",
              readTime: "15 minutes",
              difficulty: "Intermediate",
            },
          ],
        },
      ],
      videos: [
        {
          title: "Stock Market 101",
          url: "/videos/market-101",
          duration: "30 minutes",
          thumbnail: "/thumbnails/market-101.jpg",
        },
        {
          title: "How to Read Financial Statements",
          url: "/videos/financial-statements",
          duration: "45 minutes",
          thumbnail: "/thumbnails/financial-statements.jpg",
        },
      ],
      quizzes: [
        {
          title: "Trading Basics Quiz",
          questions: 10,
          passingScore: 70,
          url: "/quizzes/trading-basics",
        },
      ],
    },
    package: "Basic",
  });
});

// Basic Market Updates
router.get("/market-updates", (req, res) => {
  res.json({
    success: true,
    marketUpdates: {
      summary: {
        date: new Date().toISOString().split("T")[0],
        marketStatus: "Open",
        overallTrend: "Mixed",
      },
      indices: [
        {
          name: "S&P 500",
          symbol: "SPX",
          value: 5850.25,
          change: "+15.30",
          changePercent: "+0.26%",
          trend: "Up",
        },
        {
          name: "NASDAQ",
          symbol: "IXIC",
          value: 19200.45,
          change: "-25.80",
          changePercent: "-0.13%",
          trend: "Down",
        },
        {
          name: "Dow Jones",
          symbol: "DJI",
          value: 43850.75,
          change: "+45.20",
          changePercent: "+0.10%",
          trend: "Up",
        },
      ],
      topMovers: {
        gainers: [
          { symbol: "AAPL", change: "+2.45%" },
          { symbol: "MSFT", change: "+1.85%" },
          { symbol: "NVDA", change: "+3.32%" },
        ],
        losers: [
          { symbol: "TSLA", change: "-1.28%" },
          { symbol: "AMZN", change: "-0.95%" },
          { symbol: "META", change: "-0.75%" },
        ],
      },
      news: [
        {
          headline: "Fed Maintains Interest Rates",
          summary: "Federal Reserve keeps rates unchanged as expected",
          time: "2 hours ago",
          impact: "Neutral",
        },
        {
          headline: "Tech Earnings Season Begins",
          summary: "Major tech companies report earnings this week",
          time: "4 hours ago",
          impact: "Positive",
        },
      ],
    },
    package: "Basic",
  });
});

// Basic Chat Room Access
router.get("/chat-room", (req, res) => {
  res.json({
    success: true,
    chatRoom: {
      name: "Eagle Basic Community",
      url: "https://discord.gg/eagle-basic",
      status: "Active",
      activeUsers: 1247,
      description: "Community chat for basic members",
      features: [
        "Market discussions",
        "Educational content sharing",
        "Community support",
        "News updates",
      ],
      rules: [
        "Be respectful to all members",
        "No spam or promotional content",
        "Educational discussions only",
        "No financial advice",
        "Follow community guidelines",
      ],
      moderators: ["EagleBot", "CommunityMod1", "CommunityMod2"],
      channels: [
        {
          name: "general-discussion",
          description: "General market and trading discussions",
        },
        {
          name: "education",
          description: "Educational content and questions",
        },
        {
          name: "news-updates",
          description: "Market news and updates",
        },
      ],
    },
    package: "Basic",
  });
});

// Email Support
router.get("/support", (req, res) => {
  res.json({
    success: true,
    support: {
      email: "support@eagleinvestors.com",
      responseTime: "24-48 hours",
      availableHours: "Monday-Friday, 9AM-5PM EST",
      supportTypes: [
        "Account issues",
        "Technical problems",
        "General questions",
        "Educational inquiries",
      ],
      faq: [
        {
          question: "How do I access educational content?",
          answer: "Navigate to the Education section in your dashboard",
        },
        {
          question: "Can I upgrade my subscription?",
          answer: "Yes, visit the Subscription page to upgrade anytime",
        },
        {
          question: "What's included in the Basic plan?",
          answer:
            "Educational content, community access, and basic market updates",
        },
      ],
      contactForm: "/support/contact",
    },
    package: "Basic",
  });
});

// Upgrade Information
router.get("/upgrade-info", (req, res) => {
  res.json({
    success: true,
    upgradeInfo: {
      currentPlan: "Basic",
      availableUpgrades: [
        {
          plan: "Diamond",
          monthlyPrice: "$76",
          annualPrice: "$760",
          features: [
            "Real-time trading alerts",
            "AI Advisor",
            "Live trading streams",
            "Premium chat room",
            "Investment recommendations",
          ],
          savings: "Save 21% with annual billing",
        },
        {
          plan: "Infinity",
          monthlyPrice: "$127",
          annualPrice: "$1,270",
          features: [
            "All Diamond features",
            "Advanced market screening",
            "Professional trading scripts",
            "VIP support",
            "Custom analysis tools",
          ],
          savings: "Save 32% with annual billing",
          recommended: true,
        },
      ],
      upgradeUrl: "/subscription/upgrade",
      benefits: [
        "Immediate access to premium features",
        "No long-term contracts",
        "Cancel anytime",
        "14-day money-back guarantee",
      ],
    },
    package: "Basic",
  });
});

module.exports = router;
