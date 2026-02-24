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

        // Bug #2 fix: whitespace-only strings pass the !field check but trim to ""
        if (!cleanName || !cleanEmail || !cleanSubject) {
            return res.status(400).json({ message: "Fields cannot be blank or whitespace only" });
        }

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

        // Use CURRENT_DATE (DB-side) so the date is always correct regardless of server timezone
        const todayStatsRes = await pool.query(`
            SELECT
                COUNT(DISTINCT s.id)                                                  AS total_student,
                COUNT(a.id) FILTER (WHERE a.status = 'PRESENT')                      AS present,
                COUNT(a.id) FILTER (WHERE a.status = 'ABSENT')                       AS absent,
                COUNT(a.id) FILTER (WHERE a.status = 'LATE')                         AS late,
                COUNT(a.id) FILTER (WHERE a.status = 'LEAVE')                        AS on_leave,
                COUNT(DISTINCT s.id)
                    - COUNT(a.id) FILTER (WHERE a.date = CURRENT_DATE)               AS not_marked
            FROM student s
            LEFT JOIN attendance a
                ON a.student_id = s.id AND a.date = CURRENT_DATE
            WHERE LOWER(s.subject) = LOWER($1)
        `, [teacherSubject]);

        const row = todayStatsRes.rows[0];

        res.status(200).json({
            subject: teacherSubject,
            total_student: parseInt(row.total_student, 10),
            today: {
                present: parseInt(row.present, 10),
                absent: parseInt(row.absent, 10),
                late: parseInt(row.late, 10),
                on_leave: parseInt(row.on_leave, 10),
                not_marked: parseInt(row.not_marked, 10)
            }
        });

    } catch (err) {
        console.error('Dashboard stats error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}


async function markAttendance(req, res) {
    // 1. Crash Prevention: Check req.user exists
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
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

async function attendance75(req, res) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (req.user.role !== "TEACHER") {
            return res.status(403).json({ message: "Access denied" });
        }

        // Fetch teacher's subject from DB (don't trust req.user.subject directly)
        const teacherRes = await pool.query(
            'SELECT subject FROM teacher WHERE email = $1',
            [req.user.email]
        );
        if (teacherRes.rows.length === 0) {
            return res.status(404).json({ error: "Teacher profile not found" });
        }
        const teacherSubject = teacherRes.rows[0].subject;

        // Single query: all-time + current-month attendance stats per student, filter < 75% overall
        const result = await pool.query(`
            SELECT
                s.id,
                s.name,
                s.email,
                s.roll_num,

                -- All-time stats
                COUNT(a.id)                                                   AS total_classes,
                COUNT(a.id) FILTER (WHERE a.status = 'PRESENT')              AS present_count,
                ROUND(
                    COUNT(a.id) FILTER (WHERE a.status = 'PRESENT')::numeric
                    / NULLIF(COUNT(a.id), 0) * 100,
                    2
                )                                                             AS attendance_percentage,

                -- Current-month stats
                COUNT(a.id) FILTER (
                    WHERE DATE_TRUNC('month', a.date) = DATE_TRUNC('month', CURRENT_DATE)
                )                                                             AS month_total_classes,
                COUNT(a.id) FILTER (
                    WHERE a.status = 'PRESENT'
                      AND DATE_TRUNC('month', a.date) = DATE_TRUNC('month', CURRENT_DATE)
                )                                                             AS month_present_count,
                ROUND(
                    COUNT(a.id) FILTER (
                        WHERE a.status = 'PRESENT'
                          AND DATE_TRUNC('month', a.date) = DATE_TRUNC('month', CURRENT_DATE)
                    )::numeric
                    / NULLIF(
                        COUNT(a.id) FILTER (
                            WHERE DATE_TRUNC('month', a.date) = DATE_TRUNC('month', CURRENT_DATE)
                        ), 0
                    ) * 100,
                    2
                )                                                             AS month_percentage

            FROM student s
            LEFT JOIN attendance a ON a.student_id = s.id
            WHERE LOWER(s.subject) = LOWER($1)
            GROUP BY s.id, s.name, s.email, s.roll_num
            HAVING
                COUNT(a.id) = 0
                OR ROUND(
                    COUNT(a.id) FILTER (WHERE a.status = 'PRESENT')::numeric
                    / NULLIF(COUNT(a.id), 0) * 100,
                    2
                ) < 75
            ORDER BY attendance_percentage ASC NULLS FIRST
        `, [teacherSubject]);

        return res.status(200).json({
            subject: teacherSubject,
            count: result.rows.length,
            students: result.rows.map(row => ({
                id: row.id,
                name: row.name,
                email: row.email,
                roll_num: row.roll_num,

                // All-time
                total_classes: parseInt(row.total_classes, 10),
                present_count: parseInt(row.present_count, 10),
                attendance_percentage: row.attendance_percentage !== null
                    ? parseFloat(row.attendance_percentage)
                    : 0,

                // Current month
                current_month: {
                    total_classes: parseInt(row.month_total_classes, 10),
                    present_count: parseInt(row.month_present_count, 10),
                    attendance_percentage: row.month_percentage !== null
                        ? parseFloat(row.month_percentage)
                        : 0
                }
            }))
        });

    } catch (err) {
        console.error('attendance75 error:', err);
        return res.status(500).json({ error: 'Server error', details: err.message });
    }
}


async function attendanceDetails(req, res) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (req.user.role !== "TEACHER") {
            return res.status(403).json({ message: "Access denied" });
        }

        // Fetch teacher's subject
        const teacherRes = await pool.query(
            'SELECT subject FROM teacher WHERE email = $1',
            [req.user.email]
        );
        if (teacherRes.rows.length === 0) {
            return res.status(404).json({ error: "Teacher profile not found" });
        }
        const teacherSubject = teacherRes.rows[0].subject;

        // Optional ?month=YYYY-MM in query string, default = current month
        let monthStart;
        if (req.query.month) {
            const parsed = new Date(req.query.month + '-01');
            if (isNaN(parsed.getTime())) {
                return res.status(400).json({ error: 'Invalid month format. Use YYYY-MM' });
            }
            monthStart = req.query.month + '-01';
        } else {
            monthStart = null; // will use CURRENT_DATE in SQL
        }

        // Monthly attendance summary for every student in this subject
        const result = await pool.query(`
            SELECT
                s.id,
                s.name,
                s.email,
                s.roll_num,

                COUNT(a.id) FILTER (
                    WHERE DATE_TRUNC('month', a.date)
                        = DATE_TRUNC('month', COALESCE($2::date, CURRENT_DATE))
                )                                                           AS total_classes,

                COUNT(a.id) FILTER (
                    WHERE a.status = 'PRESENT'
                      AND DATE_TRUNC('month', a.date)
                        = DATE_TRUNC('month', COALESCE($2::date, CURRENT_DATE))
                )                                                           AS present_count,

                COUNT(a.id) FILTER (
                    WHERE a.status = 'ABSENT'
                      AND DATE_TRUNC('month', a.date)
                        = DATE_TRUNC('month', COALESCE($2::date, CURRENT_DATE))
                )                                                           AS absent_count,

                COUNT(a.id) FILTER (
                    WHERE a.status = 'LATE'
                      AND DATE_TRUNC('month', a.date)
                        = DATE_TRUNC('month', COALESCE($2::date, CURRENT_DATE))
                )                                                           AS late_count,

                COUNT(a.id) FILTER (
                    WHERE a.status = 'LEAVE'
                      AND DATE_TRUNC('month', a.date)
                        = DATE_TRUNC('month', COALESCE($2::date, CURRENT_DATE))
                )                                                           AS leave_count,

                ROUND(
                    COUNT(a.id) FILTER (
                        WHERE a.status = 'PRESENT'
                          AND DATE_TRUNC('month', a.date)
                            = DATE_TRUNC('month', COALESCE($2::date, CURRENT_DATE))
                    )::numeric
                    / NULLIF(
                        COUNT(a.id) FILTER (
                            WHERE DATE_TRUNC('month', a.date)
                                = DATE_TRUNC('month', COALESCE($2::date, CURRENT_DATE))
                        ), 0
                    ) * 100,
                    2
                )                                                           AS attendance_percentage

            FROM student s
            LEFT JOIN attendance a ON a.student_id = s.id
            WHERE LOWER(s.subject) = LOWER($1)
            GROUP BY s.id, s.name, s.email, s.roll_num
            ORDER BY s.roll_num ASC
        `, [teacherSubject, monthStart]);

        // Bug #6 fix: new Date().toISOString() is UTC — wrong month for IST users at end-of-month.
        // Use DB-side CURRENT_DATE which matches all other queries in this codebase.
        const labelRes = await pool.query(
            `SELECT TO_CHAR(COALESCE($1::date, CURRENT_DATE), 'YYYY-MM') AS label`,
            [monthStart]
        );
        const monthLabel = labelRes.rows[0].label;

        return res.status(200).json({
            subject: teacherSubject,
            month: monthLabel,
            count: result.rows.length,
            students: result.rows.map(row => ({
                id: row.id,
                name: row.name,
                email: row.email,
                roll_num: row.roll_num,
                total_classes: parseInt(row.total_classes, 10),
                present_count: parseInt(row.present_count, 10),
                absent_count: parseInt(row.absent_count, 10),
                late_count: parseInt(row.late_count, 10),
                leave_count: parseInt(row.leave_count, 10),
                attendance_percentage: row.attendance_percentage !== null
                    ? parseFloat(row.attendance_percentage)
                    : 0
            }))
        });

    } catch (err) {
        console.error('attendanceDetails error:', err);
        return res.status(500).json({ error: 'Server error', details: err.message });
    }
}

