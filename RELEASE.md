# CNEOX Platform Release Notes
## Release Date: December 15, 2025

---

## Overview
This release includes significant improvements to wallet management, user experience enhancements, bug fixes, and new features across both user and admin panels. The update focuses on improving transparency, security, and usability of the platform.

---

## 🎯 Key Features & Improvements

### 1. Career Level Wallet System
**Status:** ✅ Implemented

- **New Wallet Type:** Introduced dedicated `CAREER_LEVEL` wallet for career level rewards
- **Reward Logic:** Career level rewards are now credited to the Career Level Wallet instead of ROI wallet
- **Activation Rule:** Career level rewards only trigger when **both** left and right business volumes meet the threshold
- **Display:** Career Levels section now shows targets for both left and right business volumes separately with visual graphics
- **Target Display:** Overall target now correctly shows the sum of left and right targets (e.g., $2,000 = $1,000 left + $1,000 right)

**Testing Checklist:**
- [ ] Verify career level rewards are credited to Career Level Wallet
- [ ] Confirm rewards only trigger when both sides meet threshold
- [ ] Check that target display shows correct total (left + right)
- [ ] Validate visual progress bars for left and right business

---

### 2. Wallet Exchange Improvements
**Status:** ✅ Implemented

**Changes:**
- **Restricted Exchange Sources:** Users can ONLY exchange from:
  - Referral Wallet
  - Binary Wallet
  - Career Level Wallet (once per day)
  - ROI Wallet (once per day)
- **Restricted Exchange Destination:** Users can ONLY exchange TO:
  - Withdrawal Wallet
- **Removed Features:**
  - Exchange from Investment Wallet (removed)
  - Exchange rate input bar (hidden)
  - Exchange to other wallets (removed)
- **Fixed Exchange Rate:** All exchanges are now at 1:1 rate
- **Daily Limits:** Career Level and ROI wallet exchanges are limited to once per day

**Testing Checklist:**
- [ ] Verify only allowed wallets appear in "From Wallet" dropdown
- [ ] Confirm only Withdrawal Wallet appears in "To Wallet" dropdown
- [ ] Test that exchange rate is fixed at 1:1 and input is hidden
- [ ] Validate daily limit enforcement for Career Level and ROI wallets
- [ ] Attempt to exchange from Investment Wallet (should fail/not appear)
- [ ] Test exchange from Referral and Binary wallets (should work)

---

### 3. Withdrawal Enhancements
**Status:** ✅ Implemented

**New Features:**
- Users can now withdraw funds directly from:
  - Referral Wallet
  - Binary Wallet
  - ROI Wallet
  - Interest Wallet
  - Career Level Wallet
  - Withdrawal Wallet

**Removed:**
- "Referral & Binary" combined wallet (removed from system)

**Testing Checklist:**
- [ ] Verify all listed wallets appear in withdrawal dropdown
- [ ] Confirm "Referral & Binary" wallet is not present
- [ ] Test withdrawal from each wallet type
- [ ] Validate balance checks before withdrawal

---

### 4. User Account Creation Fixes
**Status:** ✅ Fixed

**Issues Resolved:**
- **Issue #1:** Fixed inability to create multiple accounts with the same email/mobile number
- **Issue #2:** Fixed infinite loading spinner on "Create Account" button
- **Root Cause:** Backend uniqueness validation was causing 409 errors without proper frontend handling

**Testing Checklist:**
- [ ] Create account with valid referrer ID
- [ ] Verify button doesn't get stuck in loading state
- [ ] Test with invalid referrer ID (should show error)
- [ ] Test account creation with existing email/phone (should work or show clear error)

---

### 5. Direct Referrals Page
**Status:** ✅ Implemented

**New Feature:**
- Dedicated page to view direct referrals list
- Features:
  - Search functionality (by User ID, Name, Email, Phone)
  - Pagination support
  - Filter by status (Active/Inactive)
  - Filter by position (Left/Right)
  - Displays: User ID, Name, Email, Phone, Status, Position, Registration Date

**Location:** User Dashboard → Referrals tab

**Testing Checklist:**
- [ ] Navigate to Referrals page from dashboard
- [ ] Test search functionality with various queries
- [ ] Verify pagination works correctly
- [ ] Test status filter (Active/Inactive)
- [ ] Test position filter (Left/Right)
- [ ] Verify all referral information displays correctly

---

### 6. Binary Tree (Genealogy) Improvements
**Status:** ✅ Implemented

