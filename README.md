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
CREATE DATABASE studentManagement;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(10) DEFAULT 'TEACHER'
);

CREATE TABLE teacher (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    subject VARCHAR(100) NOT NULL
);

CREATE TABLE student (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    subject VARCHAR(100) NOT NULL,
    roll_num VARCHAR(20) NOT NULL
);
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
