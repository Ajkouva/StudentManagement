# Frontend API Documentation

> Base URL: `http://localhost:3000`
> Frontend must run on: `http://localhost:5500` (CORS is configured for this origin)

---

## Setup: Connecting Frontend to Backend

All requests must include `credentials: "include"` so the browser sends/receives cookies:

```js
// Use this for EVERY fetch call
fetch("http://localhost:3000/api/...", {
    method: "POST",
    credentials: "include",            // ← REQUIRED for cookie auth
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ... })
});
```

> **IMPORTANT:** Without `credentials: "include"`, the browser won't send the auth cookie and all protected routes will return `401`.

---

## Authentication Flow

```
1. Frontend sends POST /api/auth/login {email, password}
2. Backend responds 200 + Set-Cookie: token=xxx (httpOnly)
3. Cookie is stored automatically by browser
4. Frontend sends GET /api/student/studentDetails (cookie sent automatically)
5. Backend responds 200 {profile: {...}}
6. Frontend sends GET /api/auth/logout
7. Backend responds 200 + Set-Cookie: token="" (expired)
```

You **never** manually store or send the token — the browser handles it via cookies.

---

## API Endpoints

### 1. Register Teacher

```
POST /api/auth/register
```

| Field | Type | Required |
|-------|------|----------|
| `name` | string | ✅ |
| `email` | string | ✅ |
| `password` | string | ✅ |
| `subject` | string | ✅ |

```js
const res = await fetch("http://localhost:3000/api/auth/register", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        name: "Rahul Sharma",
        email: "rahul@school.com",
        password: "mypassword123",
        subject: "Mathematics"
    })
});
const data = await res.json();
// Success: { message: "register successful" }  (status 201)
// Error:   { message: "user already exists" }   (status 400)
```

---

### 2. Login

```
POST /api/auth/login
```

| Field | Type | Required |
|-------|------|----------|
| `email` | string | ✅ |
| `password` | string | ✅ |

```js
const res = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        email: "rahul@school.com",
        password: "mypassword123"
    })
});
const data = await res.json();
// Success (200):
// {
//     message: "login sucessfully",
//     user: { id: 1, name: "Rahul Sharma", email: "rahul@school.com", role: "TEACHER" }
// }
//
// Error (400): { message: "wrong email or password" }
```

After login, use `data.user.role` to decide which dashboard to show:

```js
if (data.user.role === "TEACHER") {
    window.location.href = "/frontend/teacherDashboard/";
} else if (data.user.role === "STUDENT") {
    window.location.href = "/frontend/studentDashboard/";
}
```

---

### 3. Get Current User 🔒

```
GET /api/auth/me
```

No body needed. Use this on page load to check if the user is already logged in:

```js
const res = await fetch("http://localhost:3000/api/auth/me", {
    credentials: "include"
});

if (res.ok) {
    const data = await res.json();
    // { message: "details fetched sucessfully", user: { id, name, email, role } }
} else {
    // Not logged in → redirect to login page
    window.location.href = "/frontend/login/";
}
```

---

### 4. Logout 🔒

```
GET /api/auth/logout
```

```js
const res = await fetch("http://localhost:3000/api/auth/logout", {
    credentials: "include"
});
// { message: "Logged out successfully" }
window.location.href = "/frontend/login/";
```

---

### 5. Get Student Details 🔒 (STUDENT role only)

```
GET /api/student/studentDetails
```

```js
const res = await fetch("http://localhost:3000/api/student/studentDetails", {
    credentials: "include"
});
const data = await res.json();
// Success (200):
// {
//     profile: {
//         name: "Amit Kumar",
//         id_code: 5,
//         subject: "Mathematics",
//         roll_no: "2024001",
//         email: "amit@school.com"
//     }
// }
//
// Error (403): { message: "Access denied" }      ← if role is not STUDENT
// Error (404): { error: "Student profile not found" }
```

---

### 6. Get Teacher Details 🔒 (TEACHER role only)

```
GET /api/teacher/teacherDetails
```

```js
const res = await fetch("http://localhost:3000/api/teacher/teacherDetails", {
    credentials: "include"
});
const data = await res.json();
// Success (200):
// {
//     profile: {
//         name: "Rahul Sharma",
//         id_code: 1,
//         email: "rahul@school.com",
//         subject: "Mathematics"
//     }
// }
```

---

### 7. Add Student 🔒 (TEACHER role only)

```
POST /api/teacher/addStudent
```

| Field | Type | Required |
|-------|------|----------|
| `name` | string | ✅ |
| `email` | string | ✅ |
| `password` | string | ✅ |
| `subject` | string | ✅ |
| `roll_num` | string | ✅ |

```js
const res = await fetch("http://localhost:3000/api/teacher/addStudent", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        name: "Amit Kumar",
        email: "amit@school.com",
        password: "student123",
        subject: "Mathematics",
        roll_num: "2024001"
    })
});
const data = await res.json();
// Success (201): { message: "register successful" }
// Error (403):   { message: "Access denied" }       ← if not a teacher
// Error (400):   { message: "user already exists" }
```

---

## Error Handling Pattern

Use this reusable pattern for all API calls:

```js
async function apiCall(url, options = {}) {
    try {
        const res = await fetch(url, {
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            ...options
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.message || "Something went wrong");
            return null;
        }

        return data;
    } catch (error) {
        alert("Network error — is the backend running?");
        return null;
    }
}

// Usage:
const data = await apiCall("http://localhost:3000/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "rahul@school.com", password: "mypassword123" })
});

if (data) {
    console.log("Logged in as:", data.user.name);
}
```

---

## Error Codes Quick Reference

| Status | Meaning | When |
|--------|---------|------|
| `200` | Success | Login, get details, logout |
| `201` | Created | Register, add student |
| `400` | Bad request | Missing fields, invalid email, user exists, wrong credentials |
| `401` | Unauthorized | No token or invalid/expired token |
| `403` | Forbidden | Wrong role (student accessing teacher route or vice versa) |
| `404` | Not found | Profile not found in DB |
| `429` | Too many requests | Rate limit exceeded (auth routes: max 10 per 15 min) |
| `500` | Server error | Database error or unexpected crash |
