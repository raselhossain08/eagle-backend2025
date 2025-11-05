const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging
  console.error('Error Stack:', err.stack);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { message, statusCode: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `${field} already exists`;
    error = { message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = { message, statusCode: 400 };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = { message, statusCode: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = { message, statusCode: 401 };
  }

  // PayPal API errors
  if (err.response?.data?.name === 'INVALID_REQUEST') {
    const message = 'Invalid payment request';
    error = { message, statusCode: 400 };
  }

  // Stripe errors
  if (err.type?.startsWith('Stripe')) {
    const message = err.message || 'Payment processing error';
    error = { message, statusCode: 400 };
  }

  const status = error.statusCode || err.status || 500;
  const message = error.message || 'Internal server error';

  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && { 
      stack: err.stack,
      error: err 
    }),
  });
};

module.exports = errorHandler;
