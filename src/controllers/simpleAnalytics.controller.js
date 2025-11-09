const mongoose = require('mongoose');
const SimpleAnalyticsEvent = require('../models/SimpleAnalyticsEvent.model');

/**
 * Simple Analytics Controller
 * Uses a simplified model for easy event tracking
 */

/**
 * Batch Events Controller
 */
exports.batchEvents = async (req, res) => {
    try {
        const { events } = req.body;

        if (!events || !Array.isArray(events) || events.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Events array is required and cannot be empty",
                example: {
                    events: [{ type: "page_view", properties: { page: "/home" } }]
                }
            });
        }

        const validatedEvents = [];
        const errors = [];

        for (let i = 0; i < events.length; i++) {
            const event = events[i];

            if (!event.type) {
                errors.push(`Event ${i}: 'type' field is required`);
                continue;
            }

            validatedEvents.push({
                type: event.type,
                userId: event.userId || null,
                sessionId: event.sessionId || `session-${Date.now()}`,
                timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
                properties: event.properties || {},
                metadata: {
                    userAgent: req.headers['user-agent'] || 'Unknown',
                    ip: req.ip || req.connection.remoteAddress || 'Unknown',
                    referer: req.headers.referer || null,
                    ...event.metadata
                }
            });
        }

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Validation errors",
                errors,
                example: { events: [{ type: "page_view", properties: { page: "/home" } }] }
            });
        }

        if (validatedEvents.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid events to process"
            });
        }

        // Save to database
        const savedEvents = await SimpleAnalyticsEvent.insertMany(validatedEvents);

        res.status(200).json({
            success: true,
            message: `Successfully processed ${savedEvents.length} event(s)`,
            data: {
                processed: savedEvents.length,
                eventIds: savedEvents.map(event => event._id)
            }
        });

    } catch (error) {
        console.error("Batch events error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to process batch events",
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Get Events
 */
exports.getEvents = async (req, res) => {
    try {
        const { type, userId, startDate, endDate, page = 1, limit = 50 } = req.query;

        const query = {};
        if (type) query.type = type;
        if (userId) query.userId = userId;
        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) query.timestamp.$gte = new Date(startDate);
            if (endDate) query.timestamp.$lte = new Date(endDate);
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const events = await SimpleAnalyticsEvent.find(query)
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await SimpleAnalyticsEvent.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                events,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            }
        });
    } catch (error) {
        console.error("Get events error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve events",
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};
