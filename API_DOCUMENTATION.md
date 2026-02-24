# API Documentation — Student Management System

> **Base URL:** `http://localhost:3000`
> **CORS:** All origins are currently reflected (`origin: true`). In production, restrict this to your frontend domain.

---

## Tech Stack

| Layer | Package | Version |
|-------|---------|---------|
| Runtime | Node.js + Express | `^5.2.1` |
| Auth | jsonwebtoken + bcryptjs | `^9.0.3` / `^3.0.3` |
| Database | PostgreSQL via `pg` | `^8.18.0` |
| Rate Limiting | express-rate-limit | `^8.2.1` |
| Cookie Parsing | cookie-parser | `^1.4.7` |

---

## Authentication

All protected routes (🔒) require a valid JWT stored in an **httpOnly cookie** named `token`. The browser sends it automatically — you only need `credentials: "include"` on every fetch call.

```js
fetch("http://localhost:3000/api/...", {
    method: "POST",
    credentials: "include",           // ← REQUIRED for cookie auth
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ... })
});
```

> ❌ Without `credentials: "include"`, every protected route returns `401`.

### Cookie Properties

| Property | Value |
|----------|-------|
| `httpOnly` | `true` (JS cannot read it) |
| `secure` | `true` only in `NODE_ENV=production` |
| `sameSite` | `"lax"` |
| `maxAge` | `86400000` ms (1 day) |

---

## Auth Flow

```
POST /api/auth/register  →  201 + Set-Cookie: token=xxx (httpOnly, 1 day)
POST /api/auth/login     →  200 + Set-Cookie: token=xxx (httpOnly, 1 day)
GET  /api/student/*      →  Cookie sent automatically by browser
POST /api/auth/logout    →  200 + Set-Cookie: token="" (expired, maxAge: 1ms)
```

---

## Rate Limits

| Route Group | Limit | Message on Exceed |
|-------------|-------|-------------------|
| `/api/auth/*` | 10 requests / 15 min | `"too many request please try after 15 minutes"` |
| `/api/student/*` | 100 requests / 15 min | `"too many requests, please try after 15 minutes"` |
| `/api/teacher/*` | 100 requests / 15 min | `"too many request please try after 15 minutes"` |

Exceeding the limit returns **`429 Too Many Requests`**:
```json
{ "message": "too many request please try after 15 minutes" }
```

---

## Database Schema (Summary)

| Table | Key Columns |
|-------|------------|
| `users` | `id`, `name`, `email` (UNIQUE), `password_hash`, `role` (`TEACHER`\|`STUDENT`), `created_at` |
| `teacher` | `id`, `name`, `email` (FK → `users.email`), `subject` (NOT NULL), `created_at` |
| `student` | `id`, `name`, `email` (FK → `users.email`), `subject` (NOT NULL), `roll_num` (UNIQUE), `created_at` |
| `attendance` | `id`, `student_id` (FK → `student.id`), `date`, `status` (ENUM), UNIQUE(`student_id`, `date`) |

**Attendance ENUM values:** `PRESENT`, `ABSENT`, `LATE`, `LEAVE`

> Deleting from `users` cascades to `teacher`/`student`. Deleting from `student` cascades to `attendance`.

---

## Endpoints

---

### Auth Routes — `/api/auth`

---

#### `POST /api/auth/register`
Register a new **teacher** account. Role is always set to `TEACHER` internally — it cannot be set by the client.

**Request Body**

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | Required, trimmed, max 50 chars |
| `email` | string | Required, trimmed + lowercased, valid email format |
| `password` | string | Required, min 8 chars |
| `subject` | string | Required, trimmed, max 50 chars |

**Responses**

| Status | Body | Condition |
|--------|------|-----------|
| `201 Created` | `{ "message": "register successful" }` | Account created, JWT cookie set |
| `400 Bad Request` | `{ "message": "required all fields" }` | Any field missing/falsy |
| `400 Bad Request` | `{ "message": "Invalid email format" }` | Email fails regex |
| `400 Bad Request` | `{ "message": "Password must be at least 8 characters long" }` | `password.length < 8` |
| `400 Bad Request` | `{ "message": "Name and Subject must be less than 50 characters" }` | Name or subject > 50 chars |
| `400 Bad Request` | `{ "message": "user already exists" }` | Pre-check: email found in `users` table |
| `400 Bad Request` | `{ "message": "User with this email already exists" }` | DB unique constraint `23505` hit mid-transaction |
| `500 Internal Server Error` | `{ "message": "database error" }` | Non-unique-constraint DB error during insert |
| `500 Internal Server Error` | `{ "message": "Internal server error" }` | Unexpected crash |

