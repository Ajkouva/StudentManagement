const express = require('express');
const cors = require('cors');
const cookies = require('cookie-parser');
const authRoutes = require('./routes/auth.routes');
const studentRoutes = require('./routes/student.routes');
const teacherRoutes = require('./routes/teacher.routes');
const limiter = require('./middleware/auth.limiter');
const teacherLimiter = require('./middleware/teacher.limiter');

const app = express();
app.use(cors({
    origin: true,//["http://localhost:5500", "http://localhost:5501", "http://127.0.0.1:5501"],
    credentials: true
}));
app.use(express.json({ limit: "10kb" }));
app.use(cookies());

app.get("/", (req, res) => {
    res.send("Hello World!");
});


app.use('/api/auth', limiter, authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/teacher', teacherLimiter, teacherRoutes);

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
});



module.exports = app;