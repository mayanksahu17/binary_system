# User API Documentation

Base URL: `http://localhost:8000` (or your configured PORT)

All user endpoints are prefixed with `/api/v1/auth`

---

## Table of Contents

1. [User Signup](#user-signup)
2. [User Login](#user-login)
3. [User Logout](#user-logout)
4. [Get User Profile](#get-user-profile)

---

## User Signup

Create a new user account in the binary MLM system. This will automatically:
- Create the user account
- Initialize binary tree entry
- Create default wallets (withdrawal, ROI, referral, binary, etc.)
- Link to referrer if provided

**Endpoint:** `POST /api/v1/auth/signup`

**Authentication:** Not required

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "user@example.com",
  "phone": "1234567890",
  "password": "password123",
  "referrerId": "507f1f77bcf86cd799439011",
  "position": "left"
}
```

**Fields:**
- `name` (required): User's full name
- `email` (optional): User's email address (either email or phone required)
- `phone` (optional): User's phone number (either email or phone required)
- `password` (required): Password (minimum 8 characters)
- `referrerId` (optional): ID of the referring user (for binary tree placement)
- `position` (optional): Position in referrer's binary tree ("left" or "right"). If not provided, system will find available position.

**cURL Command:**
```bash
curl -X POST http://localhost:8000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "user@example.com",
    "phone": "1234567890",
    "password": "securepassword123",
    "referrerId": "507f1f77bcf86cd799439011",
    "position": "left"
  }'
```

**Signup with Email only:**
```bash
curl -X POST http://localhost:8000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Smith",
    "email": "jane@example.com",
    "password": "securepassword123"
  }'
```

**Signup with Phone only:**
```bash
curl -X POST http://localhost:8000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bob Johnson",
    "phone": "9876543210",
    "password": "securepassword123"
  }'
```

**Success Response (201):**
```json
{
  "status": "success",
  "message": "User created successfully",
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "userId": null,
      "name": "John Doe",
      "email": "user@example.com",
      "phone": "1234567890",
      "referrer": "507f1f77bcf86cd799439010",
      "position": "left",
      "status": "active"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Responses:**
- `400`: Missing required fields, invalid data, or invalid referrer
- `409`: User with email/phone already exists

---

## User Login

Authenticate a user and receive a JWT token. Users can login with either email or phone.

**Endpoint:** `POST /api/v1/auth/login`

**Authentication:** Not required

**Request Body (with Email):**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Request Body (with Phone):**
```json
{
  "phone": "1234567890",
  "password": "password123"
}
```

**Fields:**
- `email` (optional): User's email address (either email or phone required)
- `phone` (optional): User's phone number (either email or phone required)
- `password` (required): User's password

**cURL Command (Email Login):**
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "user@example.com",
    "password": "securepassword123"
  }'
```

**cURL Command (Phone Login):**
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "phone": "1234567890",
    "password": "securepassword123"
  }'
```

**Success Response (200):**
```json
{
  "status": "success",
  "message": "Login successful",
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "userId": null,
      "name": "John Doe",
      "email": "user@example.com",
      "phone": "1234567890",
      "referrer": "507f1f77bcf86cd799439010",
      "position": "left",
      "status": "active"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Responses:**
- `400`: Missing email/phone or password
- `401`: Invalid credentials
- `403`: Account is not active (suspended, blocked, etc.)

---

## User Logout

Logout and clear the user authentication token.

**Endpoint:** `POST /api/v1/auth/logout`

**Authentication:** Required (User token)

**cURL Command (Using Bearer Token):**
```bash
curl -X POST http://localhost:8000/api/v1/auth/logout \
  -H "Authorization: Bearer YOUR_USER_TOKEN_HERE"
```

**cURL Command (Using Cookie):**
```bash
curl -X POST http://localhost:8000/api/v1/auth/logout \
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
- `401`: Invalid or missing user token

---

## Get User Profile

Get the current authenticated user's profile information.

**Endpoint:** `GET /api/v1/auth/me`

**Authentication:** Required (User token)

**cURL Command (Using Bearer Token):**
```bash
curl -X GET http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_USER_TOKEN_HERE"
```

**cURL Command (Using Cookie):**
```bash
curl -X GET http://localhost:8000/api/v1/auth/me \
  -b cookies.txt
```

**Success Response (200):**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "userId": null,
      "name": "John Doe",
      "email": "user@example.com",
      "phone": "1234567890",
      "referrer": "507f1f77bcf86cd799439010",
      "position": "left",
      "status": "active",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

**Error Responses:**
- `401`: User not authenticated
- `404`: User not found

---

## Authentication Methods

The API supports two methods of authentication:

### 1. Bearer Token (Header)
Include the token in the Authorization header:
```bash
-H "Authorization: Bearer YOUR_USER_TOKEN_HERE"
```

### 2. Cookie (Recommended for Web)
The token is automatically stored in a cookie named `token` after login. Use:
```bash
-b cookies.txt  # Load cookies from file
# or
--cookie "token=YOUR_USER_TOKEN_HERE"  # Direct cookie value
```

---

## Complete Workflow Example

### Step 1: Signup (with Referrer)
```bash
curl -X POST http://localhost:8000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "1234567890",
    "password": "securepassword123",
    "referrerId": "507f1f77bcf86cd799439010",
    "position": "left"
  }'
```

### Step 2: Login (if not already logged in)
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "john@example.com",
    "password": "securepassword123"
  }'
```

### Step 3: Get Profile (using saved cookie)
```bash
curl -X GET http://localhost:8000/api/v1/auth/me \
  -b cookies.txt
```

### Step 4: Logout
```bash
curl -X POST http://localhost:8000/api/v1/auth/logout \
  -b cookies.txt
```

---

## Binary MLM System Features

When a user signs up:

1. **Binary Tree Initialization**: A binary tree entry is automatically created for the user
2. **Wallet Creation**: Default wallets are created for:
   - Withdrawal
   - ROI (Return on Investment)
   - Referral Binary
   - Interest
   - Referral
   - Binary
   - Token

3. **Referrer Linking**: If a referrer is provided:
   - User is linked to the referrer in the binary tree
   - Position (left/right) is assigned
   - Referrer's downline count is updated

4. **Position Assignment**: 
   - If position is specified, user is placed in that position
   - If position is not specified, system finds the first available position (left or right)
   - If both positions are filled, system will need additional logic (to be implemented)

---

## User Status Values

| Status | Description |
|--------|-------------|
| `active` | User account is active and can use the system |
| `inactive` | User account is inactive |
| `suspended` | User account is temporarily suspended |
| `blocked` | User account is permanently blocked |
| `suspected` | User account is under investigation |

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
- User tokens expire after 7 days (configurable via `JWT_EXPIRES_IN`)
- The `token` cookie is httpOnly and secure in production
- Users can login with either email OR phone (not both required)
- Binary tree and wallets are automatically initialized on signup
- Referrer must be an active user for successful signup with referrer

