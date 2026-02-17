const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: 15*60*1000,
    max:10,
    message: {
        message:"too many request please try after 15 minutes"
    }
})

module.exports = limiter;