> On success, a `token` httpOnly cookie is set automatically (expires in 1 day). Both a `users` row **and** a `teacher` row are inserted in a single DB transaction — if either fails, both are rolled back.

---

#### `POST /api/auth/login`
Log in as a teacher or student. The `role` in the response tells you which dashboard to load.

**Request Body**

| Field | Type | Rules |
|-------|------|-------|
| `email` | string | Required, trimmed + lowercased, valid email format |
| `password` | string | Required |

**Responses**

| Status | Body | Condition |
|--------|------|-----------|
| `200 OK` | See below | Credentials valid, JWT cookie set |
| `400 Bad Request` | `{ "message": "required all fields" }` | Missing email or password |
| `400 Bad Request` | `{ "message": "Invalid email format" }` | Email fails regex |
| `400 Bad Request` | `{ "message": "wrong email or password" }` | User not found, OR bcrypt mismatch |
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
if (data.user.role === "TEACHER") window.location.href = "/frontend/teacherDashboard/";
if (data.user.role === "STUDENT") window.location.href = "/frontend/studentDashboard/";
```

> Both "user not found" and "wrong password" return `400` with the same generic message to prevent user enumeration.

---

#### `GET /api/auth/me` 🔒
Get the currently logged-in user. Call on page load to verify session and get current role.

**No request body required.**

**Responses**

| Status | Body | Condition |
|--------|------|-----------|
| `200 OK` | See below | Token valid, user found |
| `401 Unauthorized` | `{ "message": "No token, authorization denied" }` | No cookie (from middleware) |
| `401 Unauthorized` | `{ "message": "invalid token " }` | Expired or tampered token (from middleware) |
| `401 Unauthorized` | `{ "message": "Unauthorized" }` | `req.user` missing after middleware (guard) |
| `404 Not Found` | `{ "message": "User not found" }` | User deleted from DB after token was issued |
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
Log out. Clears the JWT cookie by setting `maxAge: 1ms`. No auth required — works even with an expired token.

**No request body required.**

**Responses**

| Status | Body | Condition |
|--------|------|-----------|
| `200 OK` | `{ "message": "Logged out successfully " }` | Cookie cleared |
| `500 Internal Server Error` | `{ "message": "Internal server error" }` | Unexpected crash |

> Note the trailing space in `"Logged out successfully "` — this matches the exact response string from the server.

---

### Student Routes — `/api/student` 🔒

All student routes require a valid token **and** `role === "STUDENT"`. The `protect` middleware runs first, setting `req.user`; each controller then does its own role check.

---

#### `GET /api/student/studentDetails` 🔒
Get the logged-in student's profile. **Does not return attendance stats** — use `/attendanceCalendar` for that.

**No request body required.**

**Responses**

| Status | Body | Condition |
|--------|------|-----------|
| `200 OK` | See below | Success |
| `401 Unauthorized` | `{ "error": "Unauthorized" }` | `req.user` missing |
| `401 Unauthorized` | `{ "message": "No token, authorization denied" }` | No cookie (middleware) |
| `403 Forbidden` | `{ "message": "Access denied" }` | User is not a `STUDENT` |
| `404 Not Found` | `{ "error": "Student profile not found" }` | No student row for this email |
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
    }
}
```

> Note: the `id_code` field is the student's `id` from the `student` table. `roll_no` maps to the `roll_num` DB column.

---

#### `POST /api/student/attendanceCalendar` 🔒

> ⚠️ **This is a `POST` request, not `GET`.** Month and year are sent in the **request body**.

Get the logged-in student's attendance records for a specific month, plus per-month attendance statistics.

**Request Body**

| Field | Type | Rules |
|-------|------|-------|
| `month` | number | Required, 1–12 (e.g. `2` for February) |
| `year` | number | Required, 4-digit year (e.g. `2026`) |

**Responses**

| Status | Body | Condition |
|--------|------|-----------|
| `200 OK` | See below | Success |
| `400 Bad Request` | `{ "error": "User email required" }` | Email missing from token payload |
| `400 Bad Request` | `{ "error": "Month and year required" }` | `month` or `year` missing from body |
| `401 Unauthorized` | `{ "message": "Unauthorized" }` | `req.user` missing |
| `401 Unauthorized` | `{ "message": "No token, authorization denied" }` | No cookie (middleware) |
| `403 Forbidden` | `{ "message": "Access denied" }` | User is not a `STUDENT` |
| `500 Internal Server Error` | `{ "error": "Server error" }` | Unexpected crash |

