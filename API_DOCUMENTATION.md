# API Documentation — Student Management System

> **Base URL:** `http://localhost:3000`
> **Frontend Dev Origins (CORS):** `http://localhost:5173`, `http://127.0.0.1:5173`

---

## Authentication

All protected routes (🔒) require a valid JWT cookie. The browser handles this automatically — you just need `credentials: "include"` on every request.

```js
fetch("http://localhost:3000/api/...", {
    method: "POST",
    credentials: "include",           // ← REQUIRED for cookie auth
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ... })
});
```

> ❌ Without `credentials: "include"`, every protected route returns `401`.

---

## Auth Flow

```
POST /api/auth/login  →  200 + Set-Cookie: token=xxx (httpOnly, 1 day)
GET  /api/student/*   →  Cookie sent automatically by browser
POST /api/auth/logout →  200 + Set-Cookie: token="" (expired)
```

---

## Rate Limits

| Route Group | Limit |
|-------------|-------|
| `/api/auth/*` | 10 requests / 15 min |
| `/api/student/*` | 100 requests / 15 min |
| `/api/teacher/*` | 100 requests / 15 min |

Exceeding the limit returns **`429 Too Many Requests`**:
```json
{ "message": "too many request please try after 15 minutes" }
```

---

## Endpoints

---

### Auth Routes — `/api/auth`

---

#### `POST /api/auth/register`
Register a new teacher account.

**Request Body**

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | Required, max 50 chars |
| `email` | string | Required, valid email format |
| `password` | string | Required, min 8 chars |
| `subject` | string | Required, max 50 chars |

**Responses**

| Status | Body | Condition |
|--------|------|-----------|
| `201 Created` | `{ "message": "register successful" }` | Account created, JWT cookie set |
| `400 Bad Request` | `{ "message": "required all fields" }` | Missing field(s) |
| `400 Bad Request` | `{ "message": "Invalid email format" }` | Bad email |
| `400 Bad Request` | `{ "message": "Password must be at least 8 characters long" }` | Password too short |
| `400 Bad Request` | `{ "message": "Name and Subject must be less than 50 characters" }` | Field too long |
| `400 Bad Request` | `{ "message": "user already exists" }` | Email not unique (pre-check) |
| `400 Bad Request` | `{ "message": "User with this email already exists" }` | DB unique constraint hit |
| `500 Internal Server Error` | `{ "message": "database error" }` | DB error during insert |
| `500 Internal Server Error` | `{ "message": "Internal server error" }` | Unexpected crash |

> On success, a `token` httpOnly cookie is set automatically (expires in 1 day).

---

#### `POST /api/auth/login`
Log in as a teacher or student.

**Request Body**

| Field | Type | Rules |
|-------|------|-------|
| `email` | string | Required, valid email format |
| `password` | string | Required |

**Responses**

| Status | Body | Condition |
|--------|------|-----------|
| `200 OK` | See below | Credentials valid, JWT cookie set |
| `400 Bad Request` | `{ "message": "required all fields" }` | Missing field(s) |
| `400 Bad Request` | `{ "message": "Invalid email format" }` | Bad email |
| `400 Bad Request` | `{ "message": "wrong email or password" }` | User not found or wrong password |
| `500 Internal Server Error` | `{ "message": "Internal server error" }` | Unexpected crash |

**200 Response Body**
```json
{
    "message": "login successfully",
    "user": {
        "id": 1,
        "name": "Rahul Sharma",
        "email": "rahul@school.com",
        "role": "TEACHER"
    }
}
```

Use `user.role` to redirect to the correct dashboard:
```js
if (data.user.role === "TEACHER")  window.location.href = "/frontend/teacherDashboard/";
if (data.user.role === "STUDENT")  window.location.href = "/frontend/studentDashboard/";
```

---

#### `GET /api/auth/me` 🔒
Get the currently logged-in user. Call on page load to verify session.

**No request body required.**

**Responses**

| Status | Body | Condition |
|--------|------|-----------|
| `200 OK` | See below | Token valid |
| `401 Unauthorized` | `{ "message": "No token, authorization denied" }` | No cookie |
| `401 Unauthorized` | `{ "message": "invalid token " }` | Expired or tampered token |
| `404 Not Found` | `{ "message": "User not found" }` | User deleted from DB |
| `500 Internal Server Error` | `{ "message": "Internal server error" }` | Unexpected crash |

**200 Response Body**
```json
{
    "message": "details fetched successfully",
    "user": {
        "id": 1,
        "name": "Rahul Sharma",
        "email": "rahul@school.com",
        "role": "TEACHER"
    }
}
```

---

#### `POST /api/auth/logout`
Log out. Clears the JWT cookie. No auth required — works even with an expired token.

