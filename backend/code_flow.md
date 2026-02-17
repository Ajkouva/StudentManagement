# Backend Code Flow — Student Management System

## Architecture Overview

```mermaid
graph LR
    Client["Frontend :5500"] -->|HTTP Request| Server["server.js :3000"]
    Server --> App["app.js"]
    App --> MW["Middleware Stack"]
    MW --> Routes["Route Files"]
    Routes --> Controllers["Controller Functions"]
    Controllers --> DB["PostgreSQL DB"]
```

---

## Server Startup Flow

```mermaid
sequenceDiagram
    participant S as server.js
    participant D as dotenv
    participant A as app.js
    participant DB as db.js (Pool)
    participant PG as PostgreSQL

    S->>D: require('dotenv').config()
    Note over D: Loads .env variables into process.env
    S->>A: require('./src/app')
    A->>DB: require('./db/db')
    DB->>PG: new pg.Pool({user, host, database, password, port})
    Note over DB,PG: Pool created, connections established on first query
    S->>S: app.listen(3000)
    Note over S: "Server is running on port 3000"
```

---

## Middleware Stack (runs on every request)

Every incoming request passes through these layers **in order** before reaching any route:

```mermaid
graph TD
    REQ["Incoming Request"] --> CORS
    CORS["cors() — allows localhost:5500 with credentials"] --> JSON
    JSON["express.json({limit: 10kb}) — parse body, reject if > 10KB"] --> COOKIE
    COOKIE["cookie-parser() — parse cookies into req.cookies"] --> ROUTE
    ROUTE["Route Matching"]
```

---

## Route Map

| Method | Full URL | Middleware | Controller | Purpose |
|--------|----------|-----------|------------|---------|
| `POST` | `/api/auth/register` | `limiter` | `auth.register` | Register teacher |
| `POST` | `/api/auth/login` | `limiter` | `auth.login` | Login user |
| `GET` | `/api/auth/me` | `limiter` → `protect` | `auth.me` | Get current user |
| `GET` | `/api/auth/logout` | `limiter` → `protect` | `auth.logout` | Logout user |
| `GET` | `/api/student/studentDetails` | `protect` | `student.studentDetails` | Get student profile |
| `GET` | `/api/teacher/teacherDetails` | `protect` | `teacher.teacherDetails` | Get teacher profile |
| `POST` | `/api/teacher/addStudent` | `protect` | `teacher.addStudent` | Add a student |

---

## Flow 1: Teacher Registration (`POST /api/auth/register`)

```mermaid
sequenceDiagram
    participant C as Client
    participant L as Rate Limiter
    participant R as register()
    participant DB as PostgreSQL
    participant JWT as JWT

    C->>L: POST /api/auth/register {name, email, password, subject}
    L->>L: Check: requests from this IP < 10 in 15min?
    alt Rate limit exceeded
        L-->>C: 429 "too many requests"
    end
    L->>R: Pass request

    R->>R: Validate: all fields present?
    alt Missing fields
        R-->>C: 400 "required all fields"
    end

    R->>R: Validate: email contains "@"?
    alt Invalid email
        R-->>C: 400 "Invalid email format"
    end

    R->>DB: SELECT * FROM users WHERE email = $1
    alt User exists
        R-->>C: 400 "user already exists"
    end

    R->>R: bcrypt.hash(password, 10)

    Note over R,DB: BEGIN TRANSACTION
    R->>DB: INSERT INTO users (name, email, password_hash, role='TEACHER')
    R->>DB: INSERT INTO teacher (name, email, subject)
    Note over R,DB: COMMIT (or ROLLBACK on error)

    R->>JWT: jwt.sign({email, role}, secret, {expiresIn: '1d'})
    JWT-->>R: token

    R->>C: Set-Cookie: token=xxx (httpOnly, sameSite=lax)
    R-->>C: 201 "register successful"
```

---

## Flow 2: Login (`POST /api/auth/login`)

```mermaid
sequenceDiagram
    participant C as Client
    participant L as Rate Limiter
    participant LG as login()
    participant DB as PostgreSQL
    participant BC as bcrypt
    participant JWT as JWT

    C->>L: POST /api/auth/login {email, password}
    L->>LG: Pass request (if under limit)

    LG->>LG: Validate fields & email format

    LG->>DB: SELECT id,name,email,role,password_hash FROM users WHERE email=$1
    alt No user found
        LG-->>C: 400 "wrong email or password"
    end

    LG->>BC: bcrypt.compare(password, user.password_hash)
    alt Password doesn't match
        LG-->>C: 400 "wrong email or password"
    end
    Note over LG: Same error message for both cases (prevents enumeration)

    LG->>JWT: jwt.sign({email, role}, secret, {expiresIn: '1d'})
    LG->>C: Set-Cookie: token=xxx
    LG-->>C: 200 {user: {id, name, email, role}}
```

