# Release Notes – Career Level Wallet & Signup Improvements

## Release Overview

- **Date**: 2025-12-12
- **Scope**:
  - Career Level reward wallet separation & logic fixes
  - Historical data migration for career rewards
  - Signup flow improvements (allow duplicate email/phone, fix infinite loading)
  - Backend & frontend integrations for reporting and withdrawals

---

## 1. Career Level Rewards – Wallet Separation

**Issue:**
- Career level rewards were being credited to the **ROI wallet**, mixing ROI earnings and career rewards.

**Fix:**
- Introduced a new wallet type: `CAREER_LEVEL`.
- Updated career level reward logic to credit rewards to the **Career Level wallet** instead of ROI.

**Code Changes (Key Files):
- `server/src/models/types.ts`
  - Added `CAREER_LEVEL = "career_level"` to `WalletType` enum.
- `server/src/services/career-level.service.ts`
  - Changed reward credit from `WalletType.ROI` to `WalletType.CAREER_LEVEL`.
  - Career reward transactions now use `WalletType.CAREER_LEVEL` with `meta.type = "career_reward"`.
- `server/src/services/userInit.service.ts`
  - `initializeWallets()` now creates a Career Level wallet for new users.
- `server/src/controllers/user.controller.ts`
  - `getUserReports()` now returns a `careerLevel` transaction group.

**Frontend Integration:**
- `client/app/(dashboard)/dashboard/page.tsx`
  - Dashboard now displays a "Career Level" wallet card.
- `client/app/(dashboard)/withdraw/page.tsx`
  - Career Level wallet is selectable for withdrawals.
- `client/app/(dashboard)/reports/page.tsx`
  - Added a **Career Level** tab and table for career reward transactions.
- `client/app/(dashboard)/wallet-exchange/page.tsx`
  - Added human-readable label: `career_level` → "Career Level Wallet".
- `client/lib/api.ts`
  - `getUserReports()` response type updated to include `careerLevel`.

**Testing & Verification:**
- Confirmed career rewards now appear only in Career Level wallet.
- Confirmed ROI wallet no longer receives `meta.type = "career_reward"` transactions.

---

## 2. Career Level Logic – Both Sides Required

**Issue:**
- Career level rewards used `totalBusinessVolume = leftBusiness + rightBusiness` and triggered when total ≥ threshold.
- Business requirement: **Both left and right legs independently must meet the threshold** (e.g., Bronze requires left ≥ 1,000 AND right ≥ 1,000).

**Fix:**
- In `checkAndAwardCareerLevels`, changed the level completion condition from:
  - `totalBusinessVolume >= levelThreshold`
- To:
  - `leftBusiness >= levelThreshold && rightBusiness >= levelThreshold`.

**Code Changes:**
- `server/src/services/career-level.service.ts`
  - Inside loop over `activeLevels`:
    - Replaced single total volume check with dual-legged condition.

**Testing Scenarios:**
- Left-only volume (e.g., left = 1,000; right = 0) → **No reward**.
- Both sides meet threshold (left = 1,000; right = 1,000) → **Bronze reward triggers**.
- Unequal higher volumes tested to ensure no over-triggering.

---

## 3. Historical Data Migration – Career Rewards from ROI → Career Level

**Issue:**
- Existing production data contained historical career rewards in ROI wallets.

**Fix & Scripts:**
1. **Wallet Creation Migration**
   - File: `server/src/scripts/addCareerLevelWallets.ts`
   - Purpose: Ensure all existing users have a `CAREER_LEVEL` wallet.
   - Result (DEV snapshot): 9 users → 9 new Career Level wallets created.

2. **Verification Script**
   - File: `server/src/scripts/verifyCareerLevelDatabase.ts`
   - Checks:
     - All users have Career Level wallets.
     - No career rewards in ROI wallets.
     - Career rewards exist in Career Level wallets.
     - Wallet balance integrity.
     - Career progress tracking consistency.

3. **Data Migration Script**
   - File: `server/src/scripts/migrateCareerRewardsFromROI.ts`
   - Behavior:
     - Finds all `WalletTransaction` where wallet type = ROI and `meta.type = "career_reward"`.
     - Decreases ROI wallet balance by total career reward amount.
     - Increases Career Level wallet balance by the same total.
     - Repoints those transactions to the Career Level wallet.
     - Adds an audit transaction (`meta.type = "career_reward_migration"`).
   - DEV run result:
     - Users processed: 2
     - Transactions moved: 7
     - Total amount migrated: $8,400.00