**No request body required.**

**Responses**

| Status | Body | Condition |
|--------|------|-----------|
| `200 OK` | `{ "message": "Logged out successfully " }` | Cookie cleared |
| `500 Internal Server Error` | `{ "message": "Internal server error" }` | Unexpected crash |

---

### Student Routes — `/api/student` 🔒

All student routes require a valid token **and** `role === "STUDENT"`.

---

#### `GET /api/student/studentDetails`
Get the logged-in student's profile and attendance summary.

**No request body required.**

**Responses**

| Status | Body | Condition |
|--------|------|-----------|
| `200 OK` | See below | Success |
| `401 Unauthorized` | `{ "error": "Unauthorized" }` | No token |
| `403 Forbidden` | `{ "message": "Access denied" }` | User is not a STUDENT |
| `404 Not Found` | `{ "error": "Student profile not found" }` | No student record for this email |
| `500 Internal Server Error` | `{ "error": "Server error" }` | Unexpected crash |

**200 Response Body**
```json
{
    "profile": {
        "name": "Amit Kumar",
        "id_code": 5,
        "subject": "Mathematics",
        "roll_no": 101,
        "email": "amit@school.com"
    },
    "attendance": {
        "totalAttendance": 20,
        "presentAttendance": 17,
        "absentAttendance": 3,
        "presentPercentage": 85,
        "absentPercentage": 15
    }
}
```

> `presentPercentage` and `absentPercentage` return `0` (not `NaN`) when no attendance records exist yet.

---

#### `GET /api/student/attendanceCalendar`
Get the logged-in student's full attendance history for calendar display.

**No request body required.**

**Responses**

| Status | Body | Condition |
|--------|------|-----------|
| `200 OK` | See below | Success |
| `400 Bad Request` | `{ "error": "User email required" }` | Email missing from token |
| `401 Unauthorized` | `{ "message": "Unauthorized" }` | No token |
| `403 Forbidden` | `{ "message": "Access denied" }` | User is not a STUDENT |
| `500 Internal Server Error` | `{ "error": "Server error" }` | Unexpected crash |

**200 Response Body**
```json
{
    "coloredRows": [
        { "date": "2026-02-15", "status": "PRESENT", "color": "green" },
        { "date": "2026-02-14", "status": "ABSENT",  "color": "red"   },
        { "date": "2026-02-13", "status": "LATE",    "color": "grey"  }
    ]
}
```

> Results are ordered by `date DESC` (newest first). `color` values: `"green"` (PRESENT), `"red"` (ABSENT), `"grey"` (LATE / LEAVE).

---

### Teacher Routes — `/api/teacher` 🔒

All teacher routes require a valid token **and** `role === "TEACHER"`.

---

#### `GET /api/teacher/teacherDetails`
Get the logged-in teacher's profile.

**No request body required.**

**Responses**

| Status | Body | Condition |
|--------|------|-----------|
| `200 OK` | See below | Success |
| `401 Unauthorized` | `{ "error": "Unauthorized" }` | No token |
| `403 Forbidden` | `{ "message": "Access denied" }` | User is not a TEACHER |
| `404 Not Found` | `{ "error": "Teacher profile not found" }` | No teacher record for this email |
| `500 Internal Server Error` | `{ "message": "server error/dashboard error" }` | Unexpected crash |

**200 Response Body**
```json
{
    "profile": {
        "name": "Rahul Sharma",
        "id_code": 1,
        "email": "rahul@school.com",
        "subject": "Mathematics"
    }
}
```

---

#### `POST /api/teacher/addStudent`
Add a new student. The student is scoped to the teacher's subject automatically by using the provided `subject` field.

**Request Body**

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | Required, max 50 chars |
| `email` | string | Required, valid email format |
| `password` | string | Required, min 8 chars |
| `subject` | string | Required, max 50 chars |
| `roll_num` | number | Required, positive integer |

**Responses**

| Status | Body | Condition |
|--------|------|-----------|
| `201 Created` | `{ "message": "register successful" }` | Student created |
| `400 Bad Request` | `{ "message": "required all fields" }` | Missing field(s) |
| `400 Bad Request` | `{ "message": "Invalid email format" }` | Bad email |
| `400 Bad Request` | `{ "message": "Password must be at least 8 characters long" }` | Password too short |
| `400 Bad Request` | `{ "message": "Name and Subject must be less than 50 characters" }` | Field too long |
| `400 Bad Request` | `{ "message": "Roll number must be a positive integer" }` | Invalid roll_num |
| `400 Bad Request` | `{ "message": "Student with this email already exists" }` | Email collision |
| `400 Bad Request` | `{ "message": "Student with this roll number already exists" }` | Roll num collision |
| `401 Unauthorized` | `{ "error": "Unauthorized" }` | No token |
| `403 Forbidden` | `{ "message": "Access denied" }` | User is not a TEACHER |
| `500 Internal Server Error` | `{ "message": "database error" }` | DB error during insert |
| `500 Internal Server Error` | `{ "message": "Internal server error" }` | Unexpected crash |