**User Panel (My Genealogy):**
- Added search bar to find specific users by ID, Name, or Email
- Search highlights found nodes and navigates to them
- Improved node layout to prevent user ID from being hidden
- Popup information now appears on the right side of nodes (not above)
- Increased z-index for popups to prevent overlap with other nodes

**Admin Panel (Binary Tree):**
- Added search functionality
- Reduced navbar/header height for better space utilization
- Improved node visibility and layout

**Testing Checklist:**
- [ ] Test search functionality in user panel genealogy
- [ ] Test search functionality in admin panel tree
- [ ] Verify user ID is always visible and readable
- [ ] Check that popup appears on right side and doesn't get covered
- [ ] Test zoom in/out functionality
- [ ] Verify node highlighting works when searching

---

### 7. Wallet Address Security
**Status:** ✅ Implemented

**Security Enhancement:**
- Users cannot change their crypto wallet address once it's set
- Only admin team can update wallet addresses
- Applies to both Dashboard and Profile sections
- Clear messaging displayed when address is locked

**UI Improvements:**
- Added information about supported crypto types (Bitcoin, USDT, USDC, Ethereum)
- Clear placeholders and help text
- Read-only fields when address exists

**Testing Checklist:**
- [ ] Set wallet address for first time (should work)
- [ ] Attempt to change existing wallet address (should be blocked)
- [ ] Verify admin can change user wallet addresses
- [ ] Check that crypto type information is displayed
- [ ] Test in both Dashboard and Profile sections

---

### 8. Voucher Creation Improvements
**Status:** ✅ Implemented

**Changes:**
- Removed "Create without wallet (Free voucher)" option
- Wallet selection is now required
- Fixed duplicate wallet types in dropdown
- Only shows appropriate wallet types: ROI, Interest, Referral, Binary, Withdrawal, Career Level
- Added balance validation before voucher creation

**Testing Checklist:**
- [ ] Verify "Free voucher" option is removed
- [ ] Test that wallet selection is required
- [ ] Check for duplicate wallet types (should not appear)
- [ ] Verify only allowed wallets are shown
- [ ] Test voucher creation with sufficient balance
- [ ] Test voucher creation with insufficient balance (should show error)

---

### 9. Investment Details Enhancement
**Status:** ✅ Implemented

**New Feature:**
- Investment details now show voucher information if package was activated using a voucher
- Displays:
  - Voucher ID
  - Voucher Amount

**Location:** Investments page → View Details

**Testing Checklist:**
- [ ] Activate package using a voucher
- [ ] View investment details
- [ ] Verify voucher information is displayed
- [ ] Test with investment not using voucher (should not show voucher section)

---

### 10. Referral Income Transparency
**Status:** ✅ Implemented

**New Feature:**
- Referral Bonus Transactions now show detailed source information
- Displays:
  - Source user name and ID (e.g., "CROWN-1000015")
  - Package amount activated (e.g., "activated $5000 package")
  - Referral income amount and percentage (e.g., "You got $500 referral income (10%)")

**Location:** Reports → Referral tab

**Testing Checklist:**
- [ ] Navigate to Reports → Referral tab
- [ ] Verify "Source" column is displayed
- [ ] Check that source information shows correctly
- [ ] Verify package amount and referral percentage are accurate
- [ ] Test with multiple referral transactions

---

### 11. Career Levels Target Display Fix
**Status:** ✅ Fixed

**Issue:**
- Overall target was showing per-side amount instead of total (left + right)

**Fix:**
- Overall target now correctly displays sum of left and right targets
- Example: If each side requires $1,000, total target shows $2,000

**Testing Checklist:**
- [ ] Navigate to Career Levels page
- [ ] Verify overall target = left target + right target
- [ ] Check progress calculation uses total target
- [ ] Verify visual progress bar reflects correct percentage

---

### 12. Error Message Improvements
**Status:** ✅ Implemented

**Enhancement:**
- All error messages now display as pop-up toast notifications
- Improved user experience with better visibility of errors
- Applied across:
  - Wallet Exchange
  - Withdrawal
  - Voucher Creation
  - Investment operations
  - Dashboard operations

**Testing Checklist:**
- [ ] Trigger various error scenarios
- [ ] Verify toast notifications appear
- [ ] Check error messages are clear and actionable
- [ ] Test on different pages

---

### 13. Profile vs Dashboard Payment Info Consistency
**Status:** ✅ Fixed