---

## Flow 3: Protected Route Access (e.g. `GET /api/student/studentDetails`)

```mermaid
sequenceDiagram
    participant C as Client
    participant P as protect middleware
    participant SC as studentDetails()
    participant DB as PostgreSQL

    C->>P: GET /api/student/studentDetails (Cookie: token=xxx)
    P->>P: Extract token from req.cookies.token
    alt No token
        P-->>C: 401 "No token, authorization denied"
    end

    P->>P: jwt.verify(token, JWT_SECRET)
    alt Invalid/expired token
        P-->>C: 401 "invalid token"
    end

    P->>P: req.user = decoded (contains {email, role})
    P->>SC: next()

    SC->>SC: Check: req.user.role === "STUDENT"?
    alt Not a student
        SC-->>C: 403 "Access denied"
    end

    SC->>DB: SELECT id,name,email,subject,roll_num FROM student WHERE email=$1
    alt Not found
        SC-->>C: 404 "Student profile not found"
    end
    SC-->>C: 200 {profile: {name, id_code, subject, roll_no, email}}
```

---

## Flow 4: Add Student (`POST /api/teacher/addStudent`)

```mermaid
sequenceDiagram
    participant C as Client
    participant P as protect middleware
    participant AS as addStudent()
    participant DB as PostgreSQL

    C->>P: POST /api/teacher/addStudent (Cookie: token=xxx)
    P->>P: Verify JWT → req.user = {email, role}
    P->>AS: next()

    AS->>AS: Check: req.user.role === "TEACHER"?
    alt Not a teacher
        AS-->>C: 403 "Access denied"
    end

    AS->>AS: Validate all fields + email format
    AS->>DB: SELECT 1 FROM users WHERE email=$1
    alt Already exists
        AS-->>C: 400 "user already exists"
    end

    AS->>AS: bcrypt.hash(password, 10)

    Note over AS,DB: BEGIN TRANSACTION
    AS->>DB: INSERT INTO users (role='STUDENT')
    AS->>DB: INSERT INTO student (name, email, subject, roll_num)
    Note over AS,DB: COMMIT (or ROLLBACK)

    AS-->>C: 201 "register successful"
```

---

## Flow 5: Logout (`GET /api/auth/logout`)

```mermaid
sequenceDiagram
    participant C as Client
    participant P as protect middleware
    participant LO as logout()

    C->>P: GET /api/auth/logout (Cookie: token=xxx)
    P->>P: Verify JWT
    P->>LO: next()

    LO->>C: Set-Cookie: token="" (maxAge: 1ms)
    Note over LO: Cookie expires immediately on client
    Note over LO: ⚠️ JWT itself is still valid until expiry
    LO-->>C: 200 "Logged out successfully"
```

---

## Database Schema (implied from queries)

```mermaid
erDiagram
    USERS {
        int id PK
        string name
        string email UK
        string password_hash
        string role "TEACHER | STUDENT"
    }

    TEACHER {
        int id PK
        string name
        string email UK
        string subject
    }

    STUDENT {
        int id PK
        string name
        string email UK
        string subject
        string roll_num
    }

    USERS ||--o| TEACHER : "role=TEACHER"
    USERS ||--o| STUDENT : "role=STUDENT"
```

---

## File Dependency Graph

```mermaid
graph TD
    SRV["server.js"] --> APP["app.js"]
    SRV --> ENV[".env (dotenv)"]

    APP --> AR["routes/auth.routes.js"]
    APP --> SR["routes/student.routes.js"]
    APP --> TR["routes/teacher.routes.js"]
    APP --> LIM["middleware/auth.limiter.js"]

    AR --> AC["controllers/auth.controller.js"]
    AR --> PRO["middleware/auth.protect.js"]

    SR --> SC["controllers/student.controller.js"]
    SR --> PRO

    TR --> TC["controllers/teacher.controller.js"]
    TR --> PRO

    AC --> DB["db/db.js"]
    SC --> DB
    TC --> DB

    DB --> PG["PostgreSQL"]
```