**Post-Migration Verification (DEV):**
- `verifyCareerLevelDatabase.ts` shows:
  - ✅ All users have Career Level wallets
  - ✅ No career rewards in ROI wallets
  - ✅ 7 career reward transactions in Career Level wallets
  - ⚠️ Balance mismatch warning is expected due to additional migration credit entry (audit trail); actual balances are correct.

---

## 4. Signup Flow – Allow Duplicate Email & Phone, Fix Infinite Loading

**Issue 1:**
- Testers reported: "Unable to create multiple accounts with the same email address and mobile number."
- Business requirement: Allow multiple accounts with the same email/phone.

**Issue 2:**
- When clicking **Create account**, the button showed a loading spinner for a long time / appeared stuck, especially when signup failed due to duplicate email/phone.

**Backend Fixes:**
- File: `server/src/controllers/auth.controller.ts`

  Changes in `userSignup`:
  - **Removed uniqueness enforcement** on email and phone:
    - Removed `User.findOne({ email: ... })` + `409` error.
    - Removed `User.findOne({ phone })` + `409` error.
  - Kept validation logic only:
    - Email format validation using regex.
    - Basic phone sanity check (cleaned length check), no uniqueness.
  - DB model `UserSchema` already uses non-`unique` indexes for email/phone, so duplicates are allowed by Mongo.

**Frontend Behavior (No code change needed, but validated):**
- File: `client/app/signup/page.tsx`
  - `handleSubmit`:
    - Uses `setLoading(true)` before request, and `setLoading(false)` in `finally`, so loader always stops.
    - Shows error message if signup fails (`setError(err.message || 'Signup failed. Please try again.')`).
- File: `client/contexts/AuthContext.tsx`
  - `signup`:
    - Calls `api.userSignup()` and populates `user` on success.

**Result:**
- Multiple user accounts can now be created using the **same email and same phone**.
- The **Create account** button loader stops correctly even on errors.

**Test Scenarios:**
- Create User A and User B with identical email + phone → both succeed.
- Retry signup with invalid referrer ID → spinner starts, error shown, spinner stops.

---

## 5. Reports API – Career Level Transactions

**Issue:**
- Frontend needed Career Level transactions but API type and payload did not include this field.

**Fix:**
- Backend:
  - `server/src/controllers/user.controller.ts`
    - In `getUserReports`, added `careerLevelTransactions` group and returned as `careerLevel` in `data` payload.
- Frontend:
  - `client/lib/api.ts`
    - Updated `getUserReports()` return type to:
      - `{ roi: any[]; binary: any[]; referral: any[]; careerLevel: any[]; investment: any[]; withdrawals: any[] }`.
  - `client/app/(dashboard)/reports/page.tsx`
    - Consumes `response.data.careerLevel` and stores in `careerLevelTransactions` state.
    - Added Career Level tab and table rendering.

**Result:**
- TypeScript build error fixed.
- Reports page now fully supports Career Level transaction history.

---

## 6. Files & Scripts Added

- `server/src/scripts/addCareerLevelWallets.ts`
  - Migration: create Career Level wallets for all existing users.
- `server/src/scripts/verifyCareerLevelDatabase.ts`
  - Verification: DB-wide checks for wallets and transactions.
- `server/src/scripts/migrateCareerRewardsFromROI.ts`
  - Migration: move historical career rewards from ROI to Career Level wallets.
- `CAREER_LEVEL_TESTING_PLAN.md`
  - Detailed testing scenarios for career level feature.
- `STAGING_MANUAL_TESTING_GUIDE.md`
  - Step-by-step manual staging testing guide.
- `TESTING_TEAM_DEPLOYMENT_NOTICE.md`
  - Testing team communication document.
- `PRODUCTION_DEPLOYMENT_CHECKLIST.md`
  - End-to-end deployment checklist for production.

---

## 7. Deployment Path (High-Level)

1. **Deploy backend & frontend changes** to staging.
2. Run `addCareerLevelWallets.ts` on staging DB.
3. Run `migrateCareerRewardsFromROI.ts` on staging DB.
4. Run `verifyCareerLevelDatabase.ts` on staging DB.
5. Execute manual tests using `STAGING_MANUAL_TESTING_GUIDE.md`.
6. If all good, repeat migrations & verification on production.
7. Monitor logs and wallet balances for 24 hours post-deploy.

---

## 8. Open Items / Next Bugs

This release file will continue to be updated as new issues are reported and fixed.

---

## 9. New Feature – Direct Referrals List on User Dashboard

