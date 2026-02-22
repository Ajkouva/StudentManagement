-- Clean slate first
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS student CASCADE;
DROP TABLE IF EXISTS teacher CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TYPE IF EXISTS attendance_status;

CREATE TYPE attendance_status AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'LEAVE');

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
	name VARCHAR(50) NOT NULL,
    email VARCHAR(50) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    role VARCHAR(20) DEFAULT 'TEACHER' NOT NULL
);

CREATE TABLE student (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    email VARCHAR(50) NOT NULL UNIQUE REFERENCES users(email) ON DELETE CASCADE,
	subject varchar(50) NOT NULL,
	roll_num int UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE teacher (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(50) NOT NULL UNIQUE REFERENCES users(email) ON DELETE CASCADE,
    -- Bug fix: subject must be NOT NULL; stats and markAttendance use it for filtering
    -- and would silently return 0 results if a teacher has no subject.
    subject VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE attendance (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES student(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status attendance_status NOT NULL,
    UNIQUE(student_id, date)
);

-- Insert Dummy Data (Users first, then specific roles, then attendance)
-- Note: Passwords here are placeholders. In real app, they must be hashed. 
-- Assuming these are just for testing logic or DB constraints.

-- 1. Users
INSERT INTO users (name, email, password_hash, role) VALUES
-- ⚠️  BUG: password_hash values below are plain text, NOT real bcrypt hashes.
-- These users CANNOT log in via the API (bcrypt.compare will always return false).
-- For functional login testing, replace these with actual bcrypt hashes or run a separate seed script.
('Aman Verma', 'aman@gmail.com', 'hashed_pass_1', 'STUDENT'),
('Riya Sharma', 'riya@gmail.com', 'hashed_pass_2', 'STUDENT'),
('Karan Singh', 'karan@gmail.com', 'hashed_pass_3', 'STUDENT'),
('Neha Gupta', 'neha@gmail.com', 'hashed_pass_4', 'STUDENT'),
('Arjun Patel', 'arjun@gmail.com', 'hashed_pass_5', 'STUDENT'),
('Amit Sir', 'amit@gmail.com', 'hashed_pass_teacher', 'TEACHER');

-- 2. Teacher
INSERT INTO teacher (name, email, subject) VALUES
('Amit Sir', 'amit@gmail.com', 'Computer Science');

-- 3. Students references users(email)
INSERT INTO student (name, email, subject, roll_num) VALUES
('Aman Verma', 'aman@gmail.com', 'Computer Science', 101),
('Riya Sharma', 'riya@gmail.com', 'Mathematics', 102),
('Karan Singh', 'karan@gmail.com', 'Physics', 103),
('Neha Gupta', 'neha@gmail.com', 'Chemistry', 104),
('Arjun Patel', 'arjun@gmail.com', 'Biology', 105);

-- 3. Attendance
-- Note: Using subqueries to get IDs because exact IDs might vary if sequences aren't reset, 
-- but for dummy data script with clean slate, we can assume sequential IDs or use subqueries for robustness.
-- However, for simplicity in this script, assuming IDs 1-5 correspond to the insertion order.

INSERT INTO attendance (student_id, date, status) VALUES
(1, '2026-02-11', 'PRESENT'),
(1, '2026-02-12', 'ABSENT'),
(2, '2026-02-13', 'PRESENT'),
(2, '2026-02-14', 'ABSENT'),
(2, '2026-02-15', 'PRESENT'),
(3, '2026-02-11', 'PRESENT'),
(3, '2026-02-12', 'ABSENT'),
(3, '2026-02-13', 'PRESENT'),
(3, '2026-02-14', 'ABSENT'),
(3, '2026-02-15', 'PRESENT');


-- View data
SELECT * FROM users;
SELECT * FROM student;
SELECT * FROM teacher;
SELECT * FROM attendance;

-- Select specific attendance (using Join now)
SELECT TO_CHAR(a.date, 'YYYY-MM-DD') as date, a.status 
FROM attendance a
JOIN student s ON a.student_id = s.id
WHERE s.email='aman@gmail.com' 
ORDER BY a.date DESC;