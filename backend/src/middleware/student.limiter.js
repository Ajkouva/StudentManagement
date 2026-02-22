const rateLimit = require('express-rate-limit');

// Bug fix: student dashboard routes need a higher limit than the auth limiter.
// 10 req/15min (auth limiter) is too low for dashboard data fetching.
const studentLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        message: "too many requests, please try after 15 minutes"
    }
});

module.exports = studentLimiter;
