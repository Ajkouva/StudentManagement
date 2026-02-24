const express = require('express');
const router = express.Router();
const studentController = require('../controllers/student.controller');
const protect = require('../middleware/auth.protect');

router.get('/studentDetails', protect, studentController.studentDetails);
router.post('/attendanceCalendar',protect, studentController.attendanceCalendar);

module.exports = router;