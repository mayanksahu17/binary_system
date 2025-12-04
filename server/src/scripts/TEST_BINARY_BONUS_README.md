# Binary Bonus Flow Test Suite

This test suite validates the binary bonus calculation logic, including carry forward handling.

## Prerequisites

1. MongoDB must be running and accessible
2. Set up your `.env` file with `MONGODB_URI`

## Running the Tests

```bash
npm run test:binary-bonus
```

## Test Scenarios

### Scenario 1: Initial Investment
- **Setup**: User A refers User B (left) and User C (right)
- **Actions**: 
  - User B invests $100 (left side)
  - User C invests $500 (right side)
- **Expected Results**:
  - Binary Bonus: $10 (10% of min(100, 500) = 10% of 100)
  - Right Carry Forward: $400 (remaining unmatched amount)
  - Left Carry Forward: $0

### Scenario 2: Carry Forward Consumption
- **Setup**: User A has $400 in left carry forward
- **Actions**:
  - Left downline invests $400
  - Right downline invests $400 (to create a match)
- **Expected Results**:
  - Binary Bonus: $40 (10% of min(800, 400) = 10% of 400)
  - Left Carry Forward: $400 (leftover unmatched business)
  - Right Carry Forward: $0

### Scenario 3: Large Tree Structure
- **Setup**: Creates a 3-level binary tree (7 users total)
- **Actions**: Multiple investments from leaf nodes
- **Expected Results**:
  - Root user receives binary bonuses
  - All tree structures remain valid
  - Binary bonuses calculated correctly across levels

## Test Output

The test suite provides:
- ✅/❌ Pass/Fail indicators for each test
- Detailed test results with actual vs expected values
- Summary statistics (total tests, passed, failed, success rate)
- Automatic cleanup of test data

## What Gets Tested

1. **Binary Bonus Calculation**: Verifies correct percentage calculation
2. **Carry Forward Logic**: Ensures unmatched amounts are properly carried forward
3. **Business Volume Tracking**: Validates cumulative business volume
4. **Tree Structure**: Confirms binary tree relationships are maintained
5. **Wallet Updates**: Checks that binary bonuses are credited correctly

## Notes

- All test data is automatically cleaned up after tests complete
- Tests use `TEST-` prefixed user IDs to avoid conflicts
- The test suite is isolated and doesn't affect production data

