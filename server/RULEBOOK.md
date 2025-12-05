# CNEOX Platform - Complete Rule Book

**Version:** 1.0  
**Last Updated:** 2024  
**Platform:** Binary MLM System with ROI, Referral, and Binary Bonuses

---

## Table of Contents

1. [Glossary & Definitions](#glossary--definitions)
2. [User Registration & Tree Structure](#user-registration--tree-structure)
3. [Investment Packages](#investment-packages)
4. [Investment Activation](#investment-activation)
5. [Referral Bonus System](#referral-bonus-system)
6. [Binary Bonus System](#binary-bonus-system)
7. [ROI (Return on Investment) System](#roi-return-on-investment-system)
8. [Wallet Management](#wallet-management)
9. [Withdrawal System](#withdrawal-system)
10. [Daily Cron Job Operations](#daily-cron-job-operations)
11. [Business Volume & Carry Forward](#business-volume--carry-forward)
12. [Edge Cases & Validations](#edge-cases--validations)
13. [Order of Operations](#order-of-operations)
14. [Sample Calculations](#sample-calculations)

---

## Glossary & Definitions

### Core Terms

- **User**: A registered member of the platform with a unique `userId` (format: `CROWN-XXXXXX`)
- **Referrer/Sponsor**: The user who invited another user (direct sponsor)
- **Binary Tree Parent**: The user directly above in the binary tree structure (may differ from referrer)
- **Downline**: Users placed below a user in the binary tree structure
- **Left Leg/Right Leg**: The two branches of a binary tree structure
- **Investment/Package**: A financial commitment to a specific package with defined returns
- **Principal**: The initial investment amount (remains constant throughout the investment period)
- **Business Volume (BV)**: Investment amounts that contribute to binary bonus calculations
- **Carry Forward**: Unmatched business volume that carries over to the next day
- **Power Capacity/Capping Limit**: Maximum daily binary bonus amount per user

### Wallet Types

- **Investment Wallet**: Stores user's investment funds
- **ROI Wallet**: Stores daily ROI payouts (cashable portion)
- **Referral Wallet**: Stores referral bonuses (one-time payments)
- **Binary Wallet**: Stores binary matching bonuses (daily payments)
- **Withdrawal Wallet**: Temporary wallet for withdrawal processing
- **Token Wallet**: For token-based transactions
- **Interest Wallet**: For interest-based earnings
- **Referral Binary Wallet**: Combined referral and binary wallet (legacy)

### Financial Terms

- **Total Output Percentage (TO)**: Total return percentage over investment duration (e.g., 225%)
- **Daily ROI Rate**: Calculated as `(TO / 100) / duration_days`
- **Renewable Principal Percentage (RP)**: Percentage of daily ROI that becomes non-withdrawable (default: 50%)
- **Cashable Portion**: Percentage of daily ROI that is withdrawable (default: 50%)
- **Referral Percentage (R)**: Percentage of investment paid as referral bonus (default: 7%)
- **Binary Percentage (B)**: Percentage of matched volume paid as binary bonus (default: 10%)

---

## User Registration & Tree Structure

### User Registration Process

1. **User Signup**
   - User provides: `name`, `email` or `phone`, `password`
   - User provides: `referrerUserId` or `referrerId` (the person who invited them)
   - User may specify: `position` ("left" or "right") - optional
   - System generates unique `userId` in format `CROWN-XXXXXX`

2. **Referrer Validation**
   - Referrer must exist and be active
   - If no referrer provided, user is placed under admin (CROWN-000000)

3. **Binary Tree Placement**
   - User is placed in binary tree based on referrer's available positions
   - If referrer's direct positions (left/right) are full, user is placed in next available position in that leg
   - Admin (CROWN-000000) can have unlimited children (no binary tree constraints)

4. **User Initialization**
   - Binary tree entry created with parent relationship
   - All wallet types initialized with zero balance
   - User status set to "active"

### Binary Tree Rules

- **Structure**: Each user can have maximum 2 direct children (left and right)
- **Exception**: Admin (CROWN-000000) can have unlimited children
- **Position Assignment**: 
  - If position specified and available → use it
  - If position specified but unavailable → find next available in that leg
  - If no position specified → auto-assign first available (left preferred)

### Referrer vs Binary Tree Parent

- **Referrer (`user.referrer`)**: The person who invited the user (direct sponsor)
- **Binary Tree Parent**: The user directly above in the tree structure
- **Important**: These may differ if the referrer's positions are full
- **Referral Bonus**: Always goes to `user.referrer` (direct sponsor), NOT binary tree parent

---

## Investment Packages

### Package Structure

Each package contains:

- **Package Name**: Display name (e.g., "Solar Starter")
- **Min Amount**: Minimum investment amount (e.g., $100)
- **Max Amount**: Maximum investment amount (e.g., $2000)
- **Duration (D)**: Investment period in days (e.g., 150 days)
- **Total Output Percentage (TO)**: Total return over duration (e.g., 225%)
- **Renewable Principal Percentage (RP)**: % of daily ROI that becomes renewable (e.g., 50%)
- **Referral Percentage (R)**: % of investment paid as referral bonus (e.g., 7%)
- **Binary Percentage (B)**: % of matched volume paid as binary bonus (e.g., 10%)
- **Power Capacity**: Maximum daily binary bonus cap (e.g., $1000)
- **Status**: "Active" or "InActive"

### Package Defaults

- **Total Output Percentage**: 225% (default)
- **Renewable Principal Percentage**: 50% (default)
- **Referral Percentage**: 7% (default)
- **Binary Percentage**: 10% (default)
- **Power Capacity**: $1000 (default)
- **Duration**: 150 days (default)

### Package Validation

- Investment amount must be between `minAmount` and `maxAmount`
- Package must have status "Active"
- User must have sufficient balance in Investment wallet

---

## Investment Activation

### Investment Creation Process

1. **Validation**
   - Check package exists and is active
   - Validate investment amount is within package limits
   - Verify user has sufficient balance in Investment wallet

2. **Investment Record Creation**
   - Create investment record with:
     - `investedAmount`: Initial investment amount
     - `principal`: Starts equal to `investedAmount` (remains constant)
     - `startDate`: Current date
     - `endDate`: `startDate + duration_days`
     - `durationDays`: Package duration
     - `totalOutputPct`: Package total output percentage
     - `dailyRoiRate`: Calculated as `(totalOutputPct / 100) / durationDays`
     - `daysElapsed`: 0
     - `daysRemaining`: `durationDays`
     - `isActive`: true
     - `referralPaid`: false

3. **Immediate Actions (Synchronous)**
   - **Referral Bonus Payment**: If user has referrer and this is user's FIRST investment
   - **Business Volume Addition**: Add investment amount to parent's business volume up the tree
   - **Investment Wallet Update**: Deduct investment amount from user's Investment wallet
   - **Transaction Record**: Create investment transaction record

4. **Deferred Actions (Daily Cron)**
   - **Binary Bonus Calculation**: Calculated daily via cron job
   - **ROI Calculation**: Calculated daily via cron job

### Investment Lifecycle

- **Active**: Investment is earning ROI and contributing to binary bonuses
- **Expired**: Investment has reached `endDate` or `daysRemaining = 0`
- **Deactivated**: Investment is automatically deactivated when expired (via daily cron)

---

## Referral Bonus System

### Referral Bonus Rules

1. **One-Time Payment**: Referral bonus is paid **ONCE per user** (on their first investment only)
2. **Direct Sponsor**: Referral bonus goes to `user.referrer` (the person who invited them)
3. **Immediate Payment**: Paid immediately when investment is activated (not in cron job)
4. **Calculation**: `referralBonus = investedAmount * (referralPct / 100)`

### Referral Bonus Flow

**Scenario 1: First Investment**
- User B (sponsored by User A) invests $100
- User A receives: $100 × 7% = **$7** referral bonus
- Referral bonus credited to User A's Referral wallet immediately

**Scenario 2: Subsequent Investment**
- User B invests again $500
- User A receives: **$0** (referral bonus already paid on first investment)
- System checks: User B has existing investments → skip referral bonus

**Scenario 3: Deep Downline**
- User A invites User D
- User D is placed under User B or User C in binary tree (due to position availability)
- User D invests $200
- User A receives: $200 × 7% = **$14** referral bonus (NOT User B or User C)
- Reason: `user.referrer` = User A (direct sponsor), not binary tree parent

### Referral Bonus Validation

- Check if user has any existing investments
- If `existingInvestments.count === 0` → Pay referral bonus
- If `existingInvestments.count > 0` → Skip referral bonus (already paid)

### Referral Bonus Wallet

- **Type**: `REFERRAL`
- **Balance**: Accumulates all referral bonuses received
- **Withdrawable**: Yes (can be withdrawn)
- **Transaction Type**: "credit" with `meta.type = "referral"`

---

## Binary Bonus System

### Binary Bonus Rules

1. **Daily Calculation**: Binary bonuses calculated **daily via cron job** (not immediately)
2. **Consumption Model**: Matched volume is consumed from both legs
3. **Cumulative Business Volume**: `leftBusiness` and `rightBusiness` never decrease
4. **Carry Forward**: Unmatched volume carries forward to next day
5. **Power Capacity Limit**: Daily binary bonus capped at `powerCapacity` amount

### Business Volume (BV) Addition

**When Investment is Activated:**
- Investment amount is added to parent's business volume
- Traverses up the tree, adding BV to each ancestor's appropriate leg
- BV is added based on user's position (left or right) in parent's tree
- **Important**: BV is added immediately, but binary bonus is calculated later (daily cron)

### Binary Bonus Calculation (Daily Cron)

**Step 1: Calculate Available Volume**
```
left_available = leftCarry + (leftBusiness - leftMatched)
right_available = rightCarry + (rightBusiness - rightMatched)
```

**Step 2: Find Matched Volume**
```
matched = min(left_available, right_available)
```

**Step 3: Apply Power Capacity Cap**
```
capped_matched = min(matched, powerCapacity)
```

**Step 4: Calculate Binary Bonus**
```
binaryBonus = capped_matched * (binaryPct / 100)
```

**Step 5: Consumption Model**
- Consume `capped_matched` from both legs
- Priority: Consume from `leftCarry`/`rightCarry` first, then from unmatched business
- Update `leftMatched` and `rightMatched` to track consumed business from cumulative business volume

**Step 6: Update Carry Forward**
```
newLeftCarry = left_available - capped_matched
newRightCarry = right_available - capped_matched
```
**Important**: The leftover available volume (after subtracting matched amount) becomes the new carry forward. This ensures carry forward is properly flushed after matching.

### Binary Bonus Example

**Scenario: User A has User B (left) and User C (right)**

**Day 1:**
- User B invests $100 → User A's `leftBusiness = $100`
- User C invests $500 → User A's `rightBusiness = $500`
- Daily cron calculates:
  - `left_available = $0 + ($100 - $0) = $100`
  - `right_available = $0 + ($500 - $0) = $500`
  - `matched = min($100, $500) = $100`
  - `capped_matched = min($100, $1000) = $100`
  - `binaryBonus = $100 × 10% = $10`
  - `newLeftCarry = $100 - $100 = $0`
  - `newRightCarry = $500 - $100 = $400`
- Result: User A receives **$10** binary bonus, right carry forward = **$400**

**Day 2:**
- User B invests again $400 → User A's `leftBusiness = $100 + $400 = $500`
- Daily cron calculates:
  - `left_available = $0 + ($500 - $100) = $400` (carry + unmatched business)
  - `right_available = $400 + ($500 - $0) = $900` (carry + unmatched business)
  - `matched = min($400, $900) = $400`
  - `capped_matched = min($400, $1000) = $400`
  - `binaryBonus = $400 × 10% = $40`
  - `newLeftCarry = $400 - $400 = $0` (all matched, no leftover)
  - `newRightCarry = $900 - $400 = $500` (leftover unmatched volume)
- Result: User A receives **$40** binary bonus, right carry forward = **$500**

**Note**: The carry forward is properly flushed after matching. The $400 right carry from Day 1 is consumed, and the new carry forward ($500) represents the leftover unmatched volume after the $400 match.

### Binary Bonus Wallet

- **Type**: `BINARY`
- **Balance**: Accumulates all binary bonuses received
- **Withdrawable**: Yes (can be withdrawn)
- **Transaction Type**: "credit" with `meta.type = "binary"`

---

## ROI (Return on Investment) System

### ROI Calculation Rules

1. **Daily Calculation**: ROI calculated **daily via cron job** (once per day)
2. **Principal Remains Constant**: Principal does NOT increase with renewable principal
3. **Split Payout**: Daily ROI split into cashable (50%) and renewable (50%)
4. **Renewable Principal**: Non-withdrawable, tracked separately in `wallet.renewablePrincipal`
5. **Expiration**: Investment stops earning ROI when `daysRemaining = 0`

### ROI Calculation Formula

**Step 1: Calculate Daily ROI Rate**
```
dailyRoiRate = (totalOutputPct / 100) / durationDays
```

**Step 2: Calculate Daily ROI Amount**
```
dailyRoiAmount = principal * dailyRoiRate
```

**Step 3: Split into Cashable and Renewable**
```
renewablePart = dailyRoiAmount * (renewablePrinciplePct / 100)
cashablePart = dailyRoiAmount - renewablePart
```

**Step 4: Credit to Wallets**
- `cashablePart` → Credited to ROI wallet `balance` (withdrawable)
- `renewablePart` → Credited to ROI wallet `renewablePrincipal` (non-withdrawable)

**Step 5: Update Investment Record**
- `totalRoiEarned` += `cashablePart` (only cashable counts)
- `totalReinvested` += `renewablePart` (track renewable separately)
- `daysElapsed` += 1
- `daysRemaining` -= 1
- `lastRoiDate` = today
- If `daysRemaining = 0` → `isActive = false`

### ROI Example

**Package**: Solar Starter
- `investedAmount`: $1000
- `principal`: $1000 (remains constant)
- `totalOutputPct`: 225%
- `durationDays`: 150
- `renewablePrinciplePct`: 50%

**Daily Calculation:**
- `dailyRoiRate = (225 / 100) / 150 = 0.015` (1.5% per day)
- `dailyRoiAmount = $1000 × 0.015 = $15`
- `renewablePart = $15 × 50% = $7.50` (non-withdrawable)
- `cashablePart = $15 - $7.50 = $7.50` (withdrawable)

**After 150 Days:**
- `totalRoiEarned` = $7.50 × 150 = **$1,125** (cashable)
- `totalReinvested` = $7.50 × 150 = **$1,125** (renewable, non-withdrawable)
- Total ROI = **$2,250** (225% of $1000)

### ROI Wallet

- **Type**: `ROI`
- **Balance**: Cashable ROI (withdrawable)
- **Renewable Principal**: Non-withdrawable renewable portion
- **Transaction Type**: "credit" with `meta.type = "roi"`

---

## Wallet Management

### Wallet Types & Purposes

1. **Investment Wallet** (`INVESTMENT`)
   - Stores funds for making investments
   - Balance decreases when investment is made
   - Balance increases when user deposits funds

2. **ROI Wallet** (`ROI`)
   - `balance`: Cashable ROI (withdrawable)
   - `renewablePrincipal`: Non-withdrawable renewable portion
   - Credited daily via cron job

3. **Referral Wallet** (`REFERRAL`)
   - Stores referral bonuses (one-time payments)
   - Credited immediately when downline makes first investment
   - Withdrawable

4. **Binary Wallet** (`BINARY`)
   - Stores binary matching bonuses (daily payments)
   - Credited daily via cron job
   - Withdrawable

5. **Withdrawal Wallet** (`WITHDRAWAL`)
   - Temporary wallet for withdrawal processing
   - Used during withdrawal request flow

6. **Token Wallet** (`TOKEN`)
   - For token-based transactions
   - Platform-specific use case

7. **Interest Wallet** (`INTEREST`)
   - For interest-based earnings
   - Platform-specific use case

### Wallet Operations

- **Credit**: Add amount to wallet balance
- **Debit**: Subtract amount from wallet balance
- **Reserve**: Block amount for pending transactions
- **Available Balance**: `balance - reserved`

### Wallet Initialization

When a user is created, all wallet types are initialized with:
- `balance`: 0
- `renewablePrincipal`: 0 (ROI wallet only)
- `reserved`: 0
- `currency`: "USD"

---

## Withdrawal System

### Withdrawal Rules

1. **Payment Information Required**: User must have either:
   - Crypto wallet address (`walletAddress`), OR
   - Bank account details (`bankAccount.accountNumber`)

2. **Withdrawable Wallets**: Funds can be withdrawn from:
   - ROI wallet (cashable balance only, not renewable principal)
   - Referral wallet
   - Binary wallet
   - Interest wallet

3. **Withdrawal Process**:
   - User requests withdrawal
   - System validates payment information exists
   - System validates sufficient balance
   - Withdrawal request created with status "pending"
   - Admin approves/rejects withdrawal
   - If approved, amount is debited from wallet and withdrawal processed

4. **Withdrawal Status**:
   - `PENDING`: Awaiting admin approval
   - `APPROVED`: Approved by admin, processing
   - `REJECTED`: Rejected by admin
   - `COMPLETED`: Successfully processed
   - `FAILED`: Processing failed

### Withdrawal Validation

- Check user has payment information (wallet address or bank account)
- Check sufficient balance in requested wallet
- Check balance is not reserved
- Validate withdrawal amount is positive

---

## Daily Cron Job Operations

### Cron Job Schedule

- **Time**: Daily at 00:00 (midnight)
- **Frequency**: Once per day
- **Order of Operations**: Critical - must follow exact sequence

### Order of Operations

**Step 1: Deactivate Expired Investments**
- Find all investments where `endDate < today` OR `daysRemaining <= 0`
- Set `isActive = false`
- These investments stop earning ROI and contributing to binary bonuses

**Step 2: Calculate Binary Bonuses**
- For each user with binary tree entry:
  - Calculate available volume from carry forward and unmatched business
  - Find matched volume (min of left and right available)
  - Apply power capacity cap
  - Calculate binary bonus
  - Update carry forward and matched amounts
  - Credit binary bonus to user's Binary wallet
  - Create binary transaction record

**Step 3: Calculate ROI**
- For each active investment:
  - Check if ROI already calculated today (via `lastRoiDate`)
  - Calculate daily ROI amount
  - Split into cashable and renewable portions
  - Credit cashable to ROI wallet balance
  - Credit renewable to ROI wallet renewablePrincipal
  - Update investment record (daysElapsed, daysRemaining, totalRoiEarned)
  - Create ROI transaction record
  - If investment expired, set `isActive = false`

### Important Notes

- **Referral Bonuses**: NOT calculated in cron job (paid immediately at investment activation)
- **Business Volume**: NOT added in cron job (added immediately at investment activation)
- **Duplicate Prevention**: ROI calculation checks `lastRoiDate` to prevent duplicate calculations

---

## Business Volume & Carry Forward

### Business Volume (BV) Rules

1. **Cumulative**: `leftBusiness` and `rightBusiness` are cumulative and never decrease
2. **Immediate Addition**: BV is added immediately when investment is activated
3. **Tree Traversal**: BV is added up the tree to all ancestors
4. **Position-Based**: BV is added to parent's leg based on user's position (left or right)

### Carry Forward Rules

1. **Unmatched Volume**: Carry forward represents unmatched business volume
2. **Daily Recalculation**: Carry forward is recalculated daily during binary bonus calculation
3. **Consumption Priority**: 
   - First: Consume from carry forward
   - Then: Consume from unmatched business
4. **Leftover Calculation**: After matching, leftover available volume becomes new carry forward

### Carry Forward Calculation

```
left_available = leftCarry + (leftBusiness - leftMatched)
right_available = rightCarry + (rightBusiness - rightMatched)
matched = min(left_available, right_available)
capped_matched = min(matched, powerCapacity)

// Consumption: Priority is carry first, then unmatched business
// Calculate what was consumed from carry vs business
leftConsumedFromCarry = min(capped_matched, leftCarry)
leftConsumedFromBusiness = capped_matched - leftConsumedFromCarry
rightConsumedFromCarry = min(capped_matched, rightCarry)
rightConsumedFromBusiness = capped_matched - rightConsumedFromCarry

// Calculate new carry forward based on consumption:
// 1. If no carry initially: leftover unmatched business becomes carry
// 2. If carry partially consumed: remaining carry + leftover unmatched business
// 3. If carry fully consumed: new carry = $0 (leftover unmatched business stays as unmatched)
```

**Key Points:**
- Carry forward is **flushed** (consumed) during matching
- **CRITICAL**: When carry is fully consumed, it becomes $0 (not leftover unmatched business)
- Leftover unmatched business remains as unmatched (tracked via business - matched)
- If there was no carry initially, leftover unmatched business becomes the new carry forward
- If carry was partially consumed, new carry = remaining carry + leftover unmatched business
- If all available volume is matched, carry forward becomes $0

### Matched Amount Tracking

- `leftMatched`: Total amount matched from `leftBusiness`
- `rightMatched`: Total amount matched from `rightBusiness`
- Used to calculate unmatched business: `leftBusiness - leftMatched`

---

## Career Levels Reward System

### Overview

The Career Levels Reward System rewards users based on their total business volume (left + right business). Users progress through predefined levels and receive rewards when they reach each level's investment threshold.

### Career Level Structure

Each career level has:
- **Name**: e.g., "Bronze", "Silver", "Gold", "Platinum"
- **Level Number**: Sequential ordering (1, 2, 3, 4...)
- **Investment Threshold**: Total business volume required (left + right)
- **Reward Amount**: Reward paid when threshold is reached
- **Status**: Active or InActive

### Default Career Levels

1. **Bronze** (Level 1)
   - Investment Threshold: $1,000
   - Reward: $200

2. **Silver** (Level 2)
   - Investment Threshold: $5,000
   - Reward: $500

3. **Gold** (Level 3)
   - Investment Threshold: $10,000
   - Reward: $1,000

4. **Platinum** (Level 4)
   - Investment Threshold: $20,000
   - Reward: $5,000

### Career Level Calculation

**Total Business Volume:**
```
totalBusinessVolume = leftBusiness + rightBusiness
```

**Level Investment Progress:**
```
levelInvestment = totalBusinessVolume - sum(completedLevelThresholds)
```

**Level Completion:**
- When `levelInvestment >= currentLevelThreshold`, the user:
  1. Receives the reward amount (credited to ROI wallet)
  2. Level investment counter resets to 0
  3. Progresses to the next level
  4. Starts counting from 0 to the next level's threshold

### Career Level Checking

Career levels are checked automatically when:
- Business volume is added to a user's binary tree (via `addBusinessVolume`)
- This happens when a downline activates a package

**Process:**
1. Calculate total business volume (left + right)
2. Find the next level to achieve (after highest completed level)
3. Calculate level investment progress
4. If threshold reached:
   - Award reward to ROI wallet
   - Record completion in `completedLevels`
   - Reset `levelInvestment` to 0
   - Move to next level
5. Update `lastCheckedAt` timestamp

### Career Progress Tracking

Each user has a `UserCareerProgress` record that tracks:
- `currentLevel`: Reference to current career level
- `currentLevelName`: Name of current level
- `levelInvestment`: Investment progress for current level (resets after each level)
- `totalBusinessVolume`: Total business volume (cumulative, never resets)
- `completedLevels`: Array of completed levels with completion date and reward
- `totalRewardsEarned`: Total career rewards earned across all levels
- `lastCheckedAt`: Last time career level was checked

### Example Flow

**User A's Career Journey:**

1. **Initial State:**
   - Total Business: $0
   - Current Level: Bronze (threshold: $1,000)
   - Level Investment: $0

2. **After $1,000 Business:**
   - Total Business: $1,000
   - Level Investment: $1,000
   - **Bronze Level Completed!**
   - Reward: $200 (credited to ROI wallet)
   - Level Investment: $0 (reset)
   - Current Level: Silver (threshold: $5,000)

3. **After $5,000 More Business (Total: $6,000):**
   - Total Business: $6,000
   - Level Investment: $5,000 (counted from $1,000 to $6,000)
   - **Silver Level Completed!**
   - Reward: $500 (credited to ROI wallet)
   - Level Investment: $0 (reset)
   - Current Level: Gold (threshold: $10,000)

4. **After $10,000 More Business (Total: $16,000):**
   - Total Business: $16,000
   - Level Investment: $10,000 (counted from $6,000 to $16,000)
   - **Gold Level Completed!**
   - Reward: $1,000 (credited to ROI wallet)
   - Level Investment: $0 (reset)
   - Current Level: Platinum (threshold: $20,000)

5. **After $20,000 More Business (Total: $36,000):**
   - Total Business: $36,000
   - Level Investment: $20,000 (counted from $16,000 to $36,000)
   - **Platinum Level Completed!**
   - Reward: $5,000 (credited to ROI wallet)
   - Level Investment: $0 (reset)
   - Current Level: null (all levels completed)

### Admin Management

Admins can:
- Create new career levels
- Update existing career levels (threshold, reward, status)
- Delete career levels
- View all users' career progress
- View individual user's career progress

### Important Notes

- Career level checking is **automatic** and happens when business volume is added
- Rewards are credited to the **ROI wallet**
- Level investment counter **resets to 0** after each level completion
- Total business volume is **cumulative** and never resets
- Users can complete multiple levels in sequence
- If all levels are completed, `currentLevel` becomes `null`

---

## Edge Cases & Validations

### User Registration Edge Cases

1. **No Referrer Provided**
   - User is placed under admin (CROWN-000000)
   - Admin can have unlimited children

2. **Referrer's Positions Full**
   - System finds next available position in referrer's leg
   - User may be placed under a downline of referrer

3. **Referrer Inactive**
   - Registration fails with error: "Referrer account is not active"

### Investment Edge Cases

1. **Insufficient Balance**
   - Investment creation fails
   - Error: "Insufficient balance in Investment wallet"

2. **Package Inactive**
   - Investment creation fails
   - Error: "Package not found or inactive"

3. **Amount Out of Range**
   - Investment creation fails
   - Error: "Investment amount must be between $X and $Y"

4. **Multiple Investments Same User**
   - Each investment is tracked separately
   - Referral bonus only paid on first investment
   - All investments contribute to binary bonuses

### Binary Bonus Edge Cases

1. **No Business Volume**
   - Binary bonus = $0
   - Carry forward remains unchanged

2. **One Leg Only**
   - Binary bonus = $0
   - All volume goes to carry forward

3. **Power Capacity Exceeded**
   - Binary bonus capped at power capacity
   - Excess volume goes to carry forward

4. **Zero Carry Forward**
   - All available volume comes from unmatched business
   - After matching, leftover becomes carry forward

### ROI Edge Cases

1. **Investment Expired**
   - ROI calculation skipped
   - Investment marked as inactive

2. **ROI Already Calculated Today**
   - Check `lastRoiDate` equals today
   - Skip calculation to prevent duplicates

3. **Zero Principal**
   - ROI amount = $0
   - No credits to wallet

### Withdrawal Edge Cases

1. **No Payment Information**
   - Withdrawal request fails
   - Error: "Please set your wallet address or bank account details"

2. **Insufficient Balance**
   - Withdrawal request fails
   - Error: "Insufficient balance"

3. **Reserved Amount**
   - Available balance = `balance - reserved`
   - Withdrawal amount must be <= available balance

---

## Order of Operations

### Investment Activation (Immediate)

1. Validate investment (amount, package, balance)
2. Create investment record
3. Deduct amount from Investment wallet
4. Create investment transaction
5. **Pay referral bonus** (if first investment)
6. **Add business volume** up the tree
7. Mark investment as active

### Daily Cron Job (00:00)

1. **Deactivate expired investments**
2. **Calculate binary bonuses** (for all users)
3. **Calculate ROI** (for all active investments)

### Withdrawal Request

1. Validate payment information exists
2. Validate sufficient balance
3. Create withdrawal request (status: pending)
4. Admin approves/rejects
5. If approved: Debit wallet, process withdrawal

---

## Sample Calculations

### Sample 1: Complete Investment Flow

**Setup:**
- User A invites User B (left) and User C (right)
- Package: Solar Starter (7% referral, 10% binary, 225% ROI, 150 days, $1000 cap)

**Day 1 - Investment Activation:**
- User B invests $100
  - User A receives: $100 × 7% = **$7** referral bonus
  - User A's `leftBusiness` = $100
- User C invests $500
  - User A receives: $500 × 7% = **$35** referral bonus
  - User A's `rightBusiness` = $500

**Day 1 - Daily Cron (Binary):**
- User A's binary calculation:
  - `left_available` = $0 + ($100 - $0) = $100
  - `right_available` = $0 + ($500 - $0) = $500
  - `matched` = min($100, $500) = $100
  - `capped_matched` = min($100, $1000) = $100
  - `binaryBonus` = $100 × 10% = **$10**
  - `newLeftCarry` = $0
  - `newRightCarry` = $400

**Day 1 - Daily Cron (ROI):**
- User B's ROI: $100 × (225%/100) / 150 = $1.50/day
  - Cashable: $0.75, Renewable: $0.75
- User C's ROI: $500 × (225%/100) / 150 = $7.50/day
  - Cashable: $3.75, Renewable: $3.75

**Day 2 - User B Invests Again:**
- User B invests $400
  - User A receives: **$0** referral bonus (already paid)
  - User A's `leftBusiness` = $100 + $400 = $500

**Day 2 - Daily Cron (Binary):**
- User A's binary calculation:
  - `left_available` = $0 + ($500 - $100) = $400 (carry + unmatched business)
  - `right_available` = $400 + ($500 - $100) = $800 (carry + unmatched business)
  - `matched` = min($400, $800) = $400
  - `capped_matched` = min($400, $1000) = $400
  - `binaryBonus` = $400 × 10% = **$40**
  - Consumption: All $400 consumed from rightCarry (carry >= matched)
  - `rightConsumedFromCarry` = $400, `rightConsumedFromBusiness` = $0
  - `newLeftCarry` = **$0** (all matched, no leftover)
  - `newRightCarry` = **$0** (carry fully consumed, leftover unmatched business stays as unmatched)
  - `newRightMatched` = $100 (unchanged, no business consumed)
- Result: User A receives **$40** binary bonus
- **Important**: 
  - The original $400 right carry is **consumed** (flushed) during matching
  - **CRITICAL FIX**: When carry is fully consumed, new carry = $0 (not leftover unmatched business)
  - Leftover unmatched business ($400) stays as unmatched (available for future matching)
  - Right matched stays $100 because all matching consumed from carry, not business

### Sample 1.1: Carry Forward Flush Verification

**Scenario**: User A has $400 right carry, User B invests $400 to balance it.

**Day 1 State (After Cron):**
- User A: `leftBusiness = $100`, `leftMatched = $100`, `leftCarry = $0`
- User A: `rightBusiness = $500`, `rightMatched = $100`, `rightCarry = $400`

**Day 2: User B Invests $400**
- User A: `leftBusiness = $500` (increased from $100)
- User A: `rightBusiness = $500`, `rightMatched = $100`, `rightCarry = $400` (unchanged)

**Day 2 Cron Calculation:**
- `left_available` = $0 + ($500 - $100) = $400
- `right_available` = $400 + ($500 - $100) = $800
- `matched` = min($400, $800) = $400
- Consumption: All $400 consumed from rightCarry (carry >= matched)
- `newRightCarry` = $800 - $400 = **$400** (leftover unmatched business)
- `newRightMatched` = $100 (unchanged, no business consumed)

**After Day 2 Cron:**
- The original $400 right carry is **consumed** (flushed) during matching
- New right carry = $400 (leftover unmatched business: $500 - $100 = $400)
- **Verification**: Original $400 carry is gone, replaced by leftover unmatched volume
- **Note**: The new $400 represents leftover unmatched business, not the original carry

### Sample 2: Deep Downline Referral

**Setup:**
- User A invites User B
- User B invites User D (placed under User B in binary tree)
- Package: 7% referral

**Investment:**
- User D invests $200
- **User A receives**: $200 × 7% = **$14** referral bonus
- **User B receives**: $0 (not the direct sponsor)
- Reason: `user.referrer` = User A (direct sponsor), not User B (binary tree parent)

### Sample 3: Power Capacity Limit

**Setup:**
- User A has $2000 left business and $3000 right business
- Power capacity: $1000

**Binary Calculation:**
- `matched` = min($2000, $3000) = $2000
- `capped_matched` = min($2000, $1000) = $1000
- `binaryBonus` = $1000 × 10% = **$100** (capped)
- `newLeftCarry` = $2000 - $1000 = $1000
- `newRightCarry` = $3000 - $1000 = $2000

---

## Technical Implementation Notes

### Database Models

- **User**: User accounts with referrer and position
- **BinaryTree**: Binary tree structure with business volumes and carry forwards
- **Investment**: Investment records with ROI tracking
- **Package**: Investment package definitions
- **Wallet**: User wallets with balances and renewable principal
- **WalletTransaction**: Transaction records for all wallet operations
- **Withdrawal**: Withdrawal requests and processing

### Key Functions

- `processInvestment()`: Handles investment activation
- `processReferralBonus()`: Pays referral bonus (one-time)
- `addBusinessVolumeUpTree()`: Adds BV up the tree
- `calculateDailyBinaryBonuses()`: Daily binary bonus calculation
- `calculateDailyROI()`: Daily ROI calculation
- `updateWallet()`: Wallet balance operations

### Important Constants

- Default referral percentage: 7%
- Default binary percentage: 10%
- Default renewable principal percentage: 50%
- Default power capacity: $1000
- Default total output percentage: 225%
- Default duration: 150 days

---

## Conclusion

This rule book defines all business rules, calculations, and workflows for the CNEOX platform. All calculations and operations must follow these rules exactly to ensure system consistency and accuracy.

**Key Principles:**
1. Referral bonuses: One-time, immediate, first investment only
2. Binary bonuses: Daily, consumption model, power capacity capped
3. ROI: Daily, split into cashable and renewable, principal constant
4. Business volume: Cumulative, immediate addition, daily matching
5. Carry forward: Unmatched volume, daily recalculation

For technical implementation details, refer to the source code and API documentation.

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Maintained By**: Development Team

