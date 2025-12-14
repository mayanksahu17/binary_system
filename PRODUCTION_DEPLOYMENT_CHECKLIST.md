# Career Level Wallet Feature - Production Deployment Checklist

## Pre-Deployment Status

### ✅ Completed
- [x] Code changes implemented
- [x] Career Level wallet type added to enum
- [x] Career level rewards now credit Career Level wallet
- [x] Both sides (left AND right) required logic implemented
- [x] Withdrawal support added for Career Level wallet
- [x] UI updated (Dashboard, Reports, Withdraw, Wallet Exchange)
- [x] Migration script created for wallet creation
- [x] Data migration script created for old rewards
- [x] Database verification script created
- [x] Test scripts created
- [x] Manual testing guide created

### ⚠️ Current Database State
- ✅ All users have Career Level wallets (migration completed)
- ❌ 7 old career reward transactions still in ROI wallets (need data migration)

---

## Deployment Steps

### Step 1: Pre-Deployment Verification (Staging)

1. **Run Verification Script on Staging:**
   ```bash
   cd server
   npx ts-node src/scripts/verifyCareerLevelDatabase.ts
   ```

2. **Expected Results:**
   - All users have Career Level wallets
   - Old career rewards in ROI wallets (will be fixed in Step 4)

3. **Manual Testing:**
   - Follow `STAGING_MANUAL_TESTING_GUIDE.md`
   - Verify all critical flows work
   - Document any issues

---

### Step 2: Deploy Code Changes

1. **Backend Deployment:**
   - Deploy updated backend code to production
   - Ensure environment variables are set correctly
   - Restart backend services

2. **Frontend Deployment:**
   - Deploy updated frontend code to production
   - Clear browser cache/CDN cache if needed

3. **Verify Deployment:**
   - Check backend logs for errors
   - Check frontend loads without errors
   - Verify API endpoints respond correctly

---

### Step 3: Run Wallet Creation Migration (Production)

**Note:** This should already be done, but run it to ensure:

```bash
cd server
npx ts-node src/scripts/addCareerLevelWallets.ts
```

**Expected Output:**
- All users have Career Level wallets
- No errors

---

### Step 4: Migrate Old Career Rewards (Production)

**CRITICAL:** This moves old career rewards from ROI wallets to Career Level wallets.

**Before Running:**
1. ✅ Backup production database
2. ✅ Run on staging first to test
3. ✅ Verify the script logic

**Run Migration:**
```bash
cd server
npx ts-node src/scripts/migrateCareerRewardsFromROI.ts
```

**Expected Output:**
- Successfully migrates all career reward transactions
- Moves balances from ROI wallets to Career Level wallets
- Updates transaction wallet references

**After Migration:**
1. Run verification script to confirm:
   ```bash
   npx ts-node src/scripts/verifyCareerLevelDatabase.ts
   ```

2. Expected Results:
   - ✅ No career rewards in ROI wallets
   - ✅ All career rewards in Career Level wallets
   - ✅ Wallet balances correct

---

### Step 5: Post-Deployment Verification

1. **Database Verification:**
   ```bash
   npx ts-node src/scripts/verifyCareerLevelDatabase.ts
   ```
   
   All checks should PASS:
   - ✅ All users have Career Level wallets
   - ✅ No career rewards in ROI wallets
   - ✅ Career rewards in Career Level wallets
   - ✅ Wallet balance integrity

2. **Functional Testing:**
   - Test new investment → career level reward flow
   - Verify rewards go to Career Level wallet (not ROI)
   - Test withdrawal from Career Level wallet
   - Verify UI displays correctly

3. **Monitor Logs:**
   - Check for any errors related to career levels
   - Monitor career reward transactions
   - Watch for any unusual patterns

---

## Rollback Plan

If critical issues are found:

### Immediate Rollback (Code)
1. Revert backend code deployment
2. Revert frontend code deployment
3. Restart services

### Data Rollback (if migration causes issues)
**Note:** The data migration updates balances, so rollback requires:
1. Restore from database backup (if needed)
2. Or manually reverse the migration:
   - Move balances back from Career Level to ROI wallets
   - Update transaction wallet references

**Risk Assessment:**
- Code rollback: Low risk (just revert code)
- Data migration rollback: Medium risk (requires careful balance adjustments)

---

## Post-Deployment Monitoring

### First 24 Hours

Monitor these metrics:

1. **Career Level Wallet Activity:**
   - New career rewards being credited
   - No rewards going to ROI wallet (verify via logs)

2. **Withdrawal Requests:**
   - Career Level wallet withdrawals processing correctly
   - No errors in withdrawal flow

3. **User Reports:**
   - Users can see Career Level transactions in Reports
   - UI displaying correctly

4. **Error Logs:**
   - No errors related to career level checks
   - No wallet-related errors
   - No transaction creation errors

### Weekly Check

1. Run verification script:
   ```bash
   npx ts-node src/scripts/verifyCareerLevelDatabase.ts
   ```

2. Review:
   - Career Level wallet balances
   - Transaction counts
   - Any anomalies

---

## Success Criteria

✅ **Deployment is successful if:**

1. All users have Career Level wallets
2. No career rewards in ROI wallets (verified)
3. New career rewards go to Career Level wallet
4. Withdrawal from Career Level wallet works
5. UI displays Career Level wallet correctly
6. Reports show Career Level transactions
7. No increase in error rates
8. No user complaints about missing/incorrect rewards

---

## Known Issues & Limitations

### Before Fix:
- ❌ Career rewards were incorrectly going to ROI wallet
- ❌ Career levels triggered with sum of left + right (should require both sides)

### After Fix:
- ✅ Career rewards go to Career Level wallet
- ✅ Career levels require BOTH left AND right to meet threshold

### Historical Data:
- Old career rewards in ROI wallets will be migrated via script
- Users may need to be notified about the wallet change (optional)

---

## Communication Plan

### Internal Team:
- [ ] Notify development team of deployment
- [ ] Notify QA team to monitor
- [ ] Notify support team of changes

### Users (Optional):
If you want to notify users:
- "Career Level rewards are now in a separate Career Level wallet"
- "You can withdraw from Career Level wallet"
- "Check your Reports → Career Level tab to see transactions"

---

## Contact & Support

**For Issues:**
- Development Team: [Contact]
- Database Admin: [Contact]
- Support Team: [Contact]

**Emergency Rollback:**
- Escalate immediately if:
  - Users losing rewards
  - Wallet balances incorrect
  - Withdrawal failures
  - Critical errors in logs

---

## Checklist Summary

- [ ] Staging testing completed
- [ ] Code reviewed and approved
- [ ] Database backup taken
- [ ] Backend deployed
- [ ] Frontend deployed
- [ ] Wallet creation migration run
- [ ] Old rewards migration run (if needed)
- [ ] Post-deployment verification passed
- [ ] Monitoring setup
- [ ] Team notified
- [ ] Ready for production traffic

---

**Deployment Date:** _______________
**Deployed By:** _______________
**Verification Status:** _______________
**Notes:** _______________

