# Binary Bonus Calculation Logic

## Overview

Binary bonuses are now calculated **daily via cron job** (at end of day), similar to ROI calculations. Only **referral bonuses** are paid immediately when investments are activated.

## Flow

### When Investment is Activated (Immediate)

1. **Investment Created**: User invests and package is activated
2. **Referral Bonus Paid**: Direct sponsor receives referral bonus immediately (one-time)
3. **Business Volume Added**: Investment amount is added to parent's business volume (BV) up the tree
4. **Binary Bonus**: NOT calculated immediately - only BV is added

### Daily Cron Job (End of Day)

1. **Deactivate Expired Investments**: Remove expired investments from active pool
2. **Calculate Binary Bonuses**: 
   - Aggregate daily business volume from active principals
   - Calculate binary matching using consumption model
   - Credit binary bonuses to user wallets
3. **Calculate ROI**: Split ROI into cashable and renewable principal

## Key Functions

### `processInvestment()`
- Creates investment record
- Pays referral bonus immediately (if applicable)
- Adds business volume up the tree via `addBusinessVolumeUpTree()`
- Does NOT calculate binary bonuses

### `addBusinessVolumeUpTree()`
- Traverses up the binary tree
- Adds investment amount to parent's business volume
- Does NOT calculate or pay binary bonuses
- Binary bonuses calculated later in daily cron

### `calculateDailyBinaryBonuses()`
- Called daily by cron job (runs at midnight)
- Aggregates daily business from active principals
- Calculates binary matching using consumption model
- Credits binary bonuses to user wallets
- Creates binary transaction records

## Cron Job Schedule

- **Time**: Daily at 00:00 (midnight)
- **Order**: 
  1. Deactivate expired investments
  2. Calculate binary bonuses
  3. Calculate ROI

## Benefits

1. **Consistency**: Binary bonuses calculated once per day, like ROI
2. **Performance**: Reduces immediate calculation overhead on investment creation
3. **Accuracy**: All bonuses calculated together at end of day ensures consistency
4. **Scalability**: Better for handling large volumes of investments

## Testing

To test binary bonus calculation:
1. Create investments (BV will be added immediately)
2. Manually trigger daily calculations: `triggerDailyCalculations()` from admin panel
3. Verify binary bonuses are credited correctly

