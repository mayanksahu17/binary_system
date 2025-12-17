# Release Notes - Fixes Applied (17-12-2025)

## For Testing Team

This document outlines all fixes and changes applied to the binary system. Please test each fix thoroughly before deployment to production.

---

## 1. Withdrawal Address Auto-Save Fix

### Issue
The withdrawal address was being saved automatically after entering just one character, even before clicking save.

### Fix Applied
1. **Prevented Enter Key Submission**
   - Added `onKeyDown` handler to prevent Enter from triggering save
   - Prevents accidental form submission

2. **Added Button Types**
   - Added `type="button"` to both Cancel and Save buttons
   - Prevents buttons from acting as form submit buttons

3. **Disabled Save Button When Empty**
   - Save button is disabled when walletAddress is empty or just whitespace
   - Visual feedback with disabled styling

4. **Added Validation**
   - Minimum length check (at least 10 characters)
   - Trims whitespace before saving
   - Prevents saving empty or invalid addresses

5. **Reset on Cancel**
   - Clears walletAddress state when Cancel is clicked
   - Prevents stale data from being saved

6. **Disabled Autocomplete**
   - Added `autoComplete="off"` to prevent browser autofill from interfering

### Files Changed
- `/client/app/(dashboard)/withdraw/page.tsx`
- `/client/app/(dashboard)/dashboard/page.tsx`

### Testing Checklist
- [ ] Enter one character in wallet address field - should NOT auto-save
- [ ] Press Enter key - should NOT save the address
- [ ] Click Cancel button - should close modal without saving
- [ ] Click Save with empty field - button should be disabled
- [ ] Enter valid address and click Save - should save correctly
- [ ] Verify address is only saved when Save button is explicitly clicked

---

## 2. Single Crypto Payment Method (USDT TRC20 Only)

### Issue
System was showing multiple cryptocurrency options (Bitcoin, USDC, Ethereum, etc.) but should only accept USDT TRC20.

### Fix Applied
1. **Updated All UI Text**
   - Changed "Crypto Wallet Address" → "USDT TRC20 Wallet Address"
   - Changed "Supported Crypto Addresses" → "Payment Method"
   - Removed all mentions of Bitcoin, USDC, Ethereum, and "other cryptocurrencies"
   - Updated to: "Only USDT TRC20 wallet addresses are accepted"

2. **Updated Placeholder Text**
   - Changed from: "Enter your Bitcoin, USDT, USDC, Ethereum, or other crypto wallet address"
   - To: "Enter your USDT TRC20 wallet address (starts with T)"

3. **Updated Help Text**
   - Changed from: "Make sure to use the correct address format for your chosen cryptocurrency..."
   - To: "USDT TRC20 wallet addresses start with 'T' (e.g., Txxxxxxxxxxxxxxxxxxxxxxxxxxxxx)."

4. **Added Validation**
   - Added validation to ensure addresses start with "T" (USDT TRC20 format)
   - Shows error: "Invalid USDT TRC20 address. USDT TRC20 addresses must start with 'T'."

5. **Updated Error Messages**
   - All error messages now reference "USDT TRC20 wallet address" instead of "crypto wallet address"

### Files Changed
- `/client/app/(dashboard)/withdraw/page.tsx`
- `/client/app/(dashboard)/dashboard/page.tsx`
- `/client/app/(dashboard)/profile/page.tsx`

### Testing Checklist
- [ ] Verify all UI text mentions only "USDT TRC20" (no other cryptocurrencies)
- [ ] Verify placeholder text mentions "starts with T"
- [ ] Enter address starting with "T" - should accept
- [ ] Enter address NOT starting with "T" - should show validation error
- [ ] Verify all help text and error messages reference USDT TRC20 only

---

## 3. Dynamic Minimum Voucher Amount

### Issue
The minimum voucher amount ($12.50) was hardcoded. It should dynamically be half of the minimum investment amount from all active packages.

### Fix Applied
**Backend Changes:**
1. Created new service: `package.service.ts`
   - `getMinimumInvestmentAmount()` - Finds minimum from all active packages
   - `getMinimumVoucherAmount()` - Returns half of minimum investment

2. Updated voucher creation endpoints:
   - `user.controller.ts` - `createVoucher` now uses dynamic minimum
   - `admin.controller.ts` - `createVoucherForUser` now uses dynamic minimum
   - Added new endpoint: `GET /api/v1/user/vouchers/minimum-amount`

**Frontend Changes:**
1. Updated user voucher page (`/client/app/(dashboard)/vouchers/page.tsx`)
   - Fetches minimum voucher amount from backend API
   - Updates placeholder and validation dynamically

2. Updated admin voucher page (`/client/app/admin/vouchers/page.tsx`)
   - Fetches minimum voucher amount from backend API
   - Updates placeholder and validation dynamically

### Files Changed
- `/server/src/services/package.service.ts` (new file)
- `/server/src/controllers/user.controller.ts`
- `/server/src/controllers/admin.controller.ts`
- `/server/src/routes/user.routes.ts`
- `/client/lib/api.ts`
- `/client/app/(dashboard)/vouchers/page.tsx`
- `/client/app/admin/vouchers/page.tsx`

### Testing Checklist
- [ ] Create/update packages with different minimum amounts
- [ ] Verify minimum voucher amount updates based on active packages
- [ ] Test voucher creation with amount below minimum - should reject
- [ ] Test voucher creation with amount at minimum - should accept
- [ ] Verify UI placeholder shows correct minimum amount
- [ ] Test API endpoint: `GET /api/v1/user/vouchers/minimum-amount`
- [ ] Deactivate package with lowest minimum - verify minimum updates

---

## 4. Profile Email Edit Restriction

### Issue
Users were able to edit their email address in the profile section, but emails are used for account identification.

### Fix Applied
1. **Frontend Changes**
   - Made email field read-only (displayed as static text)
   - Added descriptive text: "Email address cannot be changed. Contact admin support if you need to update it."
   - Email is excluded from form submission data

2. **Backend Changes**
   - Added validation in `updateUserProfile` to prevent regular users from updating email
   - Admins can still update emails when needed
   - Returns 403 error if regular user tries to change email

### Files Changed
- `/client/app/(dashboard)/profile/page.tsx`
- `/server/src/controllers/user.controller.ts`

### Testing Checklist
- [ ] Regular user tries to edit email - should see read-only field
- [ ] Regular user tries to submit profile with email change - should be rejected
- [ ] Admin can update user emails - should work
- [ ] Verify error message is clear and helpful
- [ ] Verify other profile fields can still be edited

---

## 5. Binary Bonus and Carry Forward Calculation Fix

### Issue
Two related issues were identified:

**Issue 1: Binary Bonus Incorrect**
- Expected: $500 (10% of $5000 minimum)
- Actual: Showing $100 (incorrect calculation)

**Issue 2: Carry Forward Calculation Wrong**
- Scenario: Left Business = $6000, Right Business = $5000
- Expected: 
  - Left Carry = $1000 (excess: $6000 - $5000)
  - Right Carry = $0 (no excess)
- Actual: 
  - Left Carry = $5000
  - Right Carry = $4000

### Root Cause
The carry forward calculation was using a complex consumption model instead of the simple formula specified in the RULEBOOK. The binary bonus calculation was also being affected by incorrect carry forward values.

### Fix Applied
**File: `/server/src/services/investment.service.ts`**

Changed carry forward calculation to use simple formula from RULEBOOK:

```typescript
// NEW: Simple formula (matches RULEBOOK)
newLeftCarry = Math.max(0, leftAvailable - cappedMatched);
newRightCarry = Math.max(0, rightAvailable - cappedMatched);
```

**Formula:**
- `leftAvailable = leftCarry + (leftBusiness - leftMatched)`
- `rightAvailable = rightCarry + (rightBusiness - rightMatched)`
- `matched = min(leftAvailable, rightAvailable)`
- `cappedMatched = min(matched, powerCapacity)`
- `binaryBonus = cappedMatched * (binaryPct / 100)`
- `newLeftCarry = leftAvailable - cappedMatched`
- `newRightCarry = rightAvailable - cappedMatched`

### Files Changed
- `/server/src/services/investment.service.ts`

### Testing Checklist
**Test Scenario:** User A refers B (left) and C (right)
- B invests $6000
- C invests $5000

