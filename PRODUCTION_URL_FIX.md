# Production URL Fix for Referral Links

## Issue
Referral links were showing `http://localhost:3000` in production instead of the production domain.

## Solution
Updated the backend to use `CLIENT_URL` environment variable (which is set in docker-compose.yml) instead of hardcoded localhost.

## Changes Made

### Backend Changes

1. **`server/src/controllers/user.controller.ts`** (getUserReferralLinks):
   - Changed from: `process.env.FRONTEND_URL || "http://localhost:3000"`
   - Changed to: `process.env.CLIENT_URL || process.env.FRONTEND_URL || "http://localhost:3000"`

2. **`server/src/controllers/admin.controller.ts`** (tree links):
   - Changed from: `process.env.FRONTEND_URL || "http://localhost:3000"`
   - Changed to: `process.env.CLIENT_URL || process.env.FRONTEND_URL || "http://localhost:3000"`

## Configuration

### In docker-compose.yml
The `CLIENT_URL` environment variable is already configured:

```yaml
environment:
  - CLIENT_URL=${CLIENT_URL:-http://localhost:3000}
```

### In .env file
Make sure your `.env` file has the correct `CLIENT_URL` for production:

```env
# For production, use your actual domain
CLIENT_URL=http://your-production-domain.com:3000

# Or if using reverse proxy (nginx)
CLIENT_URL=https://your-production-domain.com
```

## Deployment Steps

1. **Update .env file on server:**
   ```bash
   cd /root/webapps/binary_system
   nano .env
   ```
   
   Set:
   ```env
   CLIENT_URL=http://199.188.204.202:3000
   # OR if using domain name:
   # CLIENT_URL=https://yourdomain.com
   ```

2. **Rebuild backend container:**
   ```bash
   docker compose build backend
   docker compose up -d backend
   ```

3. **Verify:**
   - Check logs: `docker compose logs backend`
   - Test referral links endpoint: `curl http://localhost:8000/api/v1/user/referral-links` (with auth)
   - Check dashboard to see if referral links now show production URL

## Testing

After deployment, verify referral links show the correct production URL:

1. Login to dashboard
2. Check "Referral Links" section
3. Links should show: `http://199.188.204.202:3000/signup?referrer=...` (or your production domain)

Instead of: `http://localhost:3000/signup?referrer=...`

## Notes

- `CLIENT_URL` takes priority over `FRONTEND_URL` for consistency
- Falls back to `FRONTEND_URL` for backward compatibility
- Falls back to `http://localhost:3000` only in development
- Make sure `CLIENT_URL` matches your actual frontend URL in production
