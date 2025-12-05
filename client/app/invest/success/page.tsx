'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';
import { api } from '@/lib/api';

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const [checking, setChecking] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const processingRef = React.useRef(false);

  useEffect(() => {
    if (!orderId) {
      setError('Order ID is missing');
      setChecking(false);
      return;
    }

    // Prevent duplicate processing - check before starting
    if (processingRef.current) {
      return;
    }

    // Set flag immediately to prevent duplicate calls
    processingRef.current = true;

    const processInvestment = async () => {
      try {
        setProcessing(true);
        setError('');

        // Get payment details by orderId
        const paymentResponse = await api.getPaymentByOrderId(orderId);
        
        if (!paymentResponse.data?.payment) {
          throw new Error('Payment not found');
        }

        const payment = paymentResponse.data.payment;

        // Check if this is a free payment (NOWPayments disabled)
        const isFreePayment = payment.paymentId?.startsWith('FREE_');
        
        // For free payments, skip the wait. For real payments, wait for callback processing.
        if (!isFreePayment) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Check if payment is completed
        if (payment.status !== 'completed') {
          setError('Payment is not yet completed. Please wait a moment and refresh.');
          setChecking(false);
          setProcessing(false);
          return;
        }

        // Check if investment already exists
        if (payment.investmentId) {
          setSuccess(true);
          setChecking(false);
          setProcessing(false);
          return;
        }

        // Call investment API with paymentId from NOWPayments
        // Extract voucherId from payment meta if available
        const voucherId = payment.voucher?.voucherId || null;
        
        const investResponse = await api.createInvestment({
          packageId: (payment.packageId as any)._id || payment.packageId,
          amount: payment.amount,
          currency: payment.currency || 'USD',
          paymentId: payment.paymentId, // Pass NOWPayments payment ID
          voucherId: voucherId || undefined, // Pass voucherId if available
        });

        if (investResponse.data) {
          setSuccess(true);
        } else {
          throw new Error('Failed to create investment');
        }
      } catch (err: any) {
        console.error('Error processing investment:', err);
        setError(err.message || 'Failed to process investment. Please contact support.');
        setChecking(false);
        setProcessing(false);
        // Don't reset processingRef - keep it true to prevent duplicate calls
      } finally {
        setChecking(false);
        setProcessing(false);
      }
    };

    processInvestment();

    // No cleanup needed - we want to prevent duplicate calls even on remount
  }, [orderId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {success ? 'Investment Successful!' : 'Payment Successful!'}
        </h1>
        <p className="text-gray-600 mb-6">
          {checking || processing
            ? (processing ? 'Processing your investment...' : 'Verifying your payment...')
            : success
            ? 'Your payment has been received and your investment has been successfully created.'
            : error
            ? error
            : 'Your payment has been received and your investment is being processed.'}
        </p>

        {orderId && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Order ID:</p>
            <p className="text-sm font-mono text-gray-900">{orderId}</p>
          </div>
        )}

        <div className="space-y-3">
          <Link
            href="/investments"
            className="block w-full px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-semibold transition-colors"
          >
            View My Investments
          </Link>
          <button
            onClick={() => router.push('/plans')}
            className="block w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 font-semibold transition-colors"
          >
            Back to Plans
          </button>
        </div>

        <p className="mt-6 text-xs text-gray-500">
          You will receive a confirmation email once your investment is fully processed.
        </p>
      </div>
    </div>
  );
}

export default function InvestSuccessPage() {
  return (
    <ProtectedRoute requireUser>
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      }>
        <SuccessContent />
      </Suspense>
    </ProtectedRoute>
  );
}

