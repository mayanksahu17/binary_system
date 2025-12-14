# Career Level Wallet Feature - Manual Staging Testing Guide

## Prerequisites

1. **Staging Environment Setup:**
   - Backend server running
   - Frontend application running
   - Database access
   - At least 3 test user accounts

2. **Career Levels Setup:**
   - Ensure career levels are configured (Bronze, Silver, Gold, Platinum)
   - Bronze: $1,000 threshold, $200 reward
   - Silver: $5,000 threshold, $500 reward
   - Gold: $10,000 threshold, $1,000 reward
   - Platinum: $20,000 threshold, $5,000 reward

3. **Run Migration Script:**
   ```bash
   cd server
   npx ts-node src/scripts/addCareerLevelWallets.ts
   ```

---

## Step-by-Step Manual Testing Guide

### Phase 1: Verify Career Level Wallet Creation

#### Test 1.1: Check New User Gets Career Level Wallet

**Steps:**
1. Register a new user account
2. Log in with the new account
3. Navigate to Dashboard page
4. Check the wallet cards section

**Expected Result:**
- ✅ Career Level wallet card is visible
- ✅ Balance shows $0.00
- ✅ Wallet is labeled as "Career Level" (not "career_level")

**Screenshot/Document:**
- [ ] Take screenshot of dashboard showing Career Level wallet

---

#### Test 1.2: Verify All Existing Users Have Career Level Wallet

**Steps:**
1. Run database verification script:
   ```bash
   cd server
   npx ts-node src/scripts/verifyCareerLevelDatabase.ts
   ```
2. Check the output

**Expected Result:**
- ✅ All users have Career Level wallet
- ✅ No users missing Career Level wallet
- ✅ No career rewards in ROI wallets

**Document:**
- [ ] Record verification results

---

### Phase 2: Test Career Level Reward Logic (Both Sides Required)

#### Test 2.1: Single Side Investment (Should NOT Trigger Reward)

**Setup:**
- User A (Main user) - CROWN-000002 or create new
- User B (Left child)
- User C (Right child) - will not invest yet

**Steps:**
1. Set up binary tree structure:
   - User B is left child of User A
   - User C is right child of User A
2. Fund User B's Investment wallet with $10,000
3. User B invests $10,000 in any package
4. Wait for investment to activate
5. Check User A's Career Level wallet balance
6. Check User A's ROI wallet balance
7. Check User A's Referral wallet balance

**Expected Result:**
- ✅ User A's Career Level wallet: $0.00 (NO reward)
- ✅ User A's ROI wallet: $0.00 (NO career reward)
- ✅ User A's Referral wallet: Should have referral bonus (if applicable)
- ✅ No Career Level transactions in Reports → Career Level tab

**Verify in Database:**
```javascript
// Check User A's business volumes
BinaryTree.findOne({ user: UserA._id })
// leftBusiness should be $10,000
// rightBusiness should be $0

// Check User A's Career Level wallet
Wallet.findOne({ user: UserA._id, type: 'career_level' })
// balance should be 0

// Check User A's Career Level transactions
WalletTransaction.find({ 
  user: UserA._id, 
  'wallet.type': 'career_level',
  'meta.type': 'career_reward'
})
// Should return empty array
```

**Document:**
- [ ] Record Career Level wallet balance: $_______
- [ ] Record ROI wallet balance: $_______
- [ ] Record any career reward transactions: _______
- [ ] Take screenshot of User A's Career Level wallet showing $0

---

#### Test 2.2: Both Sides Meet Threshold (Should Trigger Reward)

**Setup:**
- Continue from Test 2.1
- User A already has $10,000 on left side

**Steps:**
1. Fund User C's Investment wallet with $10,000
2. User C invests $10,000 in any package
3. Wait for investment to activate (about 1-2 seconds)
4. Check User A's Career Level wallet balance
5. Check User A's ROI wallet balance
6. Navigate to Reports → Career Level tab
7. Check for Career Level transaction

**Expected Result:**
- ✅ User A's Career Level wallet: $1,000.00 (Gold level reward)
- ✅ User A's ROI wallet: $0.00 (NO career reward - this is critical!)
- ✅ Career Level transaction visible in Reports
- ✅ Transaction shows:
   - Type: CREDIT
   - Amount: $1,000.00
   - Metadata: levelName = "Gold", levelNumber = 3