**200 Response Body**
```json
{
    "coloredRows": [
        { "date": "2026-02-15", "status": "PRESENT", "color": "green" },
        { "date": "2026-02-14", "status": "ABSENT",  "color": "red"   },
        { "date": "2026-02-13", "status": "LATE",    "color": "grey"  }
    ],
    "attendance": {
        "totalAttendance": 20,
        "presentAttendance": 17,
        "absentAttendance": 3,
        "presentPercentage": 85,
        "absentPercentage": 15
    }
}
```

> `coloredRows` is ordered by `date DESC` (newest first). `color` mapping: `"green"` → PRESENT, `"red"` → ABSENT, `"grey"` → LATE or LEAVE. `presentPercentage` and `absentPercentage` are `0` (not `NaN`) when no records exist. The `attendance` stats block counts only records within the queried month.

**Example call:**
```js
// Get February 2026 attendance
await apiCall("http://localhost:3000/api/student/attendanceCalendar", {
    method: "POST",
    body: JSON.stringify({ month: 2, year: 2026 })
});
```

---

### Teacher Routes — `/api/teacher` 🔒

All teacher routes require a valid token **and** `role === "TEACHER"`. Data is always scoped to the teacher's own subject (looked up from the `teacher` table on each request).

---

#### `GET /api/teacher/teacherDetails` 🔒
Get the logged-in teacher's profile.

**No request body required.**

**Responses**

| Status | Body | Condition |
|--------|------|-----------|
| `200 OK` | See below | Success |
| `401 Unauthorized` | `{ "error": "Unauthorized" }` | `req.user` missing |
| `403 Forbidden` | `{ "message": "Access denied" }` | User is not a `TEACHER` |
| `404 Not Found` | `{ "error": "Teacher profile not found" }` | No teacher row for this email |
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

> `id_code` is the teacher's `id` from the `teacher` table.

---

#### `POST /api/teacher/addStudent` 🔒
Add a new student and create their login account. Both a `users` row and `student` row are inserted in a single DB transaction.

**Request Body**

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | Required, trimmed, max 50 chars |
| `email` | string | Required, trimmed + lowercased, valid email |
| `password` | string | Required, min 8 chars |
| `subject` | string | Required, trimmed, max 50 chars |
| `roll_num` | number \| string | Required, positive integer (accepts `"5"` or `5`) |

**Responses**

| Status | Body | Condition |
|--------|------|-----------|
| `201 Created` | `{ "message": "register successful" }` | Student created |
| `400 Bad Request` | `{ "message": "required all fields" }` | Any field missing/falsy |
| `400 Bad Request` | `{ "message": "Invalid email format" }` | Email fails regex |
| `400 Bad Request` | `{ "message": "Password must be at least 8 characters long" }` | `password.length < 8` |
| `400 Bad Request` | `{ "message": "Name and Subject must be less than 50 characters" }` | Name or subject > 50 chars |
| `400 Bad Request` | `{ "message": "Roll number must be a positive integer" }` | `isNaN(parseInt(roll_num))` or `<= 0` |
| `400 Bad Request` | `{ "message": "Student with this email already exists" }` | DB unique constraint on `email` |
| `400 Bad Request` | `{ "message": "Student with this roll number already exists" }` | DB unique constraint on `roll_num` |
| `401 Unauthorized` | `{ "error": "Unauthorized" }` | `req.user` missing |
| `403 Forbidden` | `{ "message": "Access denied" }` | User is not a `TEACHER` |
| `500 Internal Server Error` | `{ "message": "database error" }` | Non-constraint DB error during insert |
| `500 Internal Server Error` | `{ "message": "Internal server error" }` | Unexpected crash |

> `roll_num` is passed through `parseInt(roll_num, 10)` — both `5` and `"5"` are valid. Unique constraint errors (email or roll_num collision) are caught inside the transaction and return `400`, not `500`. The transaction is fully rolled back on any failure.

---

#### `GET /api/teacher/stats` 🔒
Get today's real-time attendance statistics scoped to the teacher's subject.

**No request body required.**

**Responses**

| Status | Body | Condition |
|--------|------|-----------|
| `200 OK` | See below | Success |
| `401 Unauthorized` | `{ "error": "Unauthorized" }` | `req.user` missing |
| `403 Forbidden` | `{ "message": "Access denied" }` | User is not a `TEACHER` |
| `404 Not Found` | `{ "error": "Teacher profile not found" }` | Teacher not in DB |
| `500 Internal Server Error` | `{ "error": "Server error" }` | Unexpected crash |