**Expected Results:**
- Binary Bonus: $500 (10% of $5000 minimum)
- Left Carry: $1000 (excess: $6000 - $5000)
- Right Carry: $0 (no excess on right side)

**Testing Steps:**
- [ ] Create test users as described above
- [ ] Run binary bonus calculation (via cron or manually)
- [ ] Verify binary bonus wallet shows correct amount ($500)
- [ ] Verify left carry forward shows $1000
- [ ] Verify right carry forward shows $0
- [ ] Check binary reports show correct bonus amount
- [ ] Test with different investment amounts
- [ ] Verify powerCapacity cap works correctly (limits daily earnings)
- [ ] Test with existing users to ensure backward compatibility

**Test Script Available:**
```bash
cd server
npx ts-node -r dotenv/config src/scripts/testBinaryCarryForwardBug.ts
```

### Important Notes
1. **PowerCapacity**: The `powerCapacity` setting in packages limits the maximum matched amount per day. Ensure packages have appropriate values (should be >= expected matched amounts).
2. **Carry Forward**: Now correctly shows only the excess (difference) between left and right available volumes after matching.
3. **Backward Compatibility**: The fix maintains compatibility with existing data structure.
4. **Daily Calculation**: Binary bonuses are calculated once per day via cron job. Ensure cron is running correctly.

---

## 6. Referral Income Report Transparency

### Issue
Referral income reports did not show detailed information about how each referral income was generated.

### Fix Applied
Changes have been made to include detailed information in referral income reports:
- Source user ID who activated the package
- Activated package amount
- Earned referral income amount
- Percentage applied

**Note:** This fix applies to new report entries going forward. Historical data may not have this level of detail.

### Files Changed
- Referral income transaction records (database schema updates)
- Report display components

### Testing Checklist
- [ ] Generate new referral income by activating packages
- [ ] View referral income reports
- [ ] Verify each entry shows:
  - [ ] Source user ID
  - [ ] Package amount
  - [ ] Referral income earned
  - [ ] Percentage applied
- [ ] Verify data is accurate and matches expected calculations

---

## Testing Summary

### Critical Tests to Run

1. **Binary System Tests** ⚠️ **HIGH PRIORITY**
   - Create users with left/right investments
   - Verify binary bonus calculation is correct
   - Verify carry forward shows correct excess amounts
   - Test with different package powerCapacity values
   - Run automated test script to verify calculations

2. **Voucher System Tests**
   - Verify minimum voucher amount updates dynamically
   - Test with multiple active packages
   - Verify validation works correctly
   - Test API endpoint for minimum voucher amount

3. **User Profile Tests**
   - Verify email cannot be edited by regular users
   - Verify other fields can be edited
   - Test admin email update functionality

4. **Payment Method Tests**
   - Verify only USDT TRC20 addresses are accepted
   - Verify validation for addresses starting with "T"
   - Test wallet address save functionality
   - Verify no auto-save occurs

5. **Report Tests**
   - Verify referral income reports show detailed information
   - Verify binary bonus reports show correct amounts
   - Verify carry forward values in reports match calculations

---

## Build Status

✅ All changes have been built and compiled successfully. TypeScript compilation completed without errors.

---

## Deployment Notes

1. **Database**: No migrations required for core functionality. Referral income report enhancements may require schema updates for new entries.

2. **Package Configuration**: Ensure all package `powerCapacity` values are set appropriately based on business requirements. Low powerCapacity values will cap daily binary earnings.

3. **Cron Jobs**: Verify cron jobs are running correctly for daily binary bonus calculations.

4. **Testing**: Test binary bonus calculation with existing data before full deployment to ensure backward compatibility.

5. **Monitoring**: Monitor binary bonus calculations after deployment to ensure correct amounts are being credited.

---

## Rollback Plan

If issues are found during testing:

1. **Binary Bonus Fix**: Revert changes in `investment.service.ts` (keep backup of previous version)
2. **Other Fixes**: Individual fixes can be reverted independently as they don't affect core business logic

---

## Contact

For questions or issues during testing, please contact the development team.

**Date:** December 17, 2025  
**Version:** Fix Release 17-12-25  
**Testing Priority:** Binary Bonus Fix - HIGH PRIORITY
