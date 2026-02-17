const express = require('express');
const cors = require('cors');
const cookies = require('cookie-parser');
const authRoutes = require('./routes/auth.routes');
const studentRoutes = require('./routes/student.routes');
const teacherRoutes=require('./routes/teacher.routes');
const limiter = require('./middleware/auth.limiter');

const app = express();
app.use(cors({
    origin: "http://localhost:5500",
    credentials: true
}));
app.use(express.json({limit:"10kb"}));
app.use(cookies());

app.get("/", (req, res) => {
    res.send("Hello World!");
});


app.use('/api/auth',limiter, authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/teacher', teacherRoutes);



module.exports = app;