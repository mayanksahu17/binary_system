/**
 * Mock NowPayments Service
 * This is a mock implementation that will be replaced with real NowPayments integration
 */

export interface MockPaymentRequest {
  amount: number;
  currency: string;
  packageId: string;
  userId: string;
}

export interface MockPaymentResponse {
  success: boolean;
  paymentId: string;
  status: "pending" | "completed" | "failed";
  amount: number;
  currency: string;
  message?: string;
}

/**
 * Mock payment processing
 * In production, this will call the real NowPayments API
 */
export async function processMockPayment(
  request: MockPaymentRequest
): Promise<MockPaymentResponse> {
  // Simulate payment processing delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Mock payment - always succeeds for now
  // In production, this would:
  // 1. Create payment request with NowPayments
  // 2. Get payment URL/invoice
  // 3. Wait for webhook confirmation
  // 4. Return payment status

  const paymentId = `NP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return {
    success: true,
    paymentId,
    status: "completed",
    amount: request.amount,
    currency: request.currency,
    message: "Payment processed successfully (Mock)",
  };
}

/**
 * Verify mock payment
 */
export async function verifyMockPayment(paymentId: string): Promise<boolean> {
  // In production, this would verify with NowPayments API
  // For mock, just check if it's a valid format
  return paymentId.startsWith("NP_");
}

