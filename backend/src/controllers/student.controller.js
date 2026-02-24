const pool = require("../db/db");
// require('dotenv').config();

async function studentDetails(req, res) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        if (req.user.role !== "STUDENT") {
            return res.status(403).json({ message: "Access denied" });
        }
        const email = req.user.email;

        const result = await pool.query('select id, name, email, subject, roll_num from student where email = $1', [email]);

        if (result.rows.length === 0) {
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

            }
        })
    } catch (e) {
        console.error('Dashboard error:', e);
        res.status(500).json({ error: 'Server error' });
    }
}


async function attendanceCalendar(req, res) {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    if (req.user.role !== "STUDENT") {
        return res.status(403).json({ message: "Access denied" });
    }
    const userEmail = req.user.email;
    if (!userEmail) {
        return res.status(400).json({ error: "User email required" });
    }

    const { month, year } = req.body;
    if (!month || !year) {
        return res.status(400).json({ error: "Month and year required" });
    }

    // Bug #1 fix: parse to integers and validate before passing to DB
    const parsedMonth = parseInt(month, 10);
    const parsedYear = parseInt(year, 10);
    if (isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12 ||
        isNaN(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
        return res.status(400).json({ error: "Invalid month or year value" });
    }

    try {
        // Bug #1 fix: use DB-side MAKE_DATE so no JS timezone drift
        const attendanceQuery = `
            SELECT TO_CHAR(a.date, 'YYYY-MM-DD') as date, a.status
            FROM attendance a
            JOIN student s ON a.student_id = s.id
            WHERE s.email = $1
              AND DATE_TRUNC('month', a.date) = MAKE_DATE($2, $3, 1)
            ORDER BY a.date DESC
        `;
        const attendanceResult = await pool.query(attendanceQuery, [userEmail, parsedYear, parsedMonth]);


        // Map status to color for frontend calendar display
        const coloredRows = attendanceResult.rows.map(row => ({
            date: row.date,
            status: row.status,
            color: row.status === 'PRESENT' ? 'green' :
                (row.status === 'ABSENT' ? 'red' : 'grey')
        }));

        const totalAttendance = attendanceResult.rows.length;
        const presentAttendance = attendanceResult.rows.filter(row => row.status === 'PRESENT').length;
        const absentAttendance = attendanceResult.rows.filter(row => row.status === 'ABSENT').length;

        // Guard against division by zero when student has no attendance records
        // Bug #5 fix: round to avoid raw floats like 33.3333...
        const presentPercentage = totalAttendance > 0 ? Math.round((presentAttendance / totalAttendance) * 100) : 0;
        const absentPercentage = totalAttendance > 0 ? Math.round((absentAttendance / totalAttendance) * 100) : 0;

        res.json({
            coloredRows,
            attendance: {
                totalAttendance,
                presentAttendance,
                absentAttendance,
                presentPercentage,
                absentPercentage
            }
        });

    } catch (e) {
        console.error("Attendance calendar error: ", e);
        res.status(500).json({ error: "Server error" });
    }
}

module.exports = { studentDetails, attendanceCalendar };