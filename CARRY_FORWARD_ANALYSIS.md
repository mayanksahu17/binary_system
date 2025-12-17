# Carry Forward Calculation Analysis

## User's Issue
- **Left Business**: $5000
- **Right Business**: $6000
- **Expected**: Right Carry Forward = $1000, Left Carry Forward = $0
- **Actual (from screenshot)**: Left Carry = $10000, Right Carry = $13000

## Expected Calculation (Simple Case)

For the first calculation with no prior carry:
1. `leftAvailable = leftCarry + (leftBusiness - leftMatched) = 0 + (5000 - 0) = 5000`
2. `rightAvailable = rightCarry + (rightBusiness - rightMatched) = 0 + (6000 - 0) = 6000`
3. `matched = min(5000, 6000) = 5000`
4. `cappedMatched = min(5000, powerCapacity) = 5000` (assuming powerCapacity >= 5000)
5. Consumption:
   - `leftConsumedFromBusiness = 5000` (since leftCarry = 0)
   - `rightConsumedFromBusiness = 5000` (since rightCarry = 0)
6. Remaining:
   - `leftRemainingUnmatchedBusiness = 5000 - 5000 = 0`
   - `rightRemainingUnmatchedBusiness = 6000 - 5000 = 1000`
7. New Carry Forward:
   - `newLeftCarry = 0` (no carry initially, leftover is 0)
   - `newRightCarry = 1000` (no carry initially, leftover is 1000)

## Current Code Logic

The code uses a complex consumption model:
1. Consumes from carry first, then from unmatched business
2. Calculates remaining carry and remaining unmatched business separately
3. Uses conditional logic to determine new carry based on whether carry was consumed

**Key Code Sections:**
- Lines 299-323 in `investment.service.ts` handle carry forward calculation
- The logic checks if carry was initially 0, if carry remains, or if carry was fully consumed

## Possible Issues

1. **Cumulative Values**: The $10000/$13000 might be cumulative carry forward from multiple calculations
2. **Consumption Logic**: The complex consumption model might be adding carry incorrectly
3. **No Matching Scenario**: If `cappedMatched = 0` (no matching), carry forward is preserved as-is (lines 324-329)

## Test Results

- `test:carry-forward`: 11/15 passed (73.33%)
- Some failures in initial carry forward setup tests

## Next Steps

1. Verify the actual calculation for $5000/$6000 scenario
2. Check if carry forward is being accumulated incorrectly
3. Review the consumption model logic
4. Test with actual user data from database
