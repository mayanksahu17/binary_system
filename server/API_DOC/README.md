# API Documentation

This directory contains API documentation for the Binary System backend.

## Available Documentation

- [Admin API Documentation](./ADMIN_API.md) - Admin authentication and management endpoints
- [User API Documentation](./USER_API.md) - User authentication and binary MLM system endpoints

## Quick Start

### Base URL
```
http://localhost:8000
```

### API Version
All endpoints are prefixed with `/api/v1`

### Testing with cURL

All documentation includes cURL commands for testing. You can:

1. Copy the cURL command from the documentation
2. Replace `YOUR_ADMIN_TOKEN_HERE` with actual tokens
3. Adjust the base URL if your server runs on a different port
4. Save cookies using `-c cookies.txt` for easier testing

### Example: Testing Admin Login

```bash
curl -X POST http://localhost:8000/api/v1/admin/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "admin@example.com",
    "password": "yourpassword"
  }'
```

### Using Saved Cookies

After login, you can use saved cookies for authenticated requests:

```bash
curl -X GET http://localhost:8000/api/v1/admin/me \
  -b cookies.txt
```

## Environment Variables

Make sure these are set in your `.env` file:

```env
PORT=8000
ADMIN_JWT_SECRET=your_secure_admin_secret_key
ADMIN_JWT_EXPIRES_IN=7d
JWT_SECRET=your_secure_user_secret_key
JWT_EXPIRES_IN=7d
```

## Response Format

### Success Response
```json
{
  "status": "success",
  "message": "Operation successful",
  "data": { ... }
}
```

### Error Response
```json
{
  "status": "error",
  "message": "Error description"
}
```

## Authentication

The API uses JWT tokens for authentication. Tokens can be sent via:

1. **Authorization Header**: `Authorization: Bearer <token>`
2. **Cookie**: `adminToken=<token>` (automatically set after login)

## More Documentation

- See [ADMIN_API.md](./ADMIN_API.md) for detailed admin API documentation

