const express = require('express');
const router = express.Router();
/**
 * @swagger
 * tags:
 *   - name: Admin Profile
 *     description: Admin Profile API endpoints
 */
const ProfileController = require('../controllers/profile.controller');
const AdminAuthMiddleware = require('../middlewares/auth.middleware');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/avatars/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    // Accept images only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
        return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: fileFilter
});

/**
 * @route   POST /api/admin/profile/avatar
 * @desc    Upload profile avatar
 * @access  Private
 */
router.post('/avatar', AdminAuthMiddleware.verifyToken, upload.single('avatar'), ProfileController.uploadAvatar);

/**
 * @route   POST /api/admin/profile/change-password
 * @desc    Change password
 * @access  Private
 */
router.post('/change-password', AdminAuthMiddleware.verifyToken, ProfileController.changePassword);

/**
 * @route   GET /api/admin/profile/stats
 * @desc    Get account statistics
 * @access  Private
 */
router.get('/stats', AdminAuthMiddleware.verifyToken, ProfileController.getAccountStats);

/**
 * @route   GET /api/admin/profile/activity
 * @desc    Get activity log
 * @access  Private
 */
router.get('/activity', AdminAuthMiddleware.verifyToken, ProfileController.getActivityLog);

/**
 * @route   GET /api/admin/profile
 * @desc    Get current user's profile
 * @access  Private
 */
router.get('/', AdminAuthMiddleware.verifyToken, ProfileController.getProfile);

/**
 * @route   PUT /api/admin/profile
 * @desc    Update current user's profile
 * @access  Private
 */
router.put('/', AdminAuthMiddleware.verifyToken, ProfileController.updateProfile);

module.exports = router;
