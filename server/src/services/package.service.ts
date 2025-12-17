import { Package } from "../models/Package";

/**
 * Get the minimum investment amount from all active packages
 * @returns Promise<number> - Minimum investment amount, or 0 if no active packages
 */
export async function getMinimumInvestmentAmount(): Promise<number> {
  try {
    const activePackages = await Package.find({ status: "Active" })
      .select("minAmount")
      .lean();

    if (!activePackages || activePackages.length === 0) {
      // If no active packages, return 0 (or a default minimum)
      return 0;
    }

    // Find the minimum minAmount from all active packages
    const minAmounts = activePackages.map((pkg) =>
      parseFloat(pkg.minAmount.toString())
    );
    const minimumInvestment = Math.min(...minAmounts);
    return minimumInvestment;
  } catch (error) {
    console.error("Error getting minimum investment amount:", error);
    // Return 0 as fallback
    return 0;
  }
}

/**
 * Get the minimum voucher amount (half of minimum investment)
 * @returns Promise<number> - Minimum voucher amount, or 0 if no active packages
 */
export async function getMinimumVoucherAmount(): Promise<number> {
  const minInvestment = await getMinimumInvestmentAmount();
  // Minimum voucher is half of minimum investment
  return minInvestment / 2;
}
