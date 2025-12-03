# Admin API Documentation

Base URL: `http://localhost:8000` (or your configured PORT)

All admin endpoints are prefixed with `/api/v1/admin`

---

## Table of Contents

1. [Admin Signup](#admin-signup)
2. [Admin Login](#admin-login)
3. [Admin Logout](#admin-logout)
4. [Get Admin Profile](#get-admin-profile)

---

## Admin Signup

Create a new admin account.

**Endpoint:** `POST /api/v1/admin/signup`

**Authentication:** Not required

**Request Body:**
```json
{
  "name": "Admin Name",
  "email": "admin@example.com",
  "password": "password123",
  "phone": "1234567890",
  "role": 2
}
```

**Fields:**
- `name` (required): Admin's full name
- `email` (required): Admin's email address (must be unique)
- `password` (required): Password (minimum 8 characters)
- `phone` (optional): Admin's phone number
- `role` (optional): Admin role (1=SUPERADMIN, 2=ADMIN, 3=SUPPORT, 4=MANAGER). Defaults to 2 (ADMIN)

**cURL Command:**
```bash
curl -X POST http://localhost:8000/api/v1/admin/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "admin@example.com",
    "password": "securepassword123",
    "phone": "1234567890",
    "role": 2
  }'
```

**Success Response (201):**
```json
{
  "status": "success",
  "message": "Admin created successfully",
  "data": {
    "admin": {
      "id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "admin@example.com",
      "phone": "1234567890",
      "role": 2,
      "isVerified": false
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Responses:**
- `400`: Missing required fields or invalid data
- `409`: Admin with email already exists

---

## Admin Login

Authenticate an admin and receive a JWT token.

**Endpoint:** `POST /api/v1/admin/login`

**Authentication:** Not required

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Fields:**
- `email` (required): Admin's email address
- `password` (required): Admin's password

**cURL Command:**
```bash
curl -X POST http://localhost:8000/api/v1/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "securepassword123"
  }'
```

**With Cookie Storage:**
```bash
curl -X POST http://localhost:8000/api/v1/admin/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "admin@example.com",
    "password": "securepassword123"
  }'
```

**Success Response (200):**
```json
{
  "status": "success",
  "message": "Login successful",
  "data": {
    "admin": {
      "id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "admin@example.com",
      "phone": "1234567890",
      "role": 2,
      "isVerified": true
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Responses:**
- `400`: Missing email or password
- `401`: Invalid email or password
- `403`: Admin account not verified

---

## Admin Logout

Logout and clear the admin authentication token.

**Endpoint:** `POST /api/v1/admin/logout`

**Authentication:** Required (Admin token)

**cURL Command (Using Bearer Token):**
```bash
curl -X POST http://localhost:8000/api/v1/admin/logout \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN_HERE"
```

**cURL Command (Using Cookie):**
```bash
curl -X POST http://localhost:8000/api/v1/admin/logout \
  -b cookies.txt
```

**Success Response (200):**
```json
{
  "status": "success",
  "message": "Logout successful"
}
```

**Error Responses:**
- `401`: Invalid or missing admin token

---

## Get Admin Profile

Get the current authenticated admin's profile information.

**Endpoint:** `GET /api/v1/admin/me`

**Authentication:** Required (Admin token)

**cURL Command (Using Bearer Token):**
```bash
curl -X GET http://localhost:8000/api/v1/admin/me \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN_HERE"
```

**cURL Command (Using Cookie):**
```bash
curl -X GET http://localhost:8000/api/v1/admin/me \
  -b cookies.txt
```

**Success Response (200):**
```json
{
  "status": "success",
  "data": {
    "admin": {
      "id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "admin@example.com",
      "phone": "1234567890",
      "role": 2,
      "isVerified": true,
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

**Error Responses:**
- `401`: Admin not authenticated
- `404`: Admin not found

---

## Authentication Methods

The API supports two methods of authentication:

### 1. Bearer Token (Header)
Include the token in the Authorization header:
```bash
-H "Authorization: Bearer YOUR_ADMIN_TOKEN_HERE"
```

### 2. Cookie (Recommended for Web)
The token is automatically stored in a cookie named `adminToken` after login. Use:
```bash
-b cookies.txt  # Load cookies from file
# or
--cookie "adminToken=YOUR_ADMIN_TOKEN_HERE"  # Direct cookie value
```

---

## Complete Workflow Example

### Step 1: Signup
```bash
curl -X POST http://localhost:8000/api/v1/admin/signup \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "name": "John Doe",
    "email": "admin@example.com",
    "password": "securepassword123",
    "role": 2
  }'
```

### Step 2: Login (if not already logged in)
```bash
curl -X POST http://localhost:8000/api/v1/admin/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "admin@example.com",
    "password": "securepassword123"
  }'
```

### Step 3: Get Profile (using saved cookie)
```bash
curl -X GET http://localhost:8000/api/v1/admin/me \
  -b cookies.txt
```

### Step 4: Logout
```bash
curl -X POST http://localhost:8000/api/v1/admin/logout \
  -b cookies.txt
```

---

## Admin Roles

| Role Value | Role Name | Description |
|------------|-----------|-------------|
| 1 | SUPERADMIN | Highest level admin with all permissions |
| 2 | ADMIN | Standard admin user (default) |
| 3 | SUPPORT | Support staff with limited permissions |
| 4 | MANAGER | Manager with specific permissions |

---

## Error Response Format

All error responses follow this format:

```json
{
  "status": "error",
  "message": "Error description here"
}
```

In development mode, stack traces may also be included.

---

## Notes

- All timestamps are in ISO 8601 format (UTC)
- Passwords must be at least 8 characters long
- Email addresses are case-insensitive and stored in lowercase
- Admin tokens expire after 7 days (configurable via `ADMIN_JWT_EXPIRES_IN`)
- The `adminToken` cookie is httpOnly and secure in production

