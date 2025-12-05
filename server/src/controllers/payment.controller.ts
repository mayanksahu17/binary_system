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

  const { packageId, amount, currency = "USD", voucherId } = req.body;

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

  // Handle voucher if provided
  let voucher = null;
  let voucherInvestmentValue = 0;
  let remainingAmount = investmentAmount;

  if (voucherId) {
    const { Voucher } = await import("../models/Voucher");
    voucher = await Voucher.findOne({ 
      voucherId, 
      user: userId, 
      status: "active" 
    });

    if (!voucher) {
      throw new AppError("Voucher not found or already used", 404);
    }

    // Check if voucher is expired
    if (voucher.expiry && new Date() > voucher.expiry) {
      throw new AppError("Voucher has expired", 400);
    }

    // Get voucher investment value - calculate if not set
    if (voucher.investmentValue) {
      voucherInvestmentValue = parseFloat(voucher.investmentValue.toString());
    } else {
      // Calculate from amount * multiplier if investmentValue is not set
      const voucherAmount = parseFloat(voucher.amount.toString());
      const multiplier = voucher.multiplier || 2;
      voucherInvestmentValue = voucherAmount * multiplier;
    }
    
    // Ensure we have a valid investment value
    if (!voucherInvestmentValue || voucherInvestmentValue === 0 || isNaN(voucherInvestmentValue)) {
      const voucherAmount = parseFloat(voucher.amount.toString());
      const multiplier = voucher.multiplier || 2;
      voucherInvestmentValue = voucherAmount * multiplier;
    }
    
    // Validate: Investment amount must be at least 2x the voucher purchase amount
    const voucherPurchaseAmount = parseFloat(voucher.amount.toString());
    const minimumInvestmentRequired = voucherPurchaseAmount * 2;
    
    if (investmentAmount < minimumInvestmentRequired) {
      throw new AppError(
        `To use this voucher, you must invest at least $${minimumInvestmentRequired.toLocaleString()} (2x the voucher purchase amount of $${voucherPurchaseAmount.toLocaleString()})`,
        400
      );
    }
    
    console.log(`[Voucher] Voucher ID: ${voucher.voucherId}, Amount: ${voucher.amount}, Investment Value: ${voucherInvestmentValue}, Investment Amount: ${investmentAmount}`);
    
    remainingAmount = Math.max(0, investmentAmount - voucherInvestmentValue);

    // If voucher covers full amount or more, no payment needed
    // IMPORTANT: Voucher investment value can be greater than or equal to investment amount - that's fine
    // Examples:
    // - $100 voucher (investment value $200) can cover $100 investment ✅
    // - $100 voucher (investment value $200) can cover $200 investment ✅
    // - $100 voucher (investment value $200) can cover $150 investment ✅
    // - $100 voucher (investment value $200) can cover $300 investment (partial - user pays $100) ✅
    console.log(`[Voucher] Remaining amount: ${remainingAmount}, Voucher covers: ${voucherInvestmentValue >= investmentAmount}`);
    if (remainingAmount === 0 || voucherInvestmentValue >= investmentAmount) {
      // Process investment directly with voucher
      const { processInvestment } = await import("../services/investment.service");
      const investment = await processInvestment(
        userId,
        packageId,
        investmentAmount,
        undefined, // paymentId (not needed when voucher fully covers)
        voucherId  // voucherId (5th parameter)
      );

      // Voucher is already marked as used in processInvestment, but ensure it's saved
      // (processInvestment marks it as used, but we'll double-check here for safety)

      const response = res as any;
      return response.status(200).json({
        status: "success",
        message: "Investment activated successfully with voucher",
        data: {
          investment: {
            id: investment._id,
            amount: investmentAmount,
            voucherUsed: {
              voucherId: voucher.voucherId,
              amount: parseFloat(voucher.amount.toString()),
              investmentValue: voucherInvestmentValue,
            },
            remainingAmount: 0,
          },
        },
      });
    }
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

  // If NOWPayments is disabled, allow direct investment (with or without voucher)
  if (!isNOWPaymentsEnabled) {
    // Process investment directly without payment gateway
    const { processInvestment } = await import("../services/investment.service");
    
    const investment = await processInvestment(
      userId,
      packageId,
      investmentAmount,
      voucherId ? undefined : `DIRECT_${Date.now()}`, // paymentId (only if no voucher)
      voucherId || undefined // voucherId (5th parameter)
    );
    
    // Voucher is already marked as used in processInvestment if provided

    const response = res as any;
    return response.status(200).json({
      status: "success",
      message: "Investment activated successfully (payment gateway disabled)",
      data: {
        investment: {
          id: investment._id,
          amount: investmentAmount,
          voucherUsed: voucher ? {
            voucherId: voucher.voucherId,
            amount: parseFloat(voucher.amount.toString()),
            investmentValue: voucherInvestmentValue,
          } : null,
          remainingAmount: remainingAmount,
        },
      },
    });
  }

  // Get user email for invoice
  const user = await User.findById(userId).select("email").lean();
  const customerEmail = user?.email || undefined;

  // Create invoice with NOWPayments (allows user to choose cryptocurrency)
  // This method accepts USD and doesn't require pay_currency
  try {
    console.log('Creating NOWPayments invoice for order:', orderId);

    // Create invoice for remaining amount (if voucher is used)
    const paymentAmount = remainingAmount > 0 ? remainingAmount : investmentAmount;
    const orderDescription = voucher
      ? `Investment in ${pkg.packageName} - $${investmentAmount} (Voucher: $${voucherInvestmentValue}, Remaining: $${remainingAmount})`
      : `Investment in ${pkg.packageName} - $${investmentAmount}`;

    const invoiceResponse = await createNOWPaymentsInvoice({
      price_amount: paymentAmount,
      price_currency: currency.toUpperCase(),
      order_id: orderId,
      order_description: orderDescription,
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
      amount: Types.Decimal128.fromString(investmentAmount.toString()), // Total investment amount
      currency,
      status: "pending",
      paymentUrl: invoiceUrl,
      payCurrency: invoiceResponse.pay_currency || undefined,
      meta: voucher ? {
        voucherId: voucher.voucherId,
        voucherAmount: parseFloat(voucher.amount.toString()),
        voucherInvestmentValue: voucherInvestmentValue,
        remainingAmount: remainingAmount,
      } : undefined,
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
        voucher: voucher ? {
          voucherId: voucher.voucherId,
          amount: parseFloat(voucher.amount.toString()),
          investmentValue: voucherInvestmentValue,
        } : null,
        remainingAmount: remainingAmount,
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
  
  // Handle voucher purchase callbacks (VCH_ prefix)
  if (orderId && orderId.startsWith("VCH_")) {
    const { Voucher } = await import("../models/Voucher");
    const orderParts = orderId.split("_");
    if (orderParts.length < 2) {
      throw new AppError("Invalid voucher order ID format", 400);
    }

    const userId = orderParts[1];
    if (!Types.ObjectId.isValid(userId)) {
      throw new AppError("Invalid user ID in voucher order", 400);
    }

    // Find voucher by orderId
    const voucher = await Voucher.findOne({ orderId, user: userId });
    if (!voucher) {
      console.error(`Voucher not found for order ${orderId}`);
      const response = res as any;
      return response.status(200).json({
        status: "error",
        message: "Voucher not found",
      });
    }

    // Update payment status
    const paymentStatus = await getNOWPaymentsPaymentStatus(callback.payment_id);
    if (isPaymentCompleted(paymentStatus.payment_status)) {
      // Voucher payment completed - voucher is already active (created when invoice was created)
      // Just confirm the payment
      const { Payment } = await import("../models/Payment");
      const payment = await Payment.findOne({ orderId });
      if (payment) {
        payment.status = "completed";
        payment.callbackData = callback;
        payment.actuallyPaid = callback.actually_paid
          ? Types.Decimal128.fromString(callback.actually_paid.toString())
          : undefined;
        await payment.save();
      }
      
      const response = res as any;
      return response.status(200).json({
        status: "success",
        message: "Voucher payment confirmed",
      });
    } else if (isPaymentFailed(paymentStatus.payment_status)) {
      // Payment failed - mark voucher as revoked or keep it pending
      const { Payment } = await import("../models/Payment");
      const payment = await Payment.findOne({ orderId });
      if (payment) {
        payment.status = "failed";
        await payment.save();
      }
      
      const response = res as any;
      return response.status(200).json({
        status: "success",
        message: "Voucher payment failed - callback processed",
      });
    }

    const response = res as any;
    return response.status(200).json({
      status: "success",
      message: "Voucher payment callback processed",
    });
  }

  // Handle investment payment callbacks (INV_ prefix)
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

  // Get voucher info if voucher was used
  let voucherInfo = null;
  if (payment.meta && (payment.meta as any).voucherId) {
    const { Voucher } = await import("../models/Voucher");
    const voucher = await Voucher.findOne({ 
      voucherId: (payment.meta as any).voucherId,
      user: userId 
    });
    if (voucher) {
      voucherInfo = {
        voucherId: voucher.voucherId,
        amount: parseFloat(voucher.amount.toString()),
        investmentValue: parseFloat(voucher.investmentValue.toString()),
        multiplier: voucher.multiplier || 2,
      };
    }
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
        voucher: voucherInfo,
        remainingAmount: voucherInfo ? (payment.meta as any)?.remainingAmount : null,
      },
    },
  });
});

