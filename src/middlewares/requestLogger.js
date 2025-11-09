const requestLogger = (req, res, next) => {
  const start = Date.now();
  const { method, url, ip } = req;
  const userAgent = req.get("User-Agent") || "Unknown";

  // Log request
  // console.log(`📥 [${new Date().toISOString()}] ${method} ${url} - IP: ${ip}`);

  // Override res.json to log responses
  const originalJson = res.json;
  res.json = function (body) {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;

    // Log response
    // console.log(
    //   `📤 [${new Date().toISOString()}] ${method} ${url} - ${statusCode} ${duration}ms`
    // );

    // Log sensitive operations
    // if (url.includes("/auth/") || url.includes("/subscription/")) {
    //   console.log(
    //     `🔐 Auth/Subscription operation: ${method} ${url} - Status: ${statusCode}`
    //   );
    // }

    return originalJson.call(this, body);
  };

  next();
};

module.exports = requestLogger;