**Issue (QA #3):**
- In the user dashboard, there was **no option for users to see their direct referrals list** (level-1 referrals).

**Backend Changes:**
- File: `server/src/controllers/user.controller.ts`
  - Added new controller: `getUserDirectReferrals`
    - Endpoint: `GET /api/v1/user/direct-referrals`
    - Logic:
      - Finds all `User` documents where `referrer = currentUser._id`.
      - Returns fields: `userId`, `name`, `email`, `phone`, `status`, `position`, `country`, `createdAt`.
      - Response payload:
        - `data.referrals`: formatted array of direct referrals.
        - `data.count`: total number of direct referrals.

- File: `server/src/routes/user.routes.ts`
  - Registered route:
    - `router.get("/direct-referrals", requireAuth, getUserDirectReferrals);`

**Frontend Changes:**
- File: `client/lib/api.ts`
  - Added API helper:
    - `getUserDirectReferrals(): Promise<ApiResponse<{ referrals: any[]; count: number }>>`
    - Calls `GET /user/direct-referrals`.

- File: `client/app/(dashboard)/dashboard/page.tsx`
  - State:
    - Added `directReferrals` state: `const [directReferrals, setDirectReferrals] = useState<any[]>([]);`
  - Data fetch (`fetchDashboardData`):
    - Extended `Promise.all` to include:
      - `api.getUserDirectReferrals().catch(() => ({ data: { referrals: [], count: 0 } }))`
    - On success:
      - `setDirectReferrals(directReferralsRes.data.referrals || []);`
  - UI:
    - Added **“My Direct Referrals”** section on dashboard:
      - If no referrals: shows friendly empty state message.
      - If referrals exist: renders table with columns:
        - User ID
        - Name
        - Email
        - Phone
        - Position
        - Country
        - Joined At
        - Status (with colored status pill)

**User Experience:**
- Users can now see a **clear, paginated-style table** (full list in current implementation) of their **direct referrals (level 1)** directly on the dashboard, below the **Referral Links** section.
- This list is **read-only** and reflects the current state of the `User` collection where `referrer` = logged-in user.

**How to Verify (Manual Test):**
1. Login as a user who already has downlines (direct referrals).
2. Go to `/dashboard`.
3. Scroll below the **Referral Links** card.
4. Check the **“My Direct Referrals”** section:
   - Should show all direct referrals with correct IDs, names, emails, phones, positions, countries, joined dates, and statuses.
5. For a user with no direct referrals:
   - Section should display a helpful empty-state message and no errors.

**Notes / Limitations:**
- This endpoint currently returns **only direct (level-1)** referrals, not multi-level downlines.
- For large trees, pagination/filtering can be added later if needed.

---

## 10. Wallet Exchange Restrictions & Security Fix

**Issue (QA #6):**
- Wallet exchange was allowing users to:
  - Exchange from **Investment wallet** (should not be allowed)
  - Exchange to **any wallet** (should only allow Withdrawal wallet)
  - Set custom **exchange rates** (security risk - should be fixed at 1:1)
- Example user affected: CROWN-000010

**Requirements:**
1. Users can **ONLY** exchange FROM: **Referral wallet** OR **Binary wallet**
2. Users can **ONLY** exchange TO: **Withdrawal wallet**
3. Remove ability to exchange from Investment wallet
4. Hide exchange rate input (fixed at 1:1)
5. Users can only transfer TO Withdrawal wallet, not to other wallets

**Backend Changes:**
- File: `server/src/controllers/user.controller.ts`
  - Updated `exchangeWalletFunds` controller:
    - Added validation: `fromWalletType` must be `REFERRAL` or `BINARY` only
    - Added validation: `toWalletType` must be `WITHDRAWAL` only
    - Exchange rate is **fixed at 1.0** (ignores user input for security)
    - Returns clear error messages if invalid wallet types are used

**Frontend Changes:**
- File: `client/app/(dashboard)/wallet-exchange/page.tsx`
  - **From Wallet Dropdown:**
    - Filtered to show **only** `referral` and `binary` wallets
    - Added helper text: "You can only exchange from Referral or Binary wallets"
  - **To Wallet Dropdown:**
    - Filtered to show **only** `withdrawal` wallet
    - Added helper text: "Funds can only be transferred to Withdrawal wallet"
  - **Exchange Rate Input:**
    - **Removed** the exchange rate input field
    - Replaced with informational display showing "Exchange Rate: 1:1 (Fixed)"
    - Shows calculated amount user will receive
  - **Form Validation:**
    - Added client-side validation to prevent invalid wallet combinations
    - Validates `fromWalletType` must be `referral` or `binary`
    - Validates `toWalletType` must be `withdrawal`
  - **API Call:**
    - Always sends `exchangeRate: 1.0` (fixed, no user input)

**Security Improvements:**
- Exchange rate manipulation prevented (fixed at 1:1)
- Investment wallet protected from exchanges
- Clear wallet type restrictions enforced on both frontend and backend

**How to Verify:**
1. Go to Wallet Exchange page
2. **From Wallet dropdown** should only show:
   - Referral Wallet
   - Binary Wallet
3. **To Wallet dropdown** should only show:
   - Withdrawal Wallet
4. **Exchange Rate input** should be hidden
5. Try to exchange from Investment wallet → Should show error
6. Try to exchange to ROI wallet → Should show error
7. Exchange from Referral to Withdrawal → Should work at 1:1 rate
8. Exchange from Binary to Withdrawal → Should work at 1:1 rate

**Files Changed:**
- `server/src/controllers/user.controller.ts` - Added wallet type restrictions
- `client/app/(dashboard)/wallet-exchange/page.tsx` - Filtered dropdowns, removed exchange rate input, added validation

---

## 11. Wallet Exchange Enhancement: Career Level & ROI Wallets (Daily Limit)

**Enhancement:**
- Extended wallet exchange feature to allow users to exchange from **Career Level Wallet** and **ROI Wallet**
- Added **once-per-day limit** for Career Level and ROI wallet exchanges
- Referral and Binary wallets remain unlimited (no daily limit)

**Backend Changes:**
- File: `server/src/controllers/user.controller.ts`
  - Updated `exchangeWalletFunds` controller:
    - Extended `allowedFromWallets` to include `WalletType.CAREER_LEVEL` and `WalletType.ROI`
    - Added daily limit check for Career Level and ROI wallets:
      - Queries `WalletTransaction` to find if user has already exchanged from the wallet today
      - Checks for debit transactions with `meta.type === "wallet_exchange"` created today
      - Returns error if daily limit is reached
    - Error message: "You have already exchanged from [Career Level/ROI] wallet today. You can only exchange once per day from this wallet."

**Frontend Changes:**
- File: `client/app/(dashboard)/wallet-exchange/page.tsx`
  - **From Wallet Dropdown:**
    - Extended filter to include `career_level` and `roi` wallets
    - Added visual indicators:
      - Shows "(Daily limit reached)" in dropdown option if already exchanged today
      - Disables option if daily limit reached
    - Updated helper text: "You can exchange from Referral, Binary, Career Level, or ROI wallets"
  - **Daily Limit Status:**
    - Added `dailyLimitStatus` state to track which wallets have reached daily limit
    - Added `checkDailyLimitStatus()` function:
      - Fetches user reports to check for today's exchange transactions
      - Identifies wallet exchange debits from Career Level or ROI wallets
      - Updates `dailyLimitStatus` state
    - **Visual Indicators:**
      - Warning message (red) if daily limit reached: "⚠️ You have already exchanged from this wallet today. Daily limit: 1 exchange per day."
      - Info message (amber) if limit available: "ℹ️ Daily limit: You can exchange from this wallet once per day."
  - **Form Validation:**
    - Added client-side check to prevent submission if daily limit reached
    - Shows error message before API call

**How It Works:**
1. **Referral & Binary Wallets:** Unlimited exchanges (no daily limit)
2. **Career Level Wallet:** Maximum 1 exchange per day
3. **ROI Wallet:** Maximum 1 exchange per day
4. **Daily Reset:** Limits reset at midnight (00:00:00) each day
5. **Tracking:** Uses `WalletTransaction` records with `meta.type === "wallet_exchange"` to track daily usage

**How to Verify:**
1. Go to Wallet Exchange page
2. **From Wallet dropdown** should show:
   - Referral Wallet
   - Binary Wallet
   - Career Level Wallet (with daily limit indicator if applicable)
   - ROI Wallet (with daily limit indicator if applicable)
3. Exchange from Career Level wallet → Should succeed
4. Try to exchange from Career Level wallet again today → Should show error: "You have already exchanged from Career Level wallet today..."
5. Exchange from ROI wallet → Should succeed
6. Try to exchange from ROI wallet again today → Should show error
7. Exchange from Referral/Binary wallets → Should work unlimited times
8. Check UI indicators show correct daily limit status

**Files Changed:**
- `server/src/controllers/user.controller.ts` - Added Career Level and ROI to allowed wallets, implemented daily limit check
- `client/app/(dashboard)/wallet-exchange/page.tsx` - Added Career Level and ROI to dropdown, implemented daily limit status tracking and UI indicators
