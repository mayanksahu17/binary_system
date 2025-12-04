/**
 * NOWPayments Integration Service
 * Documentation: https://documenter.getpostman.com/view/7907941/2s93JusNJt
 */

import axios from 'axios';

const NOWPAYMENTS_API_URL = process.env.NOWPAYMENTS_API_URL || 'https://api.nowpayments.io/v1';
const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY || '';

export interface NOWPaymentsInvoiceRequest {
  price_amount: number;
  price_currency: string;
  ipn_callback_url?: string; // Webhook callback URL
  order_id?: string; // Your internal order ID
  order_description?: string; // Description of the order
  customer_email?: string; // Customer email
  success_url?: string; // URL to redirect after successful payment
  cancel_url?: string; // URL to redirect if payment is cancelled
}

export interface NOWPaymentsPaymentRequest {
  price_amount: number;
  price_currency: string;
  pay_currency: string; // Required: specific cryptocurrency to pay with (e.g., 'BTC', 'ETH', 'USDT')
  ipn_callback_url?: string; // Webhook callback URL
  order_id?: string; // Your internal order ID
  order_description?: string; // Description of the order
  success_url?: string; // URL to redirect after successful payment
  cancel_url?: string; // URL to redirect if payment is cancelled
}

export interface NOWPaymentsInvoiceResponse {
  id: string; // Invoice ID
  token: string; // Invoice token
  order_id?: string;
  order_description?: string;
  price_amount: number;
  price_currency: string;
  pay_currency?: string; // Optional: selected cryptocurrency
  ipn_callback_url?: string;
  invoice_url?: string; // URL to the invoice/payment page
  success_url?: string;
  cancel_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface NOWPaymentsPaymentResponse {
  payment_id: string;
  payment_status: string;
  pay_address: string;
  price_amount: number;
  price_currency: string;
  pay_amount: number;
  actually_paid?: number;
  pay_currency: string;
  order_id?: string;
  order_description?: string;
  purchase_id?: string;
  outcome_amount?: number;
  outcome_currency?: string;
  payin_extra_id?: string;
  smart_contract?: string;
  network?: string;
  network_precision?: number;
  time_limit?: string;
  burning_percent?: string;
  expiration_estimate_date?: string;
  payment_url?: string;
}

export interface NOWPaymentsPaymentStatus {
  payment_id: string;
  payment_status: string;
  pay_address: string;
  price_amount: number;
  price_currency: string;
  pay_amount: number;
  actually_paid: number;
  pay_currency: string;
  order_id?: string;
  outcome_amount: number;
  outcome_currency: string;
  payin_extra_id?: string;
  smart_contract?: string;
  network?: string;
  network_precision?: number;
  time_limit?: string;
  burning_percent?: string;
  expiration_estimate_date?: string;
  payment_url?: string;
}

export interface NOWPaymentsCallback {
  payment_id: string;
  invoice_id?: string;
  payment_status: string;
  pay_address: string;
  price_amount: number;
  price_currency: string;
  pay_amount: number;
  actually_paid: number;
  pay_currency: string;
  order_id?: string;
  order_description?: string;
  purchase_id?: string;
  outcome_amount: number;
  outcome_currency: string;
  payin_extra_id?: string;
  smart_contract?: string;
  network?: string;
  network_precision?: number;
  time_limit?: string;
  burning_percent?: string;
  expiration_estimate_date?: string;
  payment_extra_id?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Create an invoice with NOWPayments (allows user to choose cryptocurrency)
 * This method doesn't require pay_currency and accepts USD
 */
export async function createNOWPaymentsInvoice(
  request: NOWPaymentsInvoiceRequest
): Promise<NOWPaymentsInvoiceResponse> {
  if (!NOWPAYMENTS_API_KEY) {
    throw new Error('NOWPayments API key is not configured');
  }

  try {
    console.log('Creating NOWPayments invoice:', {
      price_amount: request.price_amount,
      price_currency: request.price_currency,
      order_id: request.order_id,
    });

    const response = await axios.post(
      `${NOWPAYMENTS_API_URL}/invoice`,
      request,
      {
        headers: {
          'x-api-key': NOWPAYMENTS_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('NOWPayments Invoice API Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
    });
    
    let errorMessage = 'Failed to create NOWPayments invoice';
    if (error.response?.data) {
      if (typeof error.response.data === 'string') {
        errorMessage = error.response.data;
      } else if (error.response.data.message) {
        errorMessage = error.response.data.message;
      } else if (error.response.data.error) {
        errorMessage = error.response.data.error;
      } else if (error.response.data.errors) {
        errorMessage = JSON.stringify(error.response.data.errors);
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    throw new Error(errorMessage);
  }
}

/**
 * Create a payment request with NOWPayments
 */
export async function createNOWPaymentsPayment(
  request: NOWPaymentsPaymentRequest
): Promise<NOWPaymentsPaymentResponse> {
  if (!NOWPAYMENTS_API_KEY) {
    throw new Error('NOWPayments API key is not configured');
  }

  // Validate required fields
  if (!request.pay_currency || request.pay_currency.trim() === '') {
    throw new Error('pay_currency is required for NOWPayments payment');
  }

  try {
    // Log the request for debugging (remove sensitive data in production)
    console.log('Creating NOWPayments payment:', {
      price_amount: request.price_amount,
      price_currency: request.price_currency,
      pay_currency: request.pay_currency,
      order_id: request.order_id,
    });

    const response = await axios.post(
      `${NOWPAYMENTS_API_URL}/payment`,
      request,
      {
        headers: {
          'x-api-key': NOWPAYMENTS_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('NOWPayments API Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
    });
    
    // Extract error message from various possible formats
    let errorMessage = 'Failed to create NOWPayments payment';
    if (error.response?.data) {
      if (typeof error.response.data === 'string') {
        errorMessage = error.response.data;
      } else if (error.response.data.message) {
        errorMessage = error.response.data.message;
      } else if (error.response.data.error) {
        errorMessage = error.response.data.error;
      } else if (error.response.data.errors) {
        errorMessage = JSON.stringify(error.response.data.errors);
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    throw new Error(errorMessage);
  }
}

/**
 * Get payment status from NOWPayments
 */
export async function getNOWPaymentsPaymentStatus(
  paymentId: string
): Promise<NOWPaymentsPaymentStatus> {
  if (!NOWPAYMENTS_API_KEY) {
    throw new Error('NOWPayments API key is not configured');
  }

  try {
    const response = await axios.get(
      `${NOWPAYMENTS_API_URL}/payment/${paymentId}`,
      {
        headers: {
          'x-api-key': NOWPAYMENTS_API_KEY,
        },
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('NOWPayments API Error:', error.response?.data || error.message);
    throw new Error(
      error.response?.data?.message || 
      error.message || 
      'Failed to get NOWPayments payment status'
    );
  }
}

/**
 * Verify NOWPayments callback signature
 * Note: NOWPayments may use IPN (Instant Payment Notification) with signature verification
 * Check their documentation for signature verification method
 */
export function verifyNOWPaymentsCallback(callback: NOWPaymentsCallback): boolean {
  // TODO: Implement signature verification if NOWPayments provides it
  // For now, we'll verify the callback structure
  return !!(
    callback.payment_id &&
    callback.payment_status &&
    callback.price_amount &&
    callback.pay_amount
  );
}

/**
 * Check if payment status indicates completion
 */
export function isPaymentCompleted(status: string): boolean {
  const completedStatuses = ['finished', 'confirmed', 'sending', 'partially_paid'];
  return completedStatuses.includes(status.toLowerCase());
}

/**
 * Check if payment status indicates failure
 */
export function isPaymentFailed(status: string): boolean {
  const failedStatuses = ['failed', 'expired', 'refunded', 'canceled'];
  return failedStatuses.includes(status.toLowerCase());
}