async function deleteStudent(req, res) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (req.user.role !== "TEACHER") {
            return res.status(403).json({ message: "Access denied" });
        }

        const studentId = parseInt(req.params.id, 10);
        if (isNaN(studentId) || studentId <= 0) {
            return res.status(400).json({ error: 'Invalid student ID' });
        }

        // Fetch teacher's subject so we only allow deleting their own students
        const teacherRes = await pool.query(
            'SELECT subject FROM teacher WHERE email = $1',
            [req.user.email]
        );
        if (teacherRes.rows.length === 0) {
            return res.status(404).json({ error: 'Teacher profile not found' });
        }
        const teacherSubject = teacherRes.rows[0].subject;

        // Verify student exists AND belongs to this teacher's subject
        const studentRes = await pool.query(
            'SELECT id, email FROM student WHERE id = $1 AND LOWER(subject) = LOWER($2)',
            [studentId, teacherSubject]
        );
        if (studentRes.rows.length === 0) {
            return res.status(404).json({ error: 'Student not found or not in your subject' });
        }
        const studentEmail = studentRes.rows[0].email;

        // Delete from both tables in a transaction so login is also revoked
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Delete attendance rows first to avoid FK violations
            await client.query('DELETE FROM attendance WHERE student_id = $1', [studentId]);
            await client.query('DELETE FROM student WHERE id = $1', [studentId]);
            await client.query('DELETE FROM users WHERE email = $1', [studentEmail]);

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        return res.status(200).json({
            message: 'Student deleted successfully. Login access revoked.',
            deleted: { id: studentId, email: studentEmail }
        });

    } catch (err) {
        console.error('deleteStudent error:', err);
        return res.status(500).json({ error: 'Server error', details: err.message });
    }
}


module.exports = { teacherDetails, addStudent, stats, markAttendance, attendance75, attendanceDetails, deleteStudent };