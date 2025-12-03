# Test Scripts

## Create Test Users Script

This script creates 100 test users following a binary tree structure.

### Features

- Creates 100 users with userIds in format `CROWN-XXXXXX`
- Root user: `CROWN-000000`
- Sequential users: `CROWN-000001` to `CROWN-000100`
- Each user is automatically linked to their parent in the binary tree
- Binary tree structure is maintained:
  - User 1 (CROWN-000001): Parent = CROWN-000000, Right
  - User 2 (CROWN-000002): Parent = CROWN-000000, Left
  - User 3 (CROWN-000003): Parent = CROWN-000001, Right
  - User 4 (CROWN-000004): Parent = CROWN-000001, Left
  - And so on...

### Usage

```bash
# Using npm script
npm run test:users

# Or directly with ts-node
npx ts-node -r dotenv/config src/scripts/createTestUsers.ts
```

### Prerequisites

- MongoDB connection string in `.env` file as `MONGODB_URL_DEVELOPMENT` or `MONGODB_URI`
- Database should be accessible

### What It Does

1. Connects to MongoDB
2. Creates root user `CROWN-000000` if it doesn't exist
3. Creates 100 users (CROWN-000001 to CROWN-000100)
4. For each user:
   - Calculates parent and position based on binary tree structure
   - Creates user account
   - Initializes binary tree entry
   - Creates 7 default wallets
   - Links to parent in binary tree

### Output

The script provides progress updates and a summary:
- Progress indicators every 10 users
- Final summary with counts
- Verification of binary tree and wallet creation

### Test User Details

- **Name**: Test User {number}
- **Email**: user{number}@test.com
- **Phone**: 123456{number} (padded)
- **Password**: Test1234!
- **Status**: active

### Binary Tree Pattern

The script follows a complete binary tree structure:
- Level 0: CROWN-000000 (root)
- Level 1: CROWN-000001 (right), CROWN-000002 (left)
- Level 2: CROWN-000003 (right of 000001), CROWN-000004 (left of 000001), etc.

Each user is placed in the first available position in their parent's binary tree.