> `roll_num` accepts both number (`5`) and numeric string (`"5"`) — it is coerced with `parseInt` internally.

---

#### `GET /api/teacher/stats`
Get statistics scoped to the teacher's subject: total students, present today, absent today.

**No request body required.**

**Responses**

| Status | Body | Condition |
|--------|------|-----------|
| `200 OK` | See below | Success |
| `401 Unauthorized` | `{ "error": "Unauthorized" }` | No token |
| `403 Forbidden` | `{ "message": "Access denied" }` | User is not a TEACHER |
| `404 Not Found` | `{ "error": "Teacher profile not found" }` | Teacher not in DB |
| `500 Internal Server Error` | `{ "error": "Server error" }` | Unexpected crash |

**200 Response Body**
```json
{
    "subject": "Mathematics",
    "total_student": 30,
    "present": 25,
    "absent": 5
}
```

> `absent` = `total_student - present` for today. It is always `>= 0`. Students not yet marked for today count as absent.

---

#### `POST /api/teacher/markAttendance`
Mark attendance for multiple students in one request. Uses upsert — marking again overwrites the previous status for that date.

**Request Body**

| Field | Type | Rules |
|-------|------|-------|
| `date` | string | Required, `YYYY-MM-DD` format, must be a valid calendar date |
| `records` | array | Required, max 200 items |
| `records[].student_id` (or `records[].id`) | number | Required, ID of the student |
| `records[].status` | string | Required, one of: `PRESENT`, `ABSENT`, `LATE`, `LEAVE` (case-insensitive) |

**Responses**

| Status | Body | Condition |
|--------|------|-----------|
| `200 OK` | See below | Processing complete (check `summary.skipped` for partial failures) |
| `400 Bad Request` | `{ "error": "Invalid request body" }` | Missing `date` or `records` |
| `400 Bad Request` | `{ "error": "Too many records in one request (limit 200)" }` | records.length > 200 |
| `400 Bad Request` | `{ "error": "Invalid date format or value. Use YYYY-MM-DD" }` | Bad date |
| `400 Bad Request` | `{ "error": "Foreign key violation: Student ID does not exist", "details": "..." }` | Non-existent student_id |
| `401 Unauthorized` | `{ "message": "Unauthorized" }` | No token |
| `403 Forbidden` | `{ "message": "Access denied" }` | User is not a TEACHER |
| `404 Not Found` | `{ "error": "Teacher profile not found" }` | Teacher not in DB |
| `500 Internal Server Error` | `{ "error": "Server error", "details": "..." }` | DB error |

**200 Response Body**
```json
{
    "message": "Attendance processing completed",
    "summary": {
        "total": 30,
        "marked": 28,
        "skipped": 2
    },
    "skippedDetails": [
        { "recordIndex": 3,  "reason": "Student ID not found or not in your subject" },
        { "recordIndex": 17, "reason": "Missing ID or invalid status" }
    ]
}
```

> `skippedDetails` is only present in the response when `skipped > 0`. Records are skipped (not errored) when: student ID is missing, status is invalid, or the student doesn't belong to the teacher's subject. The rest of the batch is still committed.

---

## Global Status Code Reference

| Status | Meaning | Common Causes |
|--------|---------|---------------|
| `200 OK` | Success | Login, fetch details, logout, mark attendance |
| `201 Created` | Resource created | Register teacher, add student |
| `400 Bad Request` | Client error | Missing fields, validation failure, wrong credentials, duplicate email/roll_num |
| `401 Unauthorized` | No/invalid token | Missing cookie, expired JWT, tampered token |
| `403 Forbidden` | Wrong role | Student accessing teacher route or vice versa |
| `404 Not Found` | Resource missing | Profile not in DB |
| `429 Too Many Requests` | Rate limited | Auth: 10/15min · Student/Teacher: 100/15min |
| `500 Internal Server Error` | Server crash | DB error, unexpected exception |

---

## Reusable Fetch Helper

```js
async function apiCall(url, options = {}) {
    try {
        const res = await fetch(url, {
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            ...options
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error || "Something went wrong");
        return data;
    } catch (err) {
        console.error(err.message);
        return null;
    }
}

// Example usage:
const data = await apiCall("http://localhost:3000/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "rahul@school.com", password: "mypassword123" })
});
if (data) console.log("Logged in as:", data.user.name);
```
