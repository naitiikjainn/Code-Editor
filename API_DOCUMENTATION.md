# CodePlay API Documentation

> **Base URL:** `http://localhost:5000` (local) or your deployed backend URL  
> **Authentication:** JWT Bearer Token in `Authorization` header  
> **Content-Type:** `application/json` (unless noted otherwise)

---

## Table of Contents

1. [Getting Started with Postman](#1-getting-started-with-postman)
2. [Authentication](#2-authentication)
3. [OAuth](#3-oauth)
4. [Code Execution](#4-code-execution)
5. [Files](#5-files)
6. [Rooms](#6-rooms)
7. [Problems](#7-problems)
8. [LeetCode Tools](#8-leetcode-tools)
9. [Submissions](#9-submissions)
10. [Profile](#10-profile)
11. [LiveKit (Voice Chat)](#11-livekit-voice-chat)
12. [AI Assistant](#12-ai-assistant)
13. [Code Sharing](#13-code-sharing)
14. [Friends & Social](#14-friends--social)
15. [Proxy Routes](#15-proxy-routes)
16. [Error Codes Reference](#16-error-codes-reference)

---

## 1. Getting Started with Postman

### Environment Setup

Create a Postman environment with these variables:

| Variable | Type | Initial Value | Description |
|---|---|---|---|
| `BASE_URL` | default | `http://localhost:5000` | Backend server URL |
| `AUTH_TOKEN` | secret | *(empty)* | JWT access token (auto-set after login) |
| `REFRESH_TOKEN` | secret | *(empty)* | JWT refresh token (auto-set after login) |
| `USER_ID` | default | *(empty)* | Current user's ID (auto-set after login) |
| `ROOM_ID` | default | *(empty)* | Active room ID |

### Common Headers

For **authenticated routes** (🔒), add:

```
Authorization: Bearer {{AUTH_TOKEN}}
```

For all **POST/PUT** routes, add:

```
Content-Type: application/json
```

### Auto-Set Token Script

Add this to the **Tests** tab of your Login/Register requests to auto-save the token:

```javascript
if (pm.response.code === 200) {
    const json = pm.response.json();
    pm.environment.set("AUTH_TOKEN", json.token);
    if (json.refreshToken) pm.environment.set("REFRESH_TOKEN", json.refreshToken);
    if (json.user && json.user._id) pm.environment.set("USER_ID", json.user._id);
}
```

---

## 2. Authentication

### 2.1 Register

Create a new user account.

```
POST {{BASE_URL}}/api/auth/register
```

**Headers:**
| Key | Value |
|---|---|
| Content-Type | application/json |

**Body (raw JSON):**
```json
{
    "username": "johndoe",
    "email": "john@example.com",
    "password": "SecurePass123"
}
```

**Success Response (200):**
```json
{
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
        "_id": "6650a1b2c3d4e5f6a7b8c9d0",
        "username": "johndoe",
        "email": "john@example.com",
        "solvedProblems": [],
        "platformHandles": {}
    }
}
```

**Error Responses:**
| Status | Body | Cause |
|---|---|---|
| 400 | `{ "error": "All fields are required" }` | Missing username, email, or password |
| 400 | `{ "error": "Password must contain at least one letter and one number" }` | Weak password |
| 400 | `{ "error": "User already exists" }` | Duplicate email |
| 400 | `{ "error": "Username already taken" }` | Duplicate username |

---

### 2.2 Login

Authenticate an existing user.

```
POST {{BASE_URL}}/api/auth/login
```

**Body (raw JSON):**
```json
{
    "email": "john@example.com",
    "password": "SecurePass123"
}
```

**Success Response (200):**
```json
{
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
        "_id": "6650a1b2c3d4e5f6a7b8c9d0",
        "username": "johndoe",
        "email": "john@example.com",
        "solvedProblems": [],
        "platformHandles": {},
        "createdAt": "2025-01-15T10:30:00.000Z"
    }
}
```

**Error Responses:**
| Status | Body | Cause |
|---|---|---|
| 400 | `{ "error": "Invalid credentials" }` | Wrong email or password |
| 403 | `{ "error": "Account is locked. Try again in 15 minutes" }` | Too many failed attempts |
| 429 | `{ "error": "Too many requests" }` | Rate limited (10 attempts / 15 min) |

---

### 2.3 Get Current User 🔒

Get the authenticated user's profile.

```
GET {{BASE_URL}}/api/auth/me
```

**Headers:**
| Key | Value |
|---|---|
| Authorization | Bearer {{AUTH_TOKEN}} |

**Success Response (200):**
```json
{
    "_id": "6650a1b2c3d4e5f6a7b8c9d0",
    "username": "johndoe",
    "email": "john@example.com",
    "solvedProblems": ["two-sum", "valid-parentheses"],
    "platformHandles": {
        "codeforces": "johndoe_cf",
        "leetcode": "johndoe_lc"
    },
    "bio": "CP enthusiast",
    "avatar": "https://avatars.githubusercontent.com/...",
    "createdAt": "2025-01-15T10:30:00.000Z"
}
```

**Error:** `401 { "error": "No token, authorization denied" }`

---

### 2.4 Forgot Password

Send a password reset email.

```
POST {{BASE_URL}}/api/auth/forgot-password
```

**Body (raw JSON):**
```json
{
    "email": "john@example.com"
}
```

**Success Response (200):**
```json
{
    "message": "Password reset email sent"
}
```

**Note:** Always returns 200 even if email doesn't exist (security — prevents user enumeration).

---

### 2.5 Reset Password

Reset password using the token from the email link.

```
POST {{BASE_URL}}/api/auth/reset-password
```

**Body (raw JSON):**
```json
{
    "token": "a1b2c3d4e5f6...",
    "newPassword": "NewSecurePass456"
}
```

**Success Response (200):**
```json
{
    "message": "Password reset successful"
}
```

**Error:** `400 { "error": "Invalid or expired reset token" }`

---

### 2.6 Refresh Token

Get a new access token using a refresh token.

```
POST {{BASE_URL}}/api/auth/refresh-token
```

**Body (raw JSON):**
```json
{
    "refreshToken": "{{REFRESH_TOKEN}}"
}
```

**Success Response (200):**
```json
{
    "token": "eyJhbGciOiJIUzI1NiIs...(new access token)",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...(new refresh token)"
}
```

**Note:** Refresh token rotation — each use generates a NEW refresh token, invalidating the old one.

---

## 3. OAuth

### 3.1 Google OAuth — Initiate

```
GET {{BASE_URL}}/api/oauth/google
```

**Response:** Redirects to Google consent screen. **Use in browser, not Postman.**

---

### 3.2 Google OAuth — Callback

```
GET {{BASE_URL}}/api/oauth/google/callback?code={authorization_code}
```

**Response:** Redirects to `{{FRONTEND_URL}}/auth/callback?token=...&refreshToken=...`

---

### 3.3 GitHub OAuth — Initiate

```
GET {{BASE_URL}}/api/oauth/github
```

**Response:** Redirects to GitHub consent screen. **Use in browser, not Postman.**

---

### 3.4 GitHub OAuth — Callback

```
GET {{BASE_URL}}/api/oauth/github/callback?code={authorization_code}
```

**Response:** Redirects to `{{FRONTEND_URL}}/auth/callback?token=...&refreshToken=...`

---

### 3.5 Link Google Account 🔒

Link a Google account to an existing user.

```
GET {{BASE_URL}}/api/oauth/link/google
```

**Headers:**
| Key | Value |
|---|---|
| Authorization | Bearer {{AUTH_TOKEN}} |

**Response:** Redirects to Google with state containing user ID.

---

### 3.6 Link GitHub Account 🔒

```
GET {{BASE_URL}}/api/oauth/link/github
```

**Response:** Redirects to GitHub with state containing user ID.

---

### 3.7 Check OAuth Connection Status 🔒

```
GET {{BASE_URL}}/api/oauth/connections
```

**Success Response (200):**
```json
{
    "google": true,
    "github": false
}
```

---

### 3.8 Unlink OAuth Account 🔒

```
DELETE {{BASE_URL}}/api/oauth/unlink/:provider
```

**URL Example:** `{{BASE_URL}}/api/oauth/unlink/google`

**Success Response (200):**
```json
{
    "message": "Google account unlinked successfully"
}
```

**Error:** `400 { "error": "Cannot unlink - this is your only login method" }`

---

### 3.9 Refresh OAuth Token

```
POST {{BASE_URL}}/api/oauth/refresh-token
```

**Body (raw JSON):**
```json
{
    "refreshToken": "{{REFRESH_TOKEN}}"
}
```

**Success Response (200):**
```json
{
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

## 4. Code Execution

### 4.1 Execute Code 🔒

Run code in a sandboxed environment via the Piston API.

```
POST {{BASE_URL}}/api/code/execute
```

**Headers:**
| Key | Value |
|---|---|
| Authorization | Bearer {{AUTH_TOKEN}} |
| Content-Type | application/json |

**Body (raw JSON):**
```json
{
    "language": "cpp",
    "code": "#include <iostream>\nusing namespace std;\nint main() {\n    int n;\n    cin >> n;\n    cout << n * 2 << endl;\n    return 0;\n}",
    "stdin": "5"
}
```

**Supported Languages:**

| Language Value | Runtime | Version |
|---|---|---|
| `cpp` | GCC | 10.2.0 |
| `python` | Python | 3.10.0 |
| `java` | OpenJDK | 15.0.2 |
| `javascript` | Node.js | 18.15.0 |

**Success Response (200):**
```json
{
    "run": {
        "stdout": "10\n",
        "stderr": "",
        "code": 0,
        "signal": null,
        "output": "10\n"
    },
    "language": "cpp",
    "version": "10.2.0"
}
```

**Error Responses:**
| Status | Body | Cause |
|---|---|---|
| 401 | `{ "error": "No token, authorization denied" }` | Missing or invalid auth token |
| 400 | `{ "error": "Language and code are required" }` | Missing fields |
| 500 | `{ "error": "Code execution failed" }` | Piston API error |

---

## 5. Files

### 5.1 Get Files 🔒

Get all files for the current user in a specific room.

```
GET {{BASE_URL}}/api/files?roomId={{ROOM_ID}}
```

**Headers:**
| Key | Value |
|---|---|
| Authorization | Bearer {{AUTH_TOKEN}} |

**Success Response (200):**
```json
[
    {
        "_id": "6650b1c2d3e4f5a6b7c8d9e0",
        "name": "solution.cpp",
        "language": "cpp",
        "content": "#include <bits/stdc++.h>\nusing namespace std;...",
        "owner": "6650a1b2c3d4e5f6a7b8c9d0",
        "roomId": "abc123",
        "folder": null,
        "createdAt": "2025-01-15T11:00:00.000Z",
        "updatedAt": "2025-01-15T11:30:00.000Z"
    }
]
```

---

### 5.2 Create File 🔒

```
POST {{BASE_URL}}/api/files
```

**Body (raw JSON):**
```json
{
    "name": "solution.cpp",
    "language": "cpp",
    "content": "#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n    \n    return 0;\n}",
    "roomId": "abc123",
    "folder": null
}
```

**Success Response (201):**
```json
{
    "_id": "6650b1c2d3e4f5a6b7c8d9e0",
    "name": "solution.cpp",
    "language": "cpp",
    "content": "...",
    "owner": "6650a1b2c3d4e5f6a7b8c9d0",
    "roomId": "abc123",
    "folder": null,
    "createdAt": "2025-01-15T11:00:00.000Z"
}
```

---

### 5.3 Update File 🔒

```
PUT {{BASE_URL}}/api/files/:fileId
```

**URL Example:** `{{BASE_URL}}/api/files/6650b1c2d3e4f5a6b7c8d9e0`

**Body (raw JSON):**
```json
{
    "content": "updated code here...",
    "language": "cpp",
    "name": "solution_v2.cpp"
}
```

**Success Response (200):** Updated file object.

---

### 5.4 Delete File 🔒

```
DELETE {{BASE_URL}}/api/files/:fileId
```

**Success Response (200):**
```json
{
    "message": "File deleted"
}
```

---

### 5.5 Rename File 🔒

```
PATCH {{BASE_URL}}/api/files/:fileId/rename
```

**Body (raw JSON):**
```json
{
    "name": "new_name.cpp"
}
```

**Success Response (200):** Updated file object.

---

### 5.6 Create Folder 🔒

```
POST {{BASE_URL}}/api/files/folder
```

**Body (raw JSON):**
```json
{
    "name": "Contest Solutions",
    "roomId": "abc123"
}
```

**Success Response (201):**
```json
{
    "_id": "...",
    "name": "Contest Solutions",
    "isFolder": true,
    "roomId": "abc123",
    "owner": "..."
}
```

---

### 5.7 Move File to Folder 🔒

```
PATCH {{BASE_URL}}/api/files/:fileId/move
```

**Body (raw JSON):**
```json
{
    "folder": "6650c2d3e4f5a6b7c8d9e0f1"
}
```

**Success Response (200):** Updated file object with new `folder` value.

---

## 6. Rooms

### 6.1 Create Room

```
POST {{BASE_URL}}/api/rooms/create
```

**Body (raw JSON):**
```json
{
    "roomId": "my-room-123",
    "host": "johndoe"
}
```

**Success Response (200):**
```json
{
    "roomId": "my-room-123",
    "host": "johndoe",
    "createdAt": "2025-01-15T11:00:00.000Z",
    "expiresAt": "2025-01-16T11:00:00.000Z"
}
```

---

### 6.2 Get Room

```
GET {{BASE_URL}}/api/rooms/:roomId
```

**URL Example:** `{{BASE_URL}}/api/rooms/my-room-123`

**Success Response (200):**
```json
{
    "_id": "...",
    "roomId": "my-room-123",
    "host": "johndoe",
    "participants": ["johndoe", "janedoe"],
    "createdAt": "2025-01-15T11:00:00.000Z"
}
```

**Error:** `404 { "error": "Room not found" }`

---

## 7. Problems

### 7.1 Get Codeforces Problems

Fetch Codeforces problem list (cached).

```
GET {{BASE_URL}}/api/problems
```

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | number | 1 | Page number |
| `limit` | number | 50 | Items per page |
| `tag` | string | - | Filter by problem tag (e.g., "dp", "greedy") |
| `minRating` | number | - | Minimum difficulty rating |
| `maxRating` | number | - | Maximum difficulty rating |

**Example:** `{{BASE_URL}}/api/problems?page=1&limit=20&tag=dp&minRating=1200&maxRating=1600`

**Success Response (200):**
```json
{
    "problems": [
        {
            "contestId": 1890,
            "index": "A",
            "name": "Doremy's Paint 2",
            "rating": 1200,
            "tags": ["data structures", "implementation"],
            "url": "https://codeforces.com/problemset/problem/1890/A"
        }
    ],
    "total": 9500,
    "page": 1,
    "pages": 475
}
```

---

### 7.2 Get Codeforces Problem by ID

```
GET {{BASE_URL}}/api/problems/codeforces/:contestId/:index
```

**URL Example:** `{{BASE_URL}}/api/problems/codeforces/1890/A`

**Success Response (200):**
```json
{
    "contestId": 1890,
    "index": "A",
    "name": "Doremy's Paint 2",
    "rating": 1200,
    "tags": ["data structures", "implementation"],
    "content": "<div class='problem-statement'>...</div>",
    "url": "https://codeforces.com/problemset/problem/1890/A",
    "timeLimit": "2 seconds",
    "memoryLimit": "256 megabytes",
    "sampleTests": [
        { "input": "3\n1 2 3", "output": "1" }
    ]
}
```

---

### 7.3 Search Problems

Full-text search across all cached problems.

```
GET {{BASE_URL}}/api/problems/search?q=two+sum
```

**Success Response (200):**
```json
{
    "results": [
        {
            "name": "Two Sum",
            "platform": "leetcode",
            "slug": "two-sum",
            "difficulty": "Easy"
        }
    ]
}
```

---

### 7.4 Get LeetCode Problem

```
GET {{BASE_URL}}/api/problems/leetcode/:slug
```

**URL Example:** `{{BASE_URL}}/api/problems/leetcode/two-sum`

**Success Response (200):**
```json
{
    "title": "Two Sum",
    "slug": "two-sum",
    "difficulty": "Easy",
    "content": "<p>Given an array of integers nums and an integer target...</p>",
    "sampleTestCase": "[2,7,11,15]\n9",
    "topicTags": ["Array", "Hash Table"],
    "codeSnippets": [
        {
            "lang": "C++",
            "langSlug": "cpp",
            "code": "class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        \n    }\n};"
        }
    ],
    "stats": {
        "totalAccepted": "15.2M",
        "totalSubmission": "30.1M"
    }
}
```

---

### 7.5 Get CSES Problem

```
GET {{BASE_URL}}/api/problems/cses/:problemId
```

**URL Example:** `{{BASE_URL}}/api/problems/cses/1068`

**Success Response (200):**
```json
{
    "title": "Weird Algorithm",
    "content": "<p>Consider an algorithm that takes as input a positive integer n...</p>",
    "timeLimit": "1.00 s",
    "memoryLimit": "512 MB",
    "url": "https://cses.fi/problemset/task/1068"
}
```

---

### 7.6 Get GeeksforGeeks Problem

```
GET {{BASE_URL}}/api/problems/gfg/:slug
```

**URL Example:** `{{BASE_URL}}/api/problems/gfg/array-leaders`

---

### 7.7 Get AtCoder Problem

```
GET {{BASE_URL}}/api/problems/atcoder/:contestId/:taskId
```

**URL Example:** `{{BASE_URL}}/api/problems/atcoder/abc300/abc300_a`

---

### 7.8 Get A2Z Sheet Data

Get all topics and problems from Striver's A2Z DSA Sheet.

```
GET {{BASE_URL}}/api/problems/a2z/sheet
```

**Success Response (200):**
```json
{
    "topics": [
        {
            "name": "Arrays",
            "problems": [
                {
                    "title": "Two Sum",
                    "difficulty": "Easy",
                    "platform": "leetcode",
                    "slug": "two-sum",
                    "link": "https://leetcode.com/problems/two-sum/"
                }
            ]
        }
    ]
}
```

---

### 7.9 Get CP-31 Sheet

```
GET {{BASE_URL}}/api/problems/cp31
```

---

### 7.10 Get Problem Tags

Get all available problem tags for filtering.

```
GET {{BASE_URL}}/api/problems/tags
```

**Success Response (200):**
```json
{
    "tags": ["dp", "greedy", "graphs", "trees", "binary search", "implementation", ...]
}
```

---

### 7.11 Get Problem Editorial

```
GET {{BASE_URL}}/api/problems/editorial/:contestId/:index
```

**URL Example:** `{{BASE_URL}}/api/problems/editorial/1890/A`

**Success Response (200):**
```json
{
    "title": "Doremy's Paint 2 — Editorial",
    "content": "## Approach\n\nWe can solve this using...",
    "author": "editorial_writer"
}
```

---

### 7.12 Get Codeforces Contests

```
GET {{BASE_URL}}/api/problems/contests
```

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| `type` | string | `"upcoming"` or `"past"` |

---

### 7.13 Get Codeforces Standings

```
GET {{BASE_URL}}/api/problems/standings/:contestId
```

---

### 7.14-7.18 Additional Problem Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/problems/health` | Problem scraper health check |
| `GET` | `/api/problems/codeforces/random` | Random CF problem (with optional tag/rating filter) |
| `GET` | `/api/problems/daily` | Daily problem challenge |
| `POST` | `/api/problems/batch` | Batch fetch multiple problems |
| `GET` | `/api/problems/stats` | Problem database statistics |

---

## 8. LeetCode Tools

### 8.1 Submit to LeetCode 🔒

Submit code to LeetCode (requires browser extension for session cookies).

```
POST {{BASE_URL}}/api/leettools/submit
```

**Headers:**
| Key | Value |
|---|---|
| Authorization | Bearer {{AUTH_TOKEN}} |
| Content-Type | application/json |

**Body (raw JSON):**
```json
{
    "slug": "two-sum",
    "code": "class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        unordered_map<int,int> m;\n        for(int i=0;i<nums.size();i++){\n            if(m.count(target-nums[i])) return {m[target-nums[i]],i};\n            m[nums[i]]=i;\n        }\n        return {};\n    }\n};",
    "language": "cpp",
    "leetcode_session": "eyJ0eXAiOiJKV1QiLCJhbGciOi...",
    "csrf_token": "abc123def456..."
}
```

**Note:** `leetcode_session` and `csrf_token` come from the browser extension which reads them from LeetCode's cookies.

**Success Response (200):**
```json
{
    "submission_id": 1234567890,
    "status": "Accepted",
    "runtime": "4 ms",
    "memory": "8.2 MB"
}
```

---

## 9. Submissions

### 9.1 Get User Submissions 🔒

```
GET {{BASE_URL}}/api/submissions
```

**Headers:**
| Key | Value |
|---|---|
| Authorization | Bearer {{AUTH_TOKEN}} |

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `platform` | string | - | Filter: `"codeforces"`, `"leetcode"` |
| `status` | string | - | Filter: `"Accepted"`, `"Wrong Answer"`, etc. |
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |

**Example:** `{{BASE_URL}}/api/submissions?platform=codeforces&status=Accepted&page=1`

**Success Response (200):**
```json
{
    "submissions": [
        {
            "_id": "...",
            "user": "6650a1b2c3d4e5f6a7b8c9d0",
            "problemName": "Two Sum",
            "platform": "leetcode",
            "language": "cpp",
            "code": "class Solution { ... }",
            "status": "Accepted",
            "runtime": "4 ms",
            "memory": "8.2 MB",
            "createdAt": "2025-01-15T12:00:00.000Z"
        }
    ],
    "total": 42,
    "page": 1,
    "pages": 3
}
```

---

### 9.2 Create Submission 🔒

```
POST {{BASE_URL}}/api/submissions
```

**Body (raw JSON):**
```json
{
    "problemName": "Two Sum",
    "problemId": "two-sum",
    "platform": "leetcode",
    "language": "cpp",
    "code": "class Solution { ... }",
    "status": "Accepted",
    "runtime": "4 ms",
    "memory": "8.2 MB",
    "contestId": null,
    "problemIndex": null
}
```

---

### 9.3 Get Submission by ID

```
GET {{BASE_URL}}/api/submissions/:id
```

---

### 9.4 Get Submission Stats 🔒

```
GET {{BASE_URL}}/api/submissions/stats
```

**Success Response (200):**
```json
{
    "total": 42,
    "accepted": 35,
    "byPlatform": {
        "codeforces": 20,
        "leetcode": 22
    },
    "byLanguage": {
        "cpp": 30,
        "python": 12
    },
    "recentActivity": [
        { "date": "2025-01-15", "count": 5 },
        { "date": "2025-01-14", "count": 3 }
    ]
}
```

---

### 9.5 Delete Submission 🔒

```
DELETE {{BASE_URL}}/api/submissions/:id
```

---

## 10. Profile

### 10.1 Get User Profile

```
GET {{BASE_URL}}/api/profile/:username
```

**URL Example:** `{{BASE_URL}}/api/profile/johndoe`

**Success Response (200):**
```json
{
    "username": "johndoe",
    "bio": "CP enthusiast | Codeforces Expert",
    "avatar": "https://avatars.githubusercontent.com/...",
    "platformHandles": {
        "codeforces": "johndoe_cf",
        "leetcode": "johndoe_lc",
        "codechef": "johndoe_cc"
    },
    "solvedProblems": ["two-sum", "valid-parentheses"],
    "stats": {
        "totalSolved": 150,
        "submissions": 200,
        "acceptanceRate": 75
    },
    "createdAt": "2025-01-15T10:30:00.000Z"
}
```

---

### 10.2 Update Profile 🔒

```
PUT {{BASE_URL}}/api/profile
```

**Headers:**
| Key | Value |
|---|---|
| Authorization | Bearer {{AUTH_TOKEN}} |

**Body (raw JSON):**
```json
{
    "bio": "CP enthusiast | Codeforces Expert",
    "platformHandles": {
        "codeforces": "johndoe_cf",
        "leetcode": "johndoe_lc",
        "codechef": "johndoe_cc",
        "atcoder": "johndoe_at"
    }
}
```

**Success Response (200):**
```json
{
    "message": "Profile updated",
    "user": { ... }
}
```

---

### 10.3 Get User Activity

```
GET {{BASE_URL}}/api/profile/:username/activity
```

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |

**Success Response (200):**
```json
{
    "activities": [
        {
            "type": "submission",
            "problemName": "Two Sum",
            "platform": "leetcode",
            "status": "Accepted",
            "timestamp": "2025-01-15T12:00:00.000Z"
        },
        {
            "type": "room_created",
            "roomId": "abc123",
            "timestamp": "2025-01-15T11:00:00.000Z"
        }
    ],
    "total": 100,
    "page": 1
}
```

---

## 11. LiveKit (Voice Chat)

### 11.1 Get Voice Chat Token

Generate a LiveKit token for joining a voice room.

```
POST {{BASE_URL}}/api/livekit/token
```

**Body (raw JSON):**
```json
{
    "roomId": "abc123",
    "username": "johndoe"
}
```

**Success Response (200):**
```json
{
    "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Note:** This token is passed to the LiveKit client SDK to connect to the voice room. The token contains the room name and participant identity, and is signed with the LiveKit API secret.

---

## 12. AI Assistant

### 12.1 Ask AI

Get AI-powered help for coding problems.

```
POST {{BASE_URL}}/api/ai/ask
```

**Body (raw JSON):**
```json
{
    "prompt": "Explain the two-pointer technique for solving the Two Sum problem",
    "code": "// optional: include current code for context",
    "language": "cpp",
    "context": "I'm trying to solve Two Sum on LeetCode"
}
```

**Success Response (200):**
```json
{
    "response": "## Two-Pointer Technique for Two Sum\n\nThe two-pointer approach works on **sorted arrays**...\n\n```cpp\nvector<int> twoSum(vector<int>& nums, int target) {\n    // Sort with original indices...\n}\n```\n\n**Time Complexity:** O(n log n) for sorting\n**Space Complexity:** O(n) for storing indices"
}
```

**Note:** Response is in Markdown format. The AI uses Google Gemini 2.5 Flash and is optimized for competitive programming help.

---

## 13. Code Sharing

### 13.1 Create Shared Code

Share code with a short URL.

```
POST {{BASE_URL}}/api/share
```

**Body (raw JSON):**
```json
{
    "code": "#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n    cout << \"Hello World!\" << endl;\n}",
    "language": "cpp",
    "title": "My Solution"
}
```

**Success Response (201):**
```json
{
    "id": "abc12345",
    "url": "http://localhost:5173/share/abc12345",
    "expiresAt": "2025-01-22T11:00:00.000Z"
}
```

**Note:** Shared codes expire after **7 days** (TTL index).

---

### 13.2 Get Shared Code

```
GET {{BASE_URL}}/api/share/:id
```

**URL Example:** `{{BASE_URL}}/api/share/abc12345`

**Success Response (200):**
```json
{
    "code": "#include <bits/stdc++.h>\n...",
    "language": "cpp",
    "title": "My Solution",
    "createdAt": "2025-01-15T11:00:00.000Z",
    "expiresAt": "2025-01-22T11:00:00.000Z"
}
```

**Error:** `404 { "error": "Shared code not found or expired" }`

---

## 14. Friends & Social

All friend endpoints require authentication (🔒).

### 14.1 Send Friend Request 🔒

```
POST {{BASE_URL}}/api/friends/request
```

**Headers:**
| Key | Value |
|---|---|
| Authorization | Bearer {{AUTH_TOKEN}} |

**Body (raw JSON):**
```json
{
    "username": "janedoe"
}
```

**Success Response (200):**
```json
{
    "message": "Friend request sent"
}
```

**Error Responses:**
| Status | Body | Cause |
|---|---|---|
| 400 | `{ "error": "Cannot send friend request to yourself" }` | Self-request |
| 400 | `{ "error": "Friend request already sent" }` | Duplicate request |
| 404 | `{ "error": "User not found" }` | Invalid username |

---

### 14.2 Accept Friend Request 🔒

```
POST {{BASE_URL}}/api/friends/accept
```

**Body (raw JSON):**
```json
{
    "requestId": "6650d4e5f6a7b8c9d0e1f2a3"
}
```

**Success Response (200):**
```json
{
    "message": "Friend request accepted"
}
```

---

### 14.3 Reject Friend Request 🔒

```
POST {{BASE_URL}}/api/friends/reject
```

**Body (raw JSON):**
```json
{
    "requestId": "6650d4e5f6a7b8c9d0e1f2a3"
}
```

---

### 14.4 Get Friends List 🔒

```
GET {{BASE_URL}}/api/friends
```

**Success Response (200):**
```json
{
    "friends": [
        {
            "username": "janedoe",
            "avatar": "https://...",
            "bio": "CP lover",
            "isOnline": true,
            "lastSeen": "2025-01-15T12:00:00.000Z"
        }
    ]
}
```

---

### 14.5 Get Pending Requests 🔒

```
GET {{BASE_URL}}/api/friends/requests
```

**Success Response (200):**
```json
{
    "incoming": [
        {
            "_id": "6650d4e5f6a7b8c9d0e1f2a3",
            "from": {
                "username": "janedoe",
                "avatar": "https://..."
            },
            "createdAt": "2025-01-15T11:00:00.000Z"
        }
    ],
    "outgoing": []
}
```

---

### 14.6 Remove Friend 🔒

```
DELETE {{BASE_URL}}/api/friends/:username
```

**URL Example:** `{{BASE_URL}}/api/friends/janedoe`

---

### 14.7 Search Users 🔒

```
GET {{BASE_URL}}/api/friends/search?q=jane
```

**Success Response (200):**
```json
{
    "users": [
        {
            "username": "janedoe",
            "avatar": "https://...",
            "isFriend": false,
            "requestSent": false
        }
    ]
}
```

---

### 14.8 Get Activity Feed 🔒

Get recent activities from friends.

```
GET {{BASE_URL}}/api/friends/feed
```

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |

---

### 14.9 Update Online Status 🔒

```
POST {{BASE_URL}}/api/friends/status
```

**Body (raw JSON):**
```json
{
    "isOnline": true,
    "currentRoom": "abc123"
}
```

---

## 15. Proxy Routes

These routes proxy requests to external services to avoid CORS issues.

### 15.1 CodeChef Proxy

```
GET {{BASE_URL}}/codechef/*
```

Proxies requests to `https://www.codechef.com/`. Useful for fetching CodeChef problem data.

### 15.2 Codeforces API Proxy

```
GET {{BASE_URL}}/codeforces-api/*
```

Proxies to `https://codeforces.com/api/`. Useful for fetching user info, contest standings.

### 15.3 Codeforces Site Proxy

```
GET {{BASE_URL}}/codeforces/*
```

Proxies to `https://codeforces.com/`. Useful for fetching problem pages.

### 15.4 LeetCode GraphQL Proxy

```
POST {{BASE_URL}}/leetcode/*
```

Proxies to `https://leetcode.com/`. Useful for GraphQL queries to LeetCode.

**Example — Fetch LeetCode problem via proxy:**
```
POST {{BASE_URL}}/leetcode/graphql
```

**Body (raw JSON):**
```json
{
    "query": "query questionData($titleSlug: String!) { question(titleSlug: $titleSlug) { title difficulty content } }",
    "variables": { "titleSlug": "two-sum" }
}
```

---

## 16. Error Codes Reference

### Standard HTTP Status Codes

| Status | Meaning | Common Causes |
|---|---|---|
| 200 | OK | Request successful |
| 201 | Created | Resource created (files, submissions, shared code) |
| 400 | Bad Request | Missing required fields, validation errors |
| 401 | Unauthorized | Missing or expired JWT token |
| 403 | Forbidden | Account locked, insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate resource (username, email) |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server-side error |

### Standard Error Response Format

All errors follow this format:

```json
{
    "error": "Human-readable error message"
}
```

### Rate Limits

| Route Group | Limit | Window |
|---|---|---|
| Authentication (`/api/auth/login`, `/register`) | 10 requests | 15 minutes |
| General API | Varies | Per minute |
| AI Assistant (`/api/ai`) | Custom | Per user |
| Code Execution (`/api/code/execute`) | Custom | Per user |

### Authentication Error Quick Fix

If you get `401 { "error": "No token, authorization denied" }`:

1. Check that you've logged in and saved the token
2. Verify the `Authorization` header is `Bearer {{AUTH_TOKEN}}` (with space after "Bearer")
3. If token expired, call **Refresh Token** (Section 2.6) to get a new one
4. Make sure the environment variable `AUTH_TOKEN` is set in Postman

---

*Generated for the CodePlay project. See [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md) for the full project architecture documentation.*