**200 Response Body**
```json
{
    "subject": "Mathematics",
    "total_student": 30,
    "today": {
        "present": 22,
        "absent": 5,
        "late": 1,
        "on_leave": 1,
        "not_marked": 1
    }
}
```

> Uses DB-side `CURRENT_DATE` so the date is always accurate regardless of server timezone. Subject comparison is **case-insensitive** (`LOWER(s.subject) = LOWER($1)`). `not_marked` = students with no attendance record yet for today. All integer fields are cast with `parseInt`.

---

#### `POST /api/teacher/markAttendance` 🔒
Mark or update attendance for multiple students in one request. Uses **upsert** — re-marking a student on the same date overwrites the previous status.

**Request Body**

| Field | Type | Rules |
|-------|------|-------|
| `date` | string | Required, `YYYY-MM-DD` format, must be a valid calendar date |
| `records` | array | Required, non-empty array, max **200** items |
| `records[].student_id` or `records[].id` | number | Required (either field name accepted) |
| `records[].status` | string | Required, one of: `PRESENT`, `ABSENT`, `LATE`, `LEAVE` (case-insensitive — normalized to uppercase internally) |

**Responses**

| Status | Body | Condition |
|--------|------|-----------|
| `200 OK` | See below | Processing complete (check `summary.skipped`) |
| `400 Bad Request` | `{ "error": "Invalid request body" }` | Missing `date` or `records`, or `records` not an array |
| `400 Bad Request` | `{ "error": "Too many records in one request (limit 200)" }` | `records.length > 200` |
| `400 Bad Request` | `{ "error": "Invalid date format or value. Use YYYY-MM-DD" }` | Date fails regex or is an invalid date |
| `400 Bad Request` | `{ "error": "Foreign key violation: Student ID does not exist", "details": "..." }` | Non-existent `student_id` (DB FK error `23503`) |
| `401 Unauthorized` | `{ "message": "Unauthorized" }` | `req.user` missing |
| `403 Forbidden` | `{ "message": "Access denied" }` | User is not a `TEACHER` |
| `404 Not Found` | `{ "error": "Teacher profile not found" }` | Teacher not in DB |
| `500 Internal Server Error` | `{ "error": "Server error", "details": "..." }` | DB error |

**200 Response Body (all marked)**
```json
{
    "message": "Attendance processing completed",
    "summary": {
        "total": 30,
        "marked": 30,
        "skipped": 0
    }
}
```

**200 Response Body (with skips)**
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

> `skippedDetails` is only present when `skipped > 0`. Records are **skipped** (not errored) when: student ID is missing, status is invalid, or the student doesn't belong to the teacher's subject. The rest of the batch is still committed. Status is normalized to uppercase before validation, so `"present"` and `"Present"` are both accepted. The entire batch runs in a single DB transaction.

---

#### `GET /api/teacher/attendance75` 🔒
Returns all students in the teacher's subject whose **all-time attendance is below 75%**, along with their current-month breakdown.

**No request body required.**

**Responses**

| Status | Body | Condition |
|--------|------|-----------|
| `200 OK` | See below | Success |
| `401 Unauthorized` | `{ "error": "Unauthorized" }` | `req.user` missing |
| `403 Forbidden` | `{ "message": "Access denied" }` | User is not a `TEACHER` |
| `404 Not Found` | `{ "error": "Teacher profile not found" }` | Teacher not in DB |
| `500 Internal Server Error` | `{ "error": "Server error", "details": "..." }` | Unexpected crash |

**200 Response Body**
```json
{
    "subject": "Mathematics",
    "count": 2,
    "students": [
        {
            "id": 5,
            "name": "Jane Doe",
            "email": "jane@school.com",
            "roll_num": 12,
            "total_classes": 40,
            "present_count": 28,
            "attendance_percentage": 70.00,
            "current_month": {
                "total_classes": 10,
                "present_count": 6,
                "attendance_percentage": 60.00
            }
        }
    ]
}
```

> Results are ordered by `attendance_percentage ASC NULLS FIRST` (worst first; students with **zero** attendance records appear at the top). `attendance_percentage` is `0` (not `null`) when a student has no records. Both all-time and current-month stats are computed in a **single SQL query** using conditional `COUNT ... FILTER`. Subject comparison is case-insensitive.

---

#### `GET /api/teacher/attendanceDetails` 🔒
Returns a full monthly attendance summary for **every student** in the teacher's subject.

