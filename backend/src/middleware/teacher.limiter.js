const teacherLimit = require('express-rate-limit');

const teacherLimiter = teacherLimit({
    windowMs: 15*60*1000,
    max:1000,
    message: {
        message:"too many request please try after 15 minutes"
    }
})

module.exports = teacherLimiter;