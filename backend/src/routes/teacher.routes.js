const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacher.controller');
const protect = require('../middleware/auth.protect');

router.get('/teacherDetails',protect, teacherController.teacherDetails);
router.post('/addStudent',protect, teacherController.addStudent);
router.get('/stats',protect, teacherController.stats);

module.exports = router;