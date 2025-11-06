/**
 * Admin Only Middleware
 * Ensures only admin users can access protected routes
 */

const adminOnly = (req, res, next) => {
    try {
        // Check if user exists (should be set by protect middleware)
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }

        // Check if user is admin
        if (req.user.role !== "admin" && req.user.role !== "superadmin") {
            return res.status(403).json({
                success: false,
                message: "Access denied. Admin privileges required.",
            });
        }

        // User is admin, proceed to next middleware
        next();
    } catch (error) {
        console.error("Admin middleware error:", error);
        res.status(500).json({
            success: false,
            message: "Server error in admin verification",
        });
    }
};

module.exports = { adminOnly };
