# Career Level Wallet Feature - Testing Plan

## ✅ Fixed Issues

1. **Career Level Rewards Now Use Separate Wallet** ✓
   - Rewards are credited to `CAREER_LEVEL` wallet instead of `ROI` wallet
   - Clear separation between ROI earnings and career rewards

2. **Critical Logic Fix: Both Sides Required** ✓
   - Career level rewards now require **BOTH left AND right** business volumes to meet threshold
   - Changed from: `totalBusinessVolume >= threshold`
   - Changed to: `leftBusiness >= threshold AND rightBusiness >= threshold`

## 🧪 Pre-Production Testing Checklist

### 1. Basic Functionality Tests

#### Test Case 1: Career Level Reward with Both Sides Meeting Threshold
**Setup:**
- User A has upline User B
- Career Level 1 (Bronze): $1,000 threshold, $200 reward

**Steps:**
1. User A invests $1,000 (left side of User B)
2. User C invests $1,000 (right side of User B)
3. Check User B's Career Level wallet

**Expected Result:**
- User B receives $200 in Career Level wallet
- Transaction shows `meta.type = "career_reward"`
- ROI wallet should NOT receive any career reward

#### Test Case 2: Career Level NOT Triggered with Only One Side
**Setup:**
- User A has upline User B
- Career Level 1 (Bronze): $1,000 threshold

**Steps:**
1. User A invests $1,000 (left side of User B)
2. User B's right side has $0
3. Check User B's Career Level wallet

**Expected Result:**
- User B should NOT receive career level reward
- Career Level wallet balance remains $0
- No career reward transaction created

#### Test Case 3: Multiple Career Levels Triggered
**Setup:**
- User A has upline User B
- Bronze: $1,000 threshold, $200 reward
- Silver: $5,000 threshold, $500 reward

**Steps:**
1. User B has $5,000 on left side
2. User B has $5,000 on right side
3. Check User B's Career Level wallet

**Expected Result:**
- User B receives both $200 (Bronze) and $500 (Silver) rewards
- Total Career Level wallet: $700
- Two separate transactions with correct metadata

### 2. Edge Cases & Potential Loopholes

#### Test Case 4: Unequal Business Volumes
**Setup:**
- User A has upline User B
- Bronze: $1,000 threshold

**Steps:**
1. User B has $500 on left side
2. User B has $1,500 on right side
3. Check User B's Career Level wallet

**Expected Result:**
- Should NOT trigger (left side < $1,000)
- Career Level wallet: $0

**Steps:**
1. User B has $1,000 on left side
2. User B has $1,000 on right side
3. Check User B's Career Level wallet

**Expected Result:**
- Should trigger (both sides >= $1,000)
- Career Level wallet: $200

#### Test Case 5: Career Level Already Completed
**Setup:**
- User B already completed Bronze level
- User B has $2,000 on left, $2,000 on right

**Steps:**
1. User B adds more business volume
2. Check Career Level wallet

**Expected Result:**
- Should NOT receive Bronze reward again
- Should only receive next level (Silver) if thresholds met

#### Test Case 6: Career Level Progress Tracking
**Steps:**
1. User completes Bronze ($1,000 each side)
2. Check `UserCareerProgress.completedLevels`
3. Check `currentLevel` is updated to Silver

**Expected Result:**
- Bronze level marked as completed
- `completedLevels` array contains Bronze entry
- `currentLevel` points to Silver level
- `totalRewardsEarned` includes Bronze reward

### 3. Wallet Functionality Tests

#### Test Case 7: Career Level Wallet Display
**Steps:**
1. User receives career level reward
2. Check Dashboard page

**Expected Result:**
- Career Level wallet visible with correct balance
- Wallet labeled as "Career Level" (not "career_level")

#### Test Case 8: Withdrawal from Career Level Wallet
**Steps:**
1. User has $500 in Career Level wallet
2. User requests withdrawal of $300 from Career Level wallet
3. Admin approves withdrawal

**Expected Result:**
- Withdrawal request created successfully
- After approval, Career Level wallet balance: $200
- Withdrawal transaction recorded correctly

#### Test Case 9: Career Level Transactions in Reports
**Steps:**
1. User receives career level rewards
2. Navigate to Reports page
3. Click "Career Level" tab

**Expected Result:**
- Career Level transactions visible
- Transaction details show correct level name, reward amount
- Transaction type shows as "career_reward" in metadata

### 4. Migration & Data Integrity Tests