**Verify in Database:**
```javascript
// Check User A's business volumes
BinaryTree.findOne({ user: UserA._id })
// leftBusiness should be $10,000
// rightBusiness should be $10,000

// Check User A's Career Level wallet
Wallet.findOne({ user: UserA._id, type: 'career_level' })
// balance should be 1000

// Check User A's Career Level transactions
WalletTransaction.find({ 
  user: UserA._id, 
  wallet: careerLevelWallet._id,
  'meta.type': 'career_reward'
})
// Should have 1 transaction with amount 1000, meta.levelName = "Gold"

// Verify NO career rewards in ROI wallet
WalletTransaction.find({ 
  user: UserA._id, 
  'wallet.type': 'roi',
  'meta.type': 'career_reward'
})
// Should return empty array
```

**Document:**
- [ ] Record Career Level wallet balance: $_______
- [ ] Record ROI wallet balance: $_______
- [ ] Record career reward transaction details
- [ ] Take screenshot of Career Level wallet showing $1,000
- [ ] Take screenshot of Career Level transactions in Reports

---

#### Test 2.3: Unequal Business Volumes (Should NOT Trigger Higher Level)

**Setup:**
- Continue from Test 2.2
- User A has $10,000 left, $10,000 right (already got Gold reward)

**Steps:**
1. Have User B invest additional $5,000 (now left side = $15,000)
2. User C has only $10,000 (right side = $10,000)
3. Check User A's Career Level wallet balance
4. Check if Silver level was triggered

**Expected Result:**
- ✅ Career Level wallet balance should remain $1,000 (Gold reward only)
- ✅ NO additional reward because right side ($10,000) < Silver threshold ($5,000 per side requirement)
- ✅ Only one Career Level transaction (the Gold one)

**Note:** Silver level requires $5,000 on BOTH sides, but right side is only $10,000 total. If Silver requires each side to have $5,000, it should have triggered when both sides reached $10,000. This test verifies the logic.

**Document:**
- [ ] Record Career Level wallet balance: $_______
- [ ] Record number of Career Level transactions: _______

---

#### Test 2.4: Multiple Career Levels Triggered Simultaneously

**Setup:**
- Create fresh test users or use existing ones
- User D (Main)
- User E (Left child)
- User F (Right child)

**Steps:**
1. Set up User E as left child, User F as right child of User D
2. Fund both User E and User F with $20,000 each
3. User E invests $20,000
4. User F invests $20,000
5. Check User D's Career Level wallet balance
6. Check Career Level transactions

**Expected Result:**
- ✅ Career Level wallet: $6,700.00 (Bronze $200 + Silver $500 + Gold $1,000 + Platinum $5,000)
- ✅ Multiple Career Level transactions (one for each level)
- ✅ All transactions show correct level names and amounts
- ✅ NO rewards in ROI wallet

**Document:**
- [ ] Record Career Level wallet balance: $_______
- [ ] Record number of Career Level transactions: _______
- [ ] List all career levels that triggered: _______
- [ ] Take screenshot showing multiple transactions

---

### Phase 3: Test Withdrawal Functionality

#### Test 3.1: Withdraw from Career Level Wallet

**Setup:**
- Use User A from previous tests (should have Career Level wallet balance)

**Steps:**
1. Navigate to Withdraw page
2. Verify Career Level wallet appears in dropdown
3. Select Career Level wallet
4. Check available balance
5. Enter withdrawal amount (e.g., $500)
6. Set up crypto wallet address (if not already set)
7. Submit withdrawal request
8. Check withdrawal request status (as admin)

**Expected Result:**
- ✅ Career Level wallet visible in dropdown with label "Career Level" or "career_level"
- ✅ Available balance matches Career Level wallet balance
- ✅ Withdrawal request created successfully
- ✅ Withdrawal request shows walletType = "career_level"
- ✅ After admin approval, Career Level wallet balance decreases

**Verify in Database:**
```javascript
// Check withdrawal request
Withdrawal.findOne({ user: UserA._id, walletType: 'career_level' })
// Should exist with status 'pending' or 'approved'

// After approval, check wallet balance
Wallet.findOne({ user: UserA._id, type: 'career_level' })
// balance should decrease by withdrawal amount + charges
```

**Document:**
- [ ] Screenshot of withdraw page showing Career Level wallet option
- [ ] Record withdrawal request ID: _______
- [ ] Record wallet balance before: $_______
- [ ] Record wallet balance after approval: $_______

---

### Phase 4: Test UI Integration

#### Test 4.1: Dashboard Display

**Steps:**
1. Log in as any user
2. Navigate to Dashboard
3. Check wallet cards section

**Expected Result:**
- ✅ Career Level wallet card visible
- ✅ Shows correct balance
- ✅ Labeled as "Career Level" (human-readable)

**Document:**
- [ ] Screenshot of dashboard with Career Level wallet

---

