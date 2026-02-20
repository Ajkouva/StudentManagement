const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require("../db/db");
// require('dotenv').config();

const cookie = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 24 * 60 * 60 * 1000,
}

//register user
async function register(req, res) {
    try {
        const { name, email, password, subject } = req.body;

        if (!name || !password || !email || !subject) {
            return res.status(400).json({ message: "required all fields" })
        }

        // Sanitize inputs
        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();
        const cleanSubject = subject.trim();

        // Robust Email Regex explanation: ^[^\s@]+@[^\s@]+\.[^\s@]+$ matches generic email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleanEmail)) {
            return res.status(400).json({ message: "Invalid email format" });
        }
        if (password.length < 8) {
            return res.status(400).json({ message: "Password must be at least 8 characters long" });
        }
        if (cleanName.length > 50 || cleanSubject.length > 50) {
            return res.status(400).json({ message: "Name and Subject must be less than 50 characters" });
        }


        const isuserExist = await pool.query('select 1 from users where email = $1', [cleanEmail]);
        if (isuserExist.rows.length > 0) {
            return res.status(400).json({
                message: "user already exists"
            });
        }

        const password_hash = await bcrypt.hash(password, 10);

        // const validRole = ['TEACHER'];
        // if (!validRole.includes(role)) {
        //     return res.status(400).json({ error: "invalid role" });
        // }

        const role = 'TEACHER';
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            // Use sanitized values
            await client.query('INSERT INTO users(name, email, password_hash, role) VALUES($1, $2, $3, $4)', [cleanName, cleanEmail, password_hash, role]);
            await client.query('INSERT INTO teacher(name, email, subject) VALUES($1, $2, $3)', [cleanName, cleanEmail, cleanSubject]);
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            // Handle Unique Constraint Violation (e.g. email already exists)
            if (e.code === '23505') {
                return res.status(400).json({ message: "User with this email already exists" });
            }
            console.error(e);
            return res.status(500).json({ message: "database error" });
        } finally {
            client.release();
        }

        const token = jwt.sign({ email: cleanEmail, role: role }, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.cookie("token", token, cookie);

        return res.status(201).json({ message: "register successful" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error" });
    }
}


//login
async function login(req, res) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "required all fields" })
        }

        const cleanEmail = email.trim().toLowerCase();
        // Robust Email Regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(cleanEmail)) {
            return res.status(400).json({ message: "Invalid email format" });
        }

        const isuserExist = await pool.query('select id,name,email,role,password_hash from users where email=$1', [cleanEmail]);

        if (isuserExist.rows.length === 0) {
            return res.status(400).json({ message: "wrong email or password" });
        }

        const user = isuserExist.rows[0];
        const ismatch = await bcrypt.compare(password, user.password_hash);

        if (!ismatch) {
            return res.status(400).json({ message: "wrong email or password" });
        }
        const token = jwt.sign(
            { email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' }
        );

        res.cookie("token", token, cookie);

        res.status(200).json({
            message: "login successfully",
            user: {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "role": user.role
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error" });
    }

};

async function me(req, res) {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        let user = await pool.query('select id,name,email,role from users where email=$1', [req.user.email]);

        user = user.rows[0]
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json({
            message: "details fetched successfully",
            user: {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "role": user.role
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error" });
    }
}

async function logout(req, res) {
    try {
        res.cookie("token", "", { ...cookie, maxAge: 1 });
        res.json({ message: "Logged out successfully " })
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error" });
    }
}


module.exports = { register, login, me, logout };