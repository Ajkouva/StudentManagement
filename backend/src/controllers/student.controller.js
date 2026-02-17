const pool = require("../db/db");
// require('dotenv').config();

async function studentDetails(req, res) {
    if (req.user.role !== "STUDENT") {
        return res.status(403).json({ message: "Access denied" });
    }
    const email = req.user.email;

    if (!email) {
        return res.status(400).json({ error: "User email required" });
    }

    try {
        const result = await pool.query('select id, name, email, subject, roll_num from student where email = $1', [email]);

        if ((result).rows.length === 0) {
            return res.status(404).json({ error: "Student profile not found" });
        }

        const student = result.rows[0];

        res.json({
            profile: {
                name: student.name,
                id_code: student.id,
                subject: student.subject,
                roll_no: student.roll_num,
                email: student.email
            },
        })

    } catch (e) {
        console.error('Dashboard error:', e);
        res.status(500).json({ error: 'Server error' });
    }
}

module.exports = { studentDetails };