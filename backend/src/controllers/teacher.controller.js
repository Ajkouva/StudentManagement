const pool = require('../db/db');
const bcrypt = require('bcryptjs');
// require('dotenv').config();


async function teacherDetails(req, res) {
    if (req.user.role !== "TEACHER") {
        return res.status(403).json({ message: "Access denied" });
    }
    const email = req.user.email;
    if (!email) {
        return res.status(400).json({ error: "User email required" });
    }
    try {
        const result = await pool.query('select id, name, email, subject  from teacher where email = $1', [email]);

        if ((result).rows.length === 0) {
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


module.exports = { teacherDetails, addStudent };