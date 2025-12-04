import { asyncHandler } from "../utills/asyncHandler";
import { AppError } from "../utills/AppError";
import { Package } from "../models/Package";
import { Investment } from "../models/Investment";
import { Payment } from "../models/Payment";
import { User } from "../models/User";
import { Settings } from "../models/Settings";
import { Types } from "mongoose";
import {
  createNOWPaymentsInvoice,
  createNOWPaymentsPayment,
  getNOWPaymentsPaymentStatus,
  verifyNOWPaymentsCallback,
  isPaymentCompleted,
  isPaymentFailed,
  NOWPaymentsCallback,
} from "../lib/payments/nowpayments";
import { processInvestment } from "../services/investment.service";

/**
 * Create payment request with NOWPayments
 * POST /api/v1/payment/create
 */
export const createPayment = asyncHandler(async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    throw new AppError("User not authenticated", 401);
  }

  const { packageId, amount, currency = "USD" } = req.body;

  if (!packageId || !amount) {
    throw new AppError("Package ID and amount are required", 400);
  }

  if (!Types.ObjectId.isValid(packageId)) {
    throw new AppError("Invalid package ID", 400);
  }

  // Validate amount
  const investmentAmount = Number(amount);
  if (isNaN(investmentAmount) || investmentAmount <= 0) {
    throw new AppError("Invalid amount", 400);
  }

  // Get package details
  const pkg = await Package.findById(packageId);
  if (!pkg) {
    throw new AppError("Package not found", 404);
  }

  // Validate amount against package limits
  const minAmount = parseFloat(pkg.minAmount.toString());
  const maxAmount = parseFloat(pkg.maxAmount.toString());

  if (investmentAmount < minAmount || investmentAmount > maxAmount) {
    throw new AppError(
      `Amount must be between $${minAmount} and $${maxAmount}`,
      400
    );
  }

  // Check if package is active
  if (pkg.status !== "Active") {
    throw new AppError("Package is not active", 400);
  }

  // Generate order ID
  const orderId = `INV_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Get callback URLs from environment
  const baseUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
  const callbackUrl = process.env.NOWPAYMENTS_CALLBACK_URL || `${process.env.API_URL || 'http://localhost:5001'}/api/v1/payment/callback`;
  const successUrl = `${baseUrl}/invest/success?orderId=${orderId}`;
  const cancelUrl = `${baseUrl}/invest/cancel?orderId=${orderId}`;

  // Check if NOWPayments is enabled
  const nowpaymentsSetting = await Settings.findOne({ key: "nowpayments_enabled" });
  const isNOWPaymentsEnabled = nowpaymentsSetting === null || nowpaymentsSetting.value === true || nowpaymentsSetting.value === "true";

  if (!isNOWPaymentsEnabled) {
    throw new AppError("NOWPayments gateway is currently disabled. Please contact support or wait for it to be enabled.", 503);
  }

  // Get user email for invoice
  const user = await User.findById(userId).select("email").lean();
  const customerEmail = user?.email || undefined;

  // Create invoice with NOWPayments (allows user to choose cryptocurrency)
  // This method accepts USD and doesn't require pay_currency
  try {
    console.log('Creating NOWPayments invoice for order:', orderId);

    const invoiceResponse = await createNOWPaymentsInvoice({
      price_amount: investmentAmount,
      price_currency: currency.toUpperCase(),
      order_id: orderId,
      order_description: `Investment in ${pkg.packageName} - $${investmentAmount}`,
      ipn_callback_url: callbackUrl,
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: customerEmail,
    });

    // Construct invoice URL if not provided
    // Invoice URL format: https://nowpayments.io/invoice/?iid={invoice_id}
    let invoiceUrl = invoiceResponse.invoice_url;
    
    if (!invoiceUrl && invoiceResponse.id) {
      invoiceUrl = `https://nowpayments.io/invoice/?iid=${invoiceResponse.id}`;
    } else if (!invoiceUrl && invoiceResponse.token) {
      invoiceUrl = `https://nowpayments.io/invoice/?token=${invoiceResponse.token}`;
    }
    
    // If still no URL, we cannot proceed - this is an error
    if (!invoiceUrl) {
      throw new AppError("Invoice URL not provided by NOWPayments and could not be constructed. Please contact support.", 500);
    }

    // Store payment record in database (using invoice ID as paymentId for now)
    // The actual payment_id will be updated when callback is received
    const payment = await Payment.create({
      user: new Types.ObjectId(userId),
      package: new Types.ObjectId(packageId),
      orderId,
      paymentId: invoiceResponse.id || invoiceResponse.token || orderId, // Use invoice ID temporarily
      amount: Types.Decimal128.fromString(investmentAmount.toString()),
      currency,
      status: "pending",
      paymentUrl: invoiceUrl,
      payCurrency: invoiceResponse.pay_currency || undefined,
    });

    const response = res as any;
    response.status(200).json({
      status: "success",
      message: "Payment invoice created successfully",
      data: {
        payment: {
          paymentId: invoiceResponse.id || invoiceResponse.token,
          invoiceId: invoiceResponse.id,
          invoiceToken: invoiceResponse.token,
          paymentUrl: invoiceUrl,
          priceAmount: invoiceResponse.price_amount,
          priceCurrency: invoiceResponse.price_currency,
          orderId: invoiceResponse.order_id || orderId,
          status: "pending",
        },
        orderId,
      },
    });
  } catch (error: any) {
    console.error("NOWPayments payment creation error:", error);
    throw new AppError(
      error.message || "Failed to create payment request",
      500
    );
  }
});

/**
 * Handle NOWPayments callback/webhook
 * POST /api/v1/payment/callback
 */
export const handlePaymentCallback = asyncHandler(async (req, res) => {
  const callback: NOWPaymentsCallback = req.body;

  // Verify callback
  if (!verifyNOWPaymentsCallback(callback)) {
    console.error("Invalid NOWPayments callback:", callback);
    throw new AppError("Invalid callback data", 400);
  }

  // Extract order ID and user info
  const orderId = callback.order_id;
  if (!orderId || !orderId.startsWith("INV_")) {
    console.error("Invalid order ID in callback:", orderId);
    throw new AppError("Invalid order ID", 400);
  }

  // Parse order ID to get user ID and package info
  // Format: INV_{userId}_{timestamp}_{random}
  const orderParts = orderId.split("_");
  if (orderParts.length < 2) {
    throw new AppError("Invalid order ID format", 400);
  }

  const userId = orderParts[1];
  if (!Types.ObjectId.isValid(userId)) {
    throw new AppError("Invalid user ID in order", 400);
  }

  // Find payment record
  const payment = await Payment.findOne({ orderId });
  if (!payment) {
    console.error(`Payment not found for order ${orderId}`);
    // Still return 200 to NOWPayments
    const response = res as any;
    return response.status(200).json({
      status: "error",
      message: "Payment record not found",
    });
  }

  // Update payment with callback data
  payment.callbackData = callback;
  payment.actuallyPaid = callback.actually_paid
    ? Types.Decimal128.fromString(callback.actually_paid.toString())
    : undefined;

  // Get payment status from NOWPayments to verify
  try {
    const paymentStatus = await getNOWPaymentsPaymentStatus(callback.payment_id);

    // Update payment status
    if (isPaymentCompleted(paymentStatus.payment_status)) {
      payment.status = "completed";
      await payment.save();
      
      console.log(`Payment ${callback.payment_id} completed for order ${orderId}. Investment will be processed from success page.`);
      
      const response = res as any;
      return response.status(200).json({
        status: "success",
        message: "Payment callback processed - payment confirmed",
      });
    } else if (isPaymentFailed(paymentStatus.payment_status)) {
      payment.status = "failed";
      await payment.save();
      
      console.log(`Payment ${callback.payment_id} failed for order ${orderId}`);
      
      const response = res as any;
      return response.status(200).json({
        status: "success",
        message: "Payment failed - callback processed",
      });
    } else {
      // Payment is still pending
      payment.status = "processing";
      await payment.save();
      
      console.log(`Payment ${callback.payment_id} is pending for order ${orderId}`);
      
      const response = res as any;
      return response.status(200).json({
        status: "success",
        message: "Payment pending - callback received",
      });
    }
  } catch (error: any) {
    console.error("Error processing payment callback:", error);
    payment.status = "processing";
    await payment.save();
    
    // Still return 200 to NOWPayments so they don't retry
    const response = res as any;
    return response.status(200).json({
      status: "error",
      message: "Callback received but processing failed",
    });
  }
});

/**
 * Get payment status
 * GET /api/v1/payment/status/:paymentId
 */
export const getPaymentStatus = asyncHandler(async (req, res) => {
  const { paymentId } = req.params;

  if (!paymentId) {
    throw new AppError("Payment ID is required", 400);
  }

  try {
    const paymentStatus = await getNOWPaymentsPaymentStatus(paymentId);

    const response = res as any;
    response.status(200).json({
      status: "success",
      data: {
        payment: {
          paymentId: paymentStatus.payment_id,
          status: paymentStatus.payment_status,
          payAddress: paymentStatus.pay_address,
          payAmount: paymentStatus.pay_amount,
          payCurrency: paymentStatus.pay_currency,
          actuallyPaid: paymentStatus.actually_paid,
          priceAmount: paymentStatus.price_amount,
          priceCurrency: paymentStatus.price_currency,
          orderId: paymentStatus.order_id,
        },
      },
    });
  } catch (error: any) {
    throw new AppError(
      error.message || "Failed to get payment status",
      500
    );
  }
});

/**
 * Get payment by order ID (for processing investment after payment)
 * GET /api/v1/payment/order/:orderId
 */
export const getPaymentByOrderId = asyncHandler(async (req, res) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    throw new AppError("User not authenticated", 401);
  }

  const { orderId } = req.params;
  if (!orderId) {
    throw new AppError("Order ID is required", 400);
  }

  const payment = await Payment.findOne({ orderId, user: userId }).populate('package', 'packageName');
  
  if (!payment) {
    throw new AppError("Payment not found", 404);
  }

  const response = res as any;
  response.status(200).json({
    status: "success",
    data: {
      payment: {
        id: payment._id,
        orderId: payment.orderId,
        paymentId: payment.paymentId,
        packageId: payment.package,
        amount: parseFloat(payment.amount.toString()),
        currency: payment.currency,
        status: payment.status,
        investmentId: payment.investmentId,
      },
    },
  });
});

