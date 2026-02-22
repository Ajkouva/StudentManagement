const express = require('express');
const protect = require('../middleware/auth.protect');
const router = express.Router();

const authController = require('../controllers/auth.controller');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', protect, authController.me);
router.post('/logout', authController.logout);

module.exports = router;