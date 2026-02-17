# Student Management System

A full-stack web application for managing students and teachers with role-based authentication.

## Tech Stack

- **Backend:** Node.js, Express 5, PostgreSQL
- **Auth:** JWT (httpOnly cookies), bcrypt
- **Frontend:** HTML, CSS, JavaScript

## Features

- 🔐 Secure cookie-based authentication (JWT)
- 👨‍🏫 Teacher registration & login
- 👨‍🎓 Student management (added by teachers)
- 🛡️ Role-based access control (TEACHER / STUDENT)
- ⏱️ Rate limiting on auth routes
- 🔄 Database transactions for data integrity

## Project Structure

```
studentManagement/
├── backend/
│   ├── server.js              # Entry point
│   ├── package.json
│   └── src/
│       ├── app.js             # Express app setup
│       ├── db/db.js           # PostgreSQL connection pool
│       ├── middleware/
│       │   ├── auth.protect.js    # JWT verification
│       │   └── auth.limiter.js    # Rate limiting
│       ├── routes/
│       │   ├── auth.routes.js
│       │   ├── student.routes.js
│       │   └── teacher.routes.js
│       └── controllers/
│           ├── auth.controller.js
│           ├── student.controller.js
│           └── teacher.controller.js
├── frontend/
│   └── teacherDashboard/
└── API_DOCUMENTATION.md       # Full API reference
```

## Getting Started

### Clone the Project

```bash
git clone https://github.com/Ajkouva/StudentManagement.git
cd StudentManagement
```

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [PostgreSQL](https://www.postgresql.org/) (v14+)

### 1. Setup Database

Create a PostgreSQL database and run:

```sql
-- Clean slate first
DROP TABLE IF EXISTS teacher, student, users CASCADE;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
	name VARCHAR(50) NOT NULL,
    email VARCHAR(50) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    role VARCHAR(20) DEFAULT 'TEACHER' NOT NULL
);

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

-- Delete ALL data (better than simple DELETE for your use case)
TRUNCATE TABLE student, users, teacher RESTART IDENTITY CASCADE;

```

### 2. Configure Environment

Create `backend/.env`:

```
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=studentManagement
PORT=3000
JWT_SECRET=your_secret_key_here
```

### 3. Install & Run

```bash
cd backend
npm install
npm start
```

Server runs at `http://localhost:3000`

## API Endpoints

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/api/auth/register` | ❌ | — | Register teacher |
| POST | `/api/auth/login` | ❌ | — | Login |
| GET | `/api/auth/me` | ✅ | Any | Get current user |
| GET | `/api/auth/logout` | ✅ | Any | Logout |
| GET | `/api/student/studentDetails` | ✅ | STUDENT | Get student profile |
| GET | `/api/teacher/teacherDetails` | ✅ | TEACHER | Get teacher profile |
| POST | `/api/teacher/addStudent` | ✅ | TEACHER | Add a student |

📖 See [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for full details with code examples.

## License

ISC