#### Test Case 10: Existing Users Get Career Level Wallet
**Steps:**
1. Run migration script: `npx ts-node src/scripts/addCareerLevelWallets.ts`
2. Check existing users have Career Level wallet

**Expected Result:**
- All existing users have Career Level wallet created
- Balance initialized to $0
- No duplicate wallets created

#### Test Case 11: New User Registration
**Steps:**
1. Register new user
2. Check wallets created

**Expected Result:**
- Career Level wallet automatically created
- Balance: $0
- Reserved: $0

### 5. Integration Tests

#### Test Case 12: Full Investment Flow with Career Levels
**Setup:**
- User A (main user)
- User B (left child)
- User C (right child)
- Career Level 1: $1,000 threshold

**Steps:**
1. User B invests $1,000
2. Check User A's business volumes
3. User C invests $1,000
4. Check User A's Career Level wallet

**Expected Result:**
- After step 1: User A leftBusiness = $1,000, rightBusiness = $0, no reward
- After step 3: User A leftBusiness = $1,000, rightBusiness = $1,000
- User A receives $200 in Career Level wallet
- ROI wallet has NO career reward amount

#### Test Case 13: Concurrent Investments
**Steps:**
1. Multiple downline users invest simultaneously
2. Check career level calculation

**Expected Result:**
- Career level rewards calculated correctly
- No duplicate rewards
- All transactions properly recorded

### 6. Security & Validation Tests

#### Test Case 14: Negative Business Volume Handling
**Expected Result:**
- System should handle edge cases gracefully
- No negative values in Career Level wallet

#### Test Case 15: Large Amount Handling
**Steps:**
1. User has $100,000 on left, $100,000 on right
2. Multiple career levels should be triggered

**Expected Result:**
- All applicable career levels triggered
- Rewards calculated correctly
- Wallet balances accurate

### 7. UI/UX Tests

#### Test Case 16: Career Level Wallet Visibility
- [ ] Dashboard shows Career Level wallet card
- [ ] Withdraw page includes Career Level in dropdown
- [ ] Reports page has Career Level tab
- [ ] Wallet Exchange shows Career Level wallet

#### Test Case 17: Transaction Display
- [ ] Career Level transactions show correct metadata
- [ ] Level name displayed correctly
- [ ] Amount formatted correctly
- [ ] Date/time accurate

## 🐛 Potential Loopholes to Watch For

### Loophole 1: Gaming with Sequential Investments
**Scenario:** User could try to trigger rewards by carefully timing investments
**Mitigation:** ✅ Fixed - requires BOTH sides simultaneously

### Loophole 2: Multiple Rewards for Same Level
**Scenario:** System might award same level multiple times
**Mitigation:** ✅ Fixed - checks `isAlreadyCompleted` before awarding

### Loophole 3: Reward Credited to Wrong Wallet
**Scenario:** Career rewards might still go to ROI wallet
**Mitigation:** ✅ Fixed - explicitly uses `WalletType.CAREER_LEVEL`

### Loophole 4: Incomplete Business Volume Check
**Scenario:** Only checking sum instead of both sides
**Mitigation:** ✅ Fixed - checks both `leftBusiness >= threshold AND rightBusiness >= threshold`

## 📋 Pre-Production Checklist

- [ ] All test cases pass
- [ ] Migration script tested on staging database
- [ ] No existing career rewards in ROI wallet (should migrate if any exist)
- [ ] Documentation updated (RULEBOOK.md)
- [ ] Frontend UI tested on all pages
- [ ] Withdrawal functionality tested
- [ ] Reports page tested
- [ ] Career level admin pages still work
- [ ] No breaking changes to existing features

## 🚀 Deployment Steps

1. **Run Migration Script on Staging:**
   ```bash
   cd server
   npx ts-node src/scripts/addCareerLevelWallets.ts
   ```

2. **Test All Critical Flows on Staging**

3. **Deploy Backend Changes**

4. **Deploy Frontend Changes**

5. **Run Migration Script on Production:**
   ```bash
   npx ts-node src/scripts/addCareerLevelWallets.ts
   ```

6. **Monitor for First 24 Hours:**
   - Check Career Level wallet creations
   - Monitor career reward transactions
   - Verify no errors in logs
   - Check wallet balances accuracy

## 🔍 Monitoring Points

- Career Level wallet creation rate
- Career reward transaction volume
- Error logs related to career levels
- Withdrawal requests from Career Level wallet
- User reports/issues related to career rewards
