-- Clean slate first
DROP TABLE IF EXISTS teacher, student, users CASCADE;
CREATE TYPE attendance_status AS ENUM ('PRESENT', 'ABSENT', 'HOLIDAY');
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
	name VARCHAR(50) NOT NULL,
    email VARCHAR(50) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    role VARCHAR(20) DEFAULT 'TEACHER' NOT NULL
);

create table attendance(
	id serial primary key,
	date DATE not null,
	status attendance_status not null	
);
select count(*) as count from student;
select count(*) as count from attendance where date= current_date and status = 'PRESENT';
INSERT INTO attendance (date, status) VALUES 
('2026-02-19', 'PRESENT'),
('2026-02-18', 'ABSENT'),
('2026-02-18', 'HOLIDAY'),
('2026-02-18', 'PRESENT'),
('2026-02-18', 'PRESENT'),
('2026-02-18', 'PRESENT'),
('2026-02-18', 'ABSENT');



ALTER TABLE users RENAME COLUMN user_role TO role;

CREATE TABLE student (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(50) NOT NULL UNIQUE REFERENCES users(email),
	subject varchar(50),
	roll_num int,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE teacher (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(50) NOT NULL UNIQUE REFERENCES users(email),
    subject VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- View empty tables
SELECT * FROM users;
SELECT * FROM student;
SELECT * FROM teacher;
select * from attendance;

-- Delete ALL data (better than simple DELETE for your use case)
TRUNCATE TABLE student, users, teacher,attendance RESTART IDENTITY CASCADE;