**Issue:**
- Payment info could be updated from Dashboard but not from Profile section

**Fix:**
- Unified behavior across both sections
- Wallet address restrictions apply consistently

**Testing Checklist:**
- [ ] Update payment info from Dashboard (should work)
- [ ] Update payment info from Profile (should work or show consistent error)
- [ ] Verify wallet address restrictions apply in both places

---

## 🔧 Technical Changes

### Backend Changes
1. **Wallet Type Updates:**
   - Removed `REFERRAL_BINARY` wallet type
   - Added `CAREER_LEVEL` wallet type
   - Updated all wallet-related enums and models

2. **API Enhancements:**
   - Enhanced `getUserReports` to include referral source information
   - Updated `getUserDirectReferrals` with pagination and filtering
   - Modified `getUserInvestments` to include voucher details
   - Enhanced `getUserBinaryTree` to show referrer as parent

3. **Transaction Service:**
   - Updated `createReferralTransaction` to store source user information
   - Modified `processReferralBonus` to track referral source

4. **Security:**
   - Added wallet address change restrictions
   - Admin-only wallet address updates

### Frontend Changes
1. **React Version:**
   - Migrated from React 19 to React 18 for compatibility

2. **New Pages:**
   - Direct Referrals page (`/referrals`)
   - Enhanced Reports page with referral source details

3. **UI Improvements:**
   - Toast notifications for all errors
   - Improved binary tree visualization
   - Enhanced Career Levels display
   - Better wallet address management UI

---

## 🐛 Bug Fixes

1. ✅ Fixed infinite loading on account creation
2. ✅ Fixed parent/referrer mismatch in binary tree
3. ✅ Fixed career level rewards going to wrong wallet
4. ✅ Fixed career level target display (showing total instead of per-side)
5. ✅ Fixed profile payment info update error
6. ✅ Fixed duplicate wallet types in voucher creation
7. ✅ Fixed popup overlap in genealogy tree
8. ✅ Fixed user ID visibility in genealogy nodes

---

## 📋 Testing Priorities

### High Priority
1. **Wallet Exchange:** Verify all restrictions and daily limits
2. **Career Level System:** Test reward distribution and target display
3. **Wallet Address Security:** Test change restrictions
4. **Referral Income:** Verify source information display

### Medium Priority
1. **Direct Referrals Page:** Test search, filters, and pagination
2. **Binary Tree Search:** Test search functionality in both panels
3. **Voucher Creation:** Verify required fields and validations

### Low Priority
1. **UI Improvements:** Visual verification of all enhancements
2. **Error Messages:** Verify toast notifications work correctly

---

## 🔒 Security Notes

1. **Wallet Address Protection:**
   - Users cannot change wallet addresses after initial setup
   - Only admins can modify wallet addresses
   - This prevents potential fraud and ensures payment security

2. **Wallet Exchange Restrictions:**
   - Stricter controls on which wallets can be exchanged
   - Prevents unauthorized fund movements

---

## 📝 Migration Notes

1. **Existing Users:**
   - Existing "Referral & Binary" wallet balances should be migrated
   - Career level rewards previously in ROI wallet may need review
   - Wallet addresses are now locked (admin can update if needed)

2. **Database:**
   - No major schema changes required
   - Wallet type enum updated
   - Transaction meta fields enhanced

---

## 🚀 Deployment Checklist

- [ ] Backup database before deployment
- [ ] Verify all environment variables are set
- [ ] Test wallet type migrations
- [ ] Verify API endpoints are accessible
- [ ] Check frontend build completes successfully
- [ ] Test critical user flows
- [ ] Monitor error logs after deployment

---

## 📞 Support & Contact

For issues or questions during testing:
- **Backend API:** `http://localhost:8000/api/v1`
- **Frontend:** `http://localhost:3000`
- **Documentation:** See codebase README files

---

## 📅 Release Information

- **Release Version:** 1.0.0
- **Release Date:** December 15, 2025
- **Build Date:** December 16, 2025
- **Target Environment:** Production

---

## ✅ Sign-off

**QA Team Sign-off:**
- [ ] All high-priority tests passed
- [ ] All medium-priority tests passed
- [ ] No critical bugs found
- [ ] Ready for production deployment

**Developer Sign-off:**
- [ ] All features implemented
- [ ] Code reviewed
- [ ] Documentation updated

---

*End of Release Notes*
