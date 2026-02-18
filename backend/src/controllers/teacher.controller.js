const pool = require('../db/db');
const bcrypt = require('bcryptjs');
// require('dotenv').config();


async function teacherDetails(req, res) {
    try {
        if (!req.user) {
            return res.status(400).json({ error: 'user not found' });
        }
        if (req.user.role !== "TEACHER") {
            return res.status(403).json({ message: "Access denied" });
        }

        const email = req.user.email;
        const result = await pool.query('select id, name, email, subject  from teacher where email = $1', [email]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Teacher profile not found" });
        }

        const teacher = result.rows[0];

        res.json({
            profile: {
                name: teacher.name,
                id_code: teacher.id,
                email: teacher.email,
                subject: teacher.subject
            }
        })


    } catch (e) {
        console.error(e);
        return res.status(500).json({ message: "server error/dashboard error" })
    }
}

async function addStudent(req, res) {
    try {
        if (!req.user) {
            return res.status(400).json({ error: 'user not found' });
        }
        if (req.user.role !== "TEACHER") {
            return res.status(403).json({ message: "Access denied" });
        }
        const { name, email, password, subject, roll_num } = req.body;

        if (!name || !password || !email || !subject || !roll_num) {
            return res.status(400).json({ message: "required all fields" })
        }
        if (!email.includes("@")) {
            return res.status(400).json({ message: "Invalid email format" });
        }

        const isuserExist = await pool.query('select 1 from users where email = $1', [email]);
        if (isuserExist.rows.length > 0) {
            return res.status(400).json({
                message: "user already exists"
            });
        }

        const isstudentExist = await pool.query('select 1 from student where roll_num = $1', [roll_num]);
        if (isstudentExist.rows.length > 0) {
            return res.status(400).json({
                message: "student already exists with this roll number"
            });
        }

        const password_hash = await bcrypt.hash(password, 10);

        const role = 'STUDENT';
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('insert into users(name,email, password_hash, role) values($1, $2, $3, $4)', [name, email, password_hash, role]);
            await client.query("insert into student (name, email, subject, roll_num) values($1,$2, $3, $4)", [name, email, subject, roll_num]);
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            console.error(e);
            return res.status(500).json({ message: "database error" });
        } finally {
            client.release();
        }

        // const token = jwt.sign({ email: email }, process.env.JWT_SECRET, { expiresIn: '1d' });

        // res.cookie("token", token, cookieOption);

        return res.status(201).json({ message: "register successful" });


    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Internal server error" });
    }
}

async function stats(req, res) {
    try {
        if (!req.user) {
            return res.status(400).json({ error: 'user not found' });
        }
        if (req.user.role !== "TEACHER") {
            return res.status(403).json({ message: "Access denied" });
        }
        let total_student = 0;
        const result = await pool.query('select count(*) as count from student ');
        total_student = parseInt(result.rows[0].count);
        const today = new Date().toISOString().split('T')[0];

        let present = 0;
        let absent = 0;

        const presentResult = await pool.query('select count(*) as count from attendance where date= $1 and status = $2', [today, 'PRESENT']);

        present = parseInt(presentResult.rows[0].count);

        absent = total_student - present;

        res.status(200).json({
            total_student,
            present,
            absent,

        });


    } catch (err) {
        console.error('Dashboard stats error:', err)
        res.status(500).json({ error: 'Server error' })

    };

}


module.exports = { teacherDetails, addStudent, stats };