**Query Parameters (optional)**

| Param | Type | Description |
|-------|------|-------------|
| `month` | string | Month to query in `YYYY-MM` format (e.g. `2026-01`). Defaults to the current month if omitted. |

**Example:**
```
GET /api/teacher/attendanceDetails?month=2026-01
```

**Responses**

| Status | Body | Condition |
|--------|------|-----------|
| `200 OK` | See below | Success |
| `400 Bad Request` | `{ "error": "Invalid month format. Use YYYY-MM" }` | `?month` value fails `new Date()` parse |
| `401 Unauthorized` | `{ "error": "Unauthorized" }` | `req.user` missing |
| `403 Forbidden` | `{ "message": "Access denied" }` | User is not a `TEACHER` |
| `404 Not Found` | `{ "error": "Teacher profile not found" }` | Teacher not in DB |
| `500 Internal Server Error` | `{ "error": "Server error", "details": "..." }` | Unexpected crash |

**200 Response Body**
```json
{
    "subject": "Mathematics",
    "month": "2026-02",
    "count": 30,
    "students": [
        {
            "id": 5,
            "name": "Jane Doe",
            "email": "jane@school.com",
            "roll_num": 12,
            "total_classes": 18,
            "present_count": 14,
            "absent_count": 3,
            "late_count": 1,
            "leave_count": 0,
            "attendance_percentage": 77.78
        }
    ]
}
```

> Results are ordered by `roll_num ASC`. `attendance_percentage` is `0` when no classes have been held in the queried month. The `month` label in the response is derived server-side: if no `?month` query param is given, it defaults to the current month as `YYYY-MM` from `new Date().toISOString()`.

---

#### `DELETE /api/teacher/deleteStudent/:id` 🔒
Permanently deletes a student and **revokes their login access**. Removes records from `attendance`, `student`, and `users` tables in a single transaction. Teachers can only delete students in their own subject.

**URL Parameter**

| Param | Type | Description |
|-------|------|-------------|
| `:id` | number | The student's `id` from the `student` table |

**No request body required.**

**Responses**

| Status | Body | Condition |
|--------|------|-----------|
| `200 OK` | See below | Student deleted, login blocked |
| `400 Bad Request` | `{ "error": "Invalid student ID" }` | Non-numeric or `<= 0` `:id` |
| `401 Unauthorized` | `{ "error": "Unauthorized" }` | `req.user` missing |
| `403 Forbidden` | `{ "message": "Access denied" }` | User is not a `TEACHER` |
| `404 Not Found` | `{ "error": "Student not found or not in your subject" }` | Student doesn't exist or belongs to another teacher |
| `404 Not Found` | `{ "error": "Teacher profile not found" }` | Teacher not in DB |
| `500 Internal Server Error` | `{ "error": "Server error", "details": "..." }` | DB error (full rollback occurs) |

**200 Response Body**
```json
{
    "message": "Student deleted successfully. Login access revoked.",
    "deleted": {
        "id": 5,
        "email": "jane@school.com"
    }
}
```

> ⚠️ This action is **irreversible**. Deletion order: `attendance` → `student` → `users` (to satisfy FK constraints). Subject check is case-insensitive. The full transaction is rolled back if any step fails.

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

// Example: Login
const data = await apiCall("http://localhost:3000/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "rahul@school.com", password: "mypassword123" })
});
if (data) console.log("Logged in as:", data.user.name);

// Example: Monthly attendance calendar (POST — requires body)
const cal = await apiCall("http://localhost:3000/api/student/attendanceCalendar", {
    method: "POST",
    body: JSON.stringify({ month: 2, year: 2026 })
});

// Example: Delete a student
await apiCall("http://localhost:3000/api/teacher/deleteStudent/5", {
    method: "DELETE"
});
```

---

## Common Mistakes

| ❌ Mistake | ✅ Fix |
|-----------|--------|
| Using `GET` for `/api/student/attendanceCalendar` | Use `POST` with `{ month, year }` in the body |
| Expecting `attendance` in `studentDetails` response | It's not there — call `attendanceCalendar` separately |
| Not sending `credentials: "include"` | Add it to every fetch call |
| Sending `roll_num` as a float (e.g. `3.5`) | Must be a positive integer — `parseInt` must be `> 0` |
| Expecting `skippedDetails` when all records succeed | It's `undefined` (omitted) when `skipped === 0` |
| Sending status in lowercase (`"present"`) | Fine — server normalizes to uppercase internally |
