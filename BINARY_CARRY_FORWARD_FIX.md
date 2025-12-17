# Binary Bonus and Carry Forward Bug Fix

## Issues Identified

### Issue 1: Binary Bonus Incorrect
- **Expected**: $500 (10% of $5000 minimum)
- **Actual**: $100 (10% of $1000 due to powerCapacity cap)

### Issue 2: Carry Forward Calculation Wrong
- **Scenario**: Left Business = $6000, Right Business = $5000
- **Expected**: 
  - Left Carry = $1000 (excess: $6000 - $5000)
  - Right Carry = $0 (no excess)
- **Actual**: 
  - Left Carry = $5000
  - Right Carry = $4000

## Root Cause

1. **Carry Forward Calculation**: The code was using a complex consumption model that calculated carry forward incorrectly. The RULEBOOK specifies a simple formula that wasn't being used.

2. **PowerCapacity Cap**: The binary bonus was being limited by the package's `powerCapacity` setting (default $1000), which capped the matched amount.

## Fix Applied

### File: `server/src/services/investment.service.ts`

**Changed carry forward calculation to use simple formula from RULEBOOK:**

```typescript
// OLD: Complex consumption model with multiple conditional branches
// NEW: Simple formula
newLeftCarry = Math.max(0, leftAvailable - cappedMatched);
newRightCarry = Math.max(0, rightAvailable - cappedMatched);
```

**Formula:**
- `leftAvailable = leftCarry + (leftBusiness - leftMatched)`
- `rightAvailable = rightCarry + (rightBusiness - rightMatched)`
- `matched = min(leftAvailable, rightAvailable)`
- `cappedMatched = min(matched, powerCapacity)`
- `newLeftCarry = leftAvailable - cappedMatched`
- `newRightCarry = rightAvailable - cappedMatched`

## Test Results

After fix:
- ✅ Binary Bonus: $500 (correct)
- ✅ Left Carry: $1000 (correct)
- ✅ Right Carry: $0 (correct)

## Important Notes

1. **PowerCapacity Impact**: The `powerCapacity` setting in packages limits the maximum matched amount per day. If powerCapacity < matched amount, the binary bonus will be capped.

2. **Carry Forward**: Carry forward now correctly shows only the excess (difference) between left and right available volumes after matching.

3. **Package Configuration**: Ensure packages have appropriate `powerCapacity` values to allow desired matching amounts.

## Testing

Test script: `server/src/scripts/testBinaryCarryForwardBug.ts`

Run test:
```bash
cd server
npx ts-node -r dotenv/config src/scripts/testBinaryCarryForwardBug.ts
```

Test creates users under CROWN-000020 and verifies:
- Binary bonus calculation
- Carry forward calculation
- Left/right business volumes
