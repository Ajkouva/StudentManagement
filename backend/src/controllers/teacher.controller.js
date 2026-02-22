const pool = require('../db/db');
const bcrypt = require('bcryptjs');
// require('dotenv').config();


async function teacherDetails(req, res) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
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
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (req.user.role !== "TEACHER") {
            return res.status(403).json({ message: "Access denied" });
        }
        const { name, email, password, subject, roll_num } = req.body;

        if (!name || !password || !email || !subject || !roll_num) {
            return res.status(400).json({ message: "required all fields" })
        }

        // Input sanitization
        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();
        const cleanSubject = subject.trim();

        // Robust Email Regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleanEmail)) {
            return res.status(400).json({ message: "Invalid email format" });
        }

        if (cleanName.length > 50 || cleanSubject.length > 50) {
            return res.status(400).json({ message: "Name and Subject must be less than 50 characters" });
        }
        if (password.length < 8) {
            return res.status(400).json({ message: "Password must be at least 8 characters long" });
        }
        // Bug fix: coerce to int first so both "5" (string) and 5 (number) are accepted
        const parsedRollNum = parseInt(roll_num, 10);
        if (isNaN(parsedRollNum) || parsedRollNum <= 0) {
            return res.status(400).json({ message: "Roll number must be a positive integer" });
        }

        const password_hash = await bcrypt.hash(password, 10);

        const role = 'STUDENT';
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            // Removed manual check to avoid race condition constraint
            await client.query('insert into users(name,email, password_hash, role) values($1, $2, $3, $4)', [cleanName, cleanEmail, password_hash, role]);
            await client.query("insert into student (name, email, subject, roll_num) values($1,$2, $3, $4)", [cleanName, cleanEmail, cleanSubject, parsedRollNum]);
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            // Handle Unique Constraint Violation INSIDE the transaction catch
            if (e.code === '23505') {
                if (e.detail.includes('email')) {
                    return res.status(400).json({ message: "Student with this email already exists" });
                }
                if (e.detail.includes('roll_num')) {
                    return res.status(400).json({ message: "Student with this roll number already exists" });
                }
            }
            console.error(e);
            return res.status(500).json({ message: "database error" });
        } finally {
            client.release();
        }

        return res.status(201).json({ message: "register successful" });

    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Internal server error" });
    }
}

async function stats(req, res) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (req.user.role !== "TEACHER") {
            return res.status(403).json({ message: "Access denied" });
        }

        // Fetch teacher's subject to scope the stats
        const teacherRes = await pool.query('SELECT subject FROM teacher WHERE email = $1', [req.user.email]);
        if (teacherRes.rows.length === 0) {
            return res.status(404).json({ error: "Teacher profile not found" });
        }
        const teacherSubject = teacherRes.rows[0].subject;

        // Bug fix: removed unnecessary BEGIN/COMMIT transaction — these are read-only SELECTs
        const totalRes = await pool.query(
            'SELECT COUNT(*) as count FROM student WHERE LOWER(subject) = LOWER($1)',
            [teacherSubject]
        );
        const total_student = parseInt(totalRes.rows[0].count, 10);

        const today = new Date().toISOString().split('T')[0];

        const presentRes = await pool.query(`
            SELECT COUNT(*) as count 
            FROM attendance a
            JOIN student s ON a.student_id = s.id
            WHERE a.date = $1 AND a.status = $2 AND LOWER(s.subject) = LOWER($3)
        `, [today, 'PRESENT', teacherSubject]);

        const present = parseInt(presentRes.rows[0].count, 10);

        let absent = total_student - present;
        if (absent < 0) absent = 0;

        res.status(200).json({
            subject: teacherSubject,
            total_student,
            present,
            absent,
        });

    } catch (err) {
        console.error('Dashboard stats error:', err);
        res.status(500).json({ error: 'Server error' });
    };
}


async function markAttendance(req, res) {
    // 1. Crash Prevention: Check req.user exists
    if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    // 2. Role Check
    if (req.user.role !== "TEACHER") {
        return res.status(403).json({ message: "Access denied" });
    }

    const { date, records } = req.body;
    if (!date || !records || !Array.isArray(records)) {
        return res.status(400).json({ error: 'Invalid request body' });
    }

    // Limit records to prevent DOS
    if (records.length > 200) {
        return res.status(400).json({ error: 'Too many records in one request (limit 200)' });
    }

    // Validate date format YYYY-MM-DD AND real date
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date) || isNaN(new Date(date).getTime())) {
        return res.status(400).json({ error: 'Invalid date format or value. Use YYYY-MM-DD' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Fetch teacher's subject to scope the attendance (Moved inside try/catch for safety)
        const teacherRes = await client.query('SELECT subject FROM teacher WHERE email = $1', [req.user.email]);
        if (teacherRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Teacher profile not found" });
        }
        const teacherSubject = teacherRes.rows[0].subject;

        let markedCount = 0;
        let skippedCount = 0;
        const skippedDetails = [];

        // Bug fix: use entries() to track index in O(1) instead of indexOf() which is O(n²)
        for (const [recordIndex, record] of records.entries()) {
            // Handle both id and student_id
            const studentId = record.student_id || record.id;
            // Normalize status to uppercase to handle 'present', 'Present', etc.
            const status = record.status ? record.status.toUpperCase() : null;

            const validStatuses = ['PRESENT', 'ABSENT', 'LATE', 'LEAVE'];
            if (!studentId || !status || !validStatuses.includes(status)) {
                skippedCount++;
                skippedDetails.push({ record, reason: "Missing ID or invalid status" });
                console.warn(`Skipping invalid record: ${JSON.stringify(record)}`);
                continue;
            }

            // Check if student exists AND belongs to teacher's subject (Case Insensitive)
            // This prevents teachers from marking attendance for students they don't teach
            const studentCheck = await client.query('SELECT 1 FROM student WHERE id = $1 AND LOWER(subject) = LOWER($2)', [studentId, teacherSubject]);
            if (studentCheck.rows.length === 0) {
                skippedCount++;
                // Security: Don't echo back the exact ID if not found, just generic reason
                skippedDetails.push({ recordIndex, reason: "Student ID not found or not in your subject" });
                console.warn(`Skipping (student not found/wrong subject): ${studentId}`);
                continue;
            }

            const query = `
            insert into attendance(student_id,date,status)
            values($1,$2,$3)
            on conflict (student_id,date) do update
            set status = excluded.status`;

            await client.query(query, [studentId, date, status]);
            markedCount++;
        }

        await client.query('COMMIT');

        // Return detailed response
        res.json({
            message: 'Attendance processing completed',
            summary: {
                total: records.length,
                marked: markedCount,
                skipped: skippedCount
            },
            skippedDetails: skippedCount > 0 ? skippedDetails : undefined
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Mark attendance error:', err);
        // Return 400 for bad requests (like foreign key violation) or 500 for server errors
        // Check for specific Postgres error codes if needed, e.g. 23503 (foreign_key_violation)
        if (err.code === '23503') {
            return res.status(400).json({ error: 'Foreign key violation: Student ID does not exist', details: err.detail });
        }
        res.status(500).json({ error: 'Server error', details: err.message });
    }
    finally {
        client.release();
    }

}


module.exports = { teacherDetails, addStudent, stats, markAttendance };