# Test and Automation Commands Documentation

This document provides a comprehensive guide to all test scripts and automation commands available in the Binary System project.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Development Commands](#development-commands)
- [Test Scripts](#test-scripts)
- [User Creation Scripts](#user-creation-scripts)
- [Data Seeding Scripts](#data-seeding-scripts)
- [Binary Bonus Test Scripts](#binary-bonus-test-scripts)
- [Migration Scripts](#migration-scripts)
- [Utility Scripts](#utility-scripts)
- [Environment Setup](#environment-setup)

---

## Prerequisites

Before running any scripts, ensure you have:

1. **Node.js** installed (v18 or higher recommended)
2. **MongoDB** running and accessible
3. **Environment variables** configured in `.env` file:
   - `MONGODB_URL_DEVELOPMENT` or `MONGODB_URI` - MongoDB connection string
4. **Dependencies** installed:
   ```bash
   npm install
   ```

---

## Development Commands

### Start Development Server
```bash
npm run dev
```
Starts the development server with hot-reload using nodemon.

### Build Project
```bash
npm run build
```
Compiles TypeScript to JavaScript in the `dist/` directory.

### Start Production Server
```bash
npm start
```
Runs the compiled JavaScript from `dist/index.js`.

### Code Formatting
```bash
# Check formatting
npm run lint

# Auto-fix formatting
npm run format
```

### Run Unit Tests
```bash
npm test
```
Runs Mocha unit tests with JUnit reporter. Test results are saved to `test-results/junit.xml`.

---

## Test Scripts

### Full System Test
```bash
npm run test:full-system
```

**Purpose**: Comprehensive end-to-end system test that validates the entire MLM system.

**What it does**:
1. Flushes the entire database (all collections)
2. Creates admin user with `userId: CROWN-000000`
3. Seeds all investment packages with new fields
4. Creates 100 test users in a combination of individual and subtree structures
5. Activates packages for users to test ROI, binary, and referral bonuses
6. Validates the overall system capacity

**Use Case**: Complete system validation after major changes or before deployment.

**File**: `src/scripts/fullSystemTest.ts`

---

### 12 Users Test
```bash
npm run test:12-users
```

**Purpose**: Creates a smaller test environment with 12 users for quick testing.

**What it does**:
- Creates 12 test users in a binary tree structure
- Sets up binary tree relationships
- Initializes wallets for all users

**Use Case**: Quick testing with a manageable number of users.

**File**: `src/scripts/test12Users.ts`

---

## User Creation Scripts

### Create Test Users (50 Users)
```bash
npm run test:users
```

**Purpose**: Creates 50 test users with a maximum depth of 5 levels in the binary tree.

**What it does**:
- Creates multiple independent branches from admin (CROWN-000000)
- Generates users with sequential `CROWN-XXXXXX` user IDs
- Sets up binary tree structure with proper parent-child relationships
- Initializes wallets for all users

**Use Case**: Testing with a larger user base and complex tree structures.

**File**: `src/scripts/createTestUsers.ts`

---

### Create Test Users with Investments
```bash
npm run test:users:investments
```

**Purpose**: Creates test users and automatically activates investment packages for them.

**What it does**:
- Creates test users (similar to `test:users`)
- Automatically creates investments for users
- Tests the investment activation flow

**Use Case**: Testing investment-related features and bonus calculations.

**File**: `src/scripts/createTestUsersWithInvestments.ts`

---

### Create ABC Users (Simple Structure)
```bash
npm run create:abc-users
```

**Purpose**: Creates a simple 3-user structure: User A with User B (left) and User C (right).

**What it does**:
1. Creates User A (root user)
2. Creates User B as left child of User A
3. Creates User C as right child of User A
4. Sets up binary tree relationships
5. Initializes wallets for all users
6. Verifies and displays the structure

**User IDs Created**:
- `USER-A` - User A (usera@test.com)
- `USER-B` - User B (userb@test.com) [LEFT of A]
- `USER-C` - User C (userc@test.com) [RIGHT of A]

**Use Case**: Quick setup for testing binary bonus calculations with a minimal structure.

**File**: `src/scripts/createABCUsers.ts`

**Note**: Script checks for existing users and prevents duplicates.

---

## Data Seeding Scripts

### Seed Investment Packages
```bash
npm run test:seedPlans
```

**Purpose**: Populates the database with predefined investment packages.

**What it does**:
- Creates multiple investment packages (Solar Starter, Power Growth, Elite Energy, etc.)
- Sets package details including:
  - Min/max investment amounts
  - Duration (days)
  - ROI percentages
  - Binary bonus percentages
  - Capping limits
  - Principle return percentages
  - Referral percentages
  - New fields: `totalOutputPct`, `renewablePrinciplePct`, `referralPct`, `binaryPct`, `powerCapacity`

**Use Case**: Setting up packages for testing or initial database setup.

**File**: `src/scripts/seedPackages.ts`

**Note**: Script handles duplicate packages gracefully.

---

## Binary Bonus Test Scripts

### Binary Bonus Flow Test
```bash
npm run test:binary-bonus
```

**Purpose**: Comprehensive test suite for binary bonus calculation logic.

**What it does**:
- Tests 3 scenarios:
  1. **Initial Investment**: Tests basic binary matching (B: $100 left, C: $500 right)
  2. **Carry Forward Consumption**: Tests carry forward logic when new investments match existing carry
  3. **Large Tree Structure**: Tests with a 5-level deep tree (31 users) and multiple investment phases
- Validates:
  - Binary bonus calculations
  - Carry forward amounts
  - Power capacity limits
  - Business volume accumulation
  - Matched amounts tracking

**Use Case**: Validating binary bonus calculation logic, especially after changes to the calculation algorithm.

**File**: `src/scripts/testBinaryBonusFlow.ts`

**Output**: Detailed test results with pass/fail status for each assertion.

---

### Binary Bonus Scenarios Test
```bash
npm run test:binary-scenarios
```

**Purpose**: Focused test suite for specific binary bonus scenarios with exact expected values.

**What it does**:
- Tests 3 specific scenarios:
  1. **Scenario 1**: Initial Investment
     - B invests $100 (left), C invests $500 (right)
     - Expected: Binary bonus $10, Right carry $400, Left carry $0
  2. **Scenario 2**: Carry Forward Consumption
     - A has $400 left carry, left downline invests $400
     - Expected: Binary bonus $40, Left carry $400, Right carry $0
  3. **Scenario 3**: Large Tree Structure
     - Creates 15 users in a 3-level binary tree
     - Multiple investments processed correctly
     - Root user receives binary bonuses
     - All tree structures validated

**Use Case**: Validating specific binary bonus calculation scenarios with precise expected values.

**File**: `src/scripts/testBinaryBonusScenarios.ts`

**Output**: Test summary with pass/fail status and success rate.

---

## Migration Scripts

### Add Investment Wallets
```bash
npm run migrate:investment-wallets
```

**Purpose**: Migration script to add investment wallets to all existing users.

**What it does**:
- Finds all users in the database
- Checks if each user has an investment wallet
- Creates investment wallet for users who don't have one
- Skips users who already have an investment wallet

**Use Case**: 
- After adding the investment wallet feature
- Migrating existing user data
- Ensuring all users have required wallet types

**File**: `src/scripts/addInvestmentWallets.ts`

**Output**: Summary of created, existing, and error counts.

---

## Utility Scripts

### Recalculate Downlines
```bash
npm run recalculate:downlines
```

**Purpose**: Fixes incorrect downline counts in the binary tree by recalculating them.

**What it does**:
- Recursively counts all users in each subtree (left and right legs)
- Updates `leftDownlines` and `rightDownlines` for all users
- Handles admin users (CROWN-000000) specially (can have unlimited children)

**Use Case**:
- After manual database changes
- When downline counts are incorrect
- After bulk user creation or deletion
- Data integrity maintenance

**File**: `src/scripts/recalculateDownlines.ts`

**Output**: Progress updates and summary of updated counts.

---

## Environment Setup

### Required Environment Variables

Create a `.env` file in the `server/` directory with:

```env
# MongoDB Connection
MONGODB_URL_DEVELOPMENT=mongodb://localhost:27017/binary_system
# OR for MongoDB Atlas
# MONGODB_URL_DEVELOPMENT=mongodb+srv://username:password@cluster.mongodb.net/database

# Server Configuration
PORT=5001
NODE_ENV=development

# JWT Secrets
JWT_SECRET=your_jwt_secret_here
ADMIN_JWT_SECRET=your_admin_jwt_secret_here

# Other environment variables as needed
```

### Database Connection

All scripts automatically:
- Load environment variables from `.env`
- Connect to MongoDB using the connection string
- Handle connection errors gracefully
- Disconnect after completion

---

## Script Execution Patterns

### Direct Execution
All scripts can be run directly using `ts-node`:

```bash
npx ts-node -r dotenv/config src/scripts/scriptName.ts
```

### Using npm Scripts
Prefer using npm scripts for consistency:

```bash
npm run script-name
```

### Script Output
Most scripts provide:
- ✅ Success indicators
- ❌ Error indicators
- 📊 Progress updates
- 📝 Summary information
- 🔄 Status messages

---

## Best Practices

1. **Backup Database**: Before running scripts that modify data, consider backing up your database.

2. **Test Environment**: Run test scripts in a development/test environment, not production.

3. **Check Existing Data**: Some scripts check for existing data and prevent duplicates. Review script behavior before running.

4. **Read Script Comments**: Each script contains detailed comments explaining its purpose and usage.

5. **Monitor Output**: Pay attention to script output for errors or warnings.

6. **Clean Up**: Some test scripts clean up test data automatically. Others may require manual cleanup.

---

## Troubleshooting

### MongoDB Connection Issues
- Ensure MongoDB is running
- Check connection string in `.env`
- Verify network connectivity
- Check MongoDB authentication credentials

### Script Execution Errors
- Verify all dependencies are installed: `npm install`
- Check TypeScript compilation: `npm run build`
- Review script error messages for specific issues
- Ensure required environment variables are set

### Data Integrity Issues
- Use `recalculate:downlines` to fix downline counts
- Check binary tree relationships manually if needed
- Verify wallet balances and transactions

---

## Additional Resources

- **Binary Bonus Logic**: See `BINARY_BONUS_LOGIC.md` for detailed explanation of binary bonus calculations
- **Test Documentation**: See `src/scripts/TEST_BINARY_BONUS_README.md` for binary bonus test details
- **Script README**: See `src/scripts/README.md` for additional script documentation

---

## Quick Reference

| Command | Purpose | Destructive |
|---------|---------|-------------|
| `npm run test:full-system` | Complete system test | ✅ Yes (flushes DB) |
| `npm run test:users` | Create 50 test users | ⚠️ Creates data |
| `npm run create:abc-users` | Create A, B, C users | ⚠️ Creates data |
| `npm run test:seedPlans` | Seed packages | ⚠️ Creates data |
| `npm run test:binary-bonus` | Test binary logic | ⚠️ Creates test data |
| `npm run test:binary-scenarios` | Test specific scenarios | ⚠️ Creates test data |
| `npm run migrate:investment-wallets` | Add wallets | ⚠️ Creates data |
| `npm run recalculate:downlines` | Fix downline counts | ⚠️ Updates data |

**Legend**:
- ✅ Yes: Completely wipes database
- ⚠️ Creates/Updates: Adds or modifies data but doesn't delete everything

---

## Contributing

When adding new scripts:
1. Follow the existing script structure
2. Add proper error handling
3. Include detailed comments
4. Add the script to `package.json`
5. Update this documentation
6. Test the script thoroughly

---

**Last Updated**: 2024
**Maintained By**: Development Team