#### Test 4.2: Reports Page - Career Level Tab

**Steps:**
1. Log in as user with Career Level rewards
2. Navigate to Reports page
3. Check for "Career Level" tab
4. Click Career Level tab
5. Verify transactions are displayed

**Expected Result:**
- ✅ "Career Level" tab visible (not "career_level")
- ✅ Career Level transactions listed
- ✅ Transaction details show correctly:
   - Date & Time
   - Type: CREDIT
   - Amount
   - Status: completed
   - Transaction ID
- ✅ Export CSV button works

**Document:**
- [ ] Screenshot of Career Level tab
- [ ] Screenshot of transaction details
- [ ] Test CSV export

---

#### Test 4.3: Wallet Exchange Page

**Steps:**
1. Navigate to Wallet Exchange page
2. Check wallet dropdown options

**Expected Result:**
- ✅ Career Level wallet appears in wallet selection dropdowns
- ✅ Labeled correctly as "Career Level Wallet"

**Document:**
- [ ] Screenshot of wallet exchange page

---

### Phase 5: Edge Cases & Error Handling

#### Test 5.1: Career Level Already Completed (No Duplicate Rewards)

**Steps:**
1. Use User A who already received Gold reward
2. Manually trigger career level check (via API if needed)
3. Check Career Level wallet balance
4. Check transaction count

**Expected Result:**
- ✅ Career Level wallet balance does NOT increase
- ✅ No duplicate transactions created
- ✅ Same number of transactions as before

**Document:**
- [ ] Record balance before: $_______
- [ ] Record balance after: $_______
- [ ] Record transaction count before: _______
- [ ] Record transaction count after: _______

---

#### Test 5.2: Career Progress Tracking

**Steps:**
1. Navigate to Career Levels page (if exists)
2. Check user's career progress
3. Verify completed levels are recorded

**Expected Result:**
- ✅ Completed career levels are shown
- ✅ Current level is correct
- ✅ Total rewards earned matches Career Level wallet balance

**Document:**
- [ ] Record completed levels: _______
- [ ] Record current level: _______
- [ ] Record total rewards earned: $_______

---

### Phase 6: Database Verification

#### Test 6.1: Run Full Database Verification

**Steps:**
1. Run verification script:
   ```bash
   cd server
   npx ts-node src/scripts/verifyCareerLevelDatabase.ts
   ```
2. Review all check results

**Expected Result:**
- ✅ All checks PASS
- ✅ No career rewards in ROI wallets
- ✅ All users have Career Level wallets
- ✅ Wallet balances match transactions

**Document:**
- [ ] Save verification output
- [ ] Note any warnings or failures

---

## Critical Verification Points

### ✅ Must Verify:

1. **Career rewards go to Career Level wallet, NOT ROI wallet**
   - Check ROI wallet transactions - should have NO `meta.type = "career_reward"`

2. **Both sides required for career level trigger**
   - Left side alone = NO reward
   - Right side alone = NO reward
   - Both sides meet threshold = REWARD

3. **No duplicate rewards**
   - Same career level should not trigger twice

4. **Withdrawal works from Career Level wallet**
   - Can select Career Level wallet in withdraw dropdown
   - Withdrawal request processes correctly

5. **UI displays correctly**
   - Career Level wallet visible on dashboard
   - Career Level transactions in Reports tab
   - Proper labels (not "career_level" but "Career Level")

---

## Test Summary Checklist

After completing all tests, fill out this summary:

- [ ] Phase 1: Wallet Creation - PASS
- [ ] Phase 2: Reward Logic - PASS
- [ ] Phase 3: Withdrawal - PASS
- [ ] Phase 4: UI Integration - PASS
- [ ] Phase 5: Edge Cases - PASS
- [ ] Phase 6: Database Verification - PASS

**Overall Status:** [ ] READY FOR PRODUCTION [ ] NEEDS FIXES

**Issues Found:**
1. 
2. 
3. 

**Recommendations:**
1. 
2. 
3. 

---

## Production Deployment Checklist

Before deploying to production:

- [ ] All manual tests passed
- [ ] Database verification script passes
- [ ] No career rewards in ROI wallets (verified)
- [ ] Migration script tested on staging
- [ ] All users have Career Level wallets
- [ ] UI displays correctly
- [ ] Withdrawal functionality works
- [ ] Documentation updated
- [ ] Team notified of changes

---

## Rollback Plan

If issues are found in production:

1. **Immediate:** Disable career level checks temporarily
2. **Short-term:** Move any career rewards from ROI wallet to Career Level wallet manually
3. **Long-term:** Fix issues and redeploy

**Emergency Contact:**
- [Contact information]
