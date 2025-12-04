import cron from "node-cron";
import { calculateDailyROI, deactivateExpiredInvestments } from "../services/roi-cron.service";
import { calculateDailyBinaryBonuses } from "../services/investment.service";

/**
 * Setup daily cron jobs
 * Per rule book order of operations:
 * 1. Deactivate expired investments
 * 2. Compute binary matching (BINARY_BONUS) and update carries
 * 3. Compute ROI for each active investment (ROI_PAYOUT) and credit wallet (split renewable/cashable)
 * 4. Record ledger entries for all transactions
 * 
 * NOTE: Referral bonuses are NOT calculated in cron jobs.
 * They are paid immediately when investments are activated (one-time payment via processInvestment).
 */
export function setupROICron() {
  // Run daily at midnight (00:00)
  cron.schedule("0 0 * * *", async () => {
    console.log("[Cron] Starting daily calculation job");
    try {
      // Step 1: Deactivate expired investments
      await deactivateExpiredInvestments();
      
      // Step 2: Calculate binary bonuses FIRST (per rule book: binary before ROI)
      // This aggregates daily business volumes from active principals and calculates binary matching
      await calculateDailyBinaryBonuses();
      
      // Step 3: Calculate ROI for active investments (with renewable principle split)
      // This splits ROI into 50% cashable and 50% renewable principal
      await calculateDailyROI();
      
      console.log("[Cron] Daily calculation job completed (Binary → ROI)");
    } catch (error) {
      console.error("[Cron] Error in daily calculation job:", error);
    }
  });

  console.log("[Cron] Daily cron job scheduled to run daily at 00:00 (Binary → ROI per rule book)");
}

/**
 * Manual trigger for testing (can be called from API endpoint)
 * Triggers ROI calculation only
 */
export async function triggerROICalculation() {
  try {
    await deactivateExpiredInvestments();
    const result = await calculateDailyROI();
    return result;
  } catch (error) {
    throw error;
  }
}

/**
 * Manual trigger for daily calculations (Binary + ROI per rule book order)
 * Can be called from API endpoint for testing
 * Order: Binary → ROI (per rule book section 7)
 */
export async function triggerDailyCalculations() {
  try {
    // Step 1: Deactivate expired investments
    await deactivateExpiredInvestments();
    
    // Step 2: Calculate binary bonuses FIRST (aggregates daily business from active principals)
    const binaryResult = await calculateDailyBinaryBonuses();
    
    // Step 3: Calculate ROI (splits into cashable and renewable)
    const roiResult = await calculateDailyROI();
    
    return {
      binary: binaryResult,
      roi: roiResult,
    };
  } catch (error) {
    throw error;
  }
}

