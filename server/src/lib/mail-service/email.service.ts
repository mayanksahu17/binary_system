import React from 'react';
import { auth, render } from './nodemailer';
import SignupWelcomeEmail from './mail-templates/signup-welcome';
import InvestmentPurchaseEmail from './mail-templates/investment-purchase';
import WithdrawalCreatedEmail from './mail-templates/withdrawal-created';
import WithdrawalApprovedEmail from './mail-templates/withdrawal-approved';
import WithdrawalRejectedEmail from './mail-templates/withdrawal-rejected';
import PasswordResetEmail from './mail-templates/password-reset';
import TicketCreatedEmail from './mail-templates/ticket-created';
import TicketStatusUpdateEmail from './mail-templates/ticket-status-update';

/**
 * Email Service
 * Provides utility functions for sending various types of emails
 */

interface SendSignupEmailParams {
  to: string;
  name: string;
  userId: string;
  loginLink: string;
}

/**
 * Send welcome email after successful signup
 */
export const sendSignupWelcomeEmail = async ({
  to,
  name,
  userId,
  loginLink,
}: SendSignupEmailParams): Promise<void> => {
  try {
    // Render the React email template to HTML
    const emailHtml = await render(
      React.createElement(SignupWelcomeEmail, {
        name,
        userId,
        loginLink,
      })
    );

    // Email options
    const mailOptions = {
      from: process.env.EMAIL_USER || 'noreply@cneox.com',
      to,
      subject: 'Welcome to CNEOX - Your Account is Ready!',
      html: emailHtml,
    };

    // Send email
    await auth.sendMail(mailOptions);
    console.log(`✅ Signup welcome email sent to ${to}`);
  } catch (error: any) {
    console.error(`❌ Failed to send signup welcome email to ${to}:`, error.message);
    // Don't throw error - we don't want email failures to break signup flow
    // Log the error but allow signup to complete
  }
};

interface SendInvestmentPurchaseEmailParams {
  to: string;
  name: string;
  packageName: string;
  investmentAmount: number;
  duration: number;
  totalOutputPct: number;
  startDate: string;
  endDate: string;
  dashboardLink: string;
}

/**
 * Send investment purchase confirmation email
 */
export const sendInvestmentPurchaseEmail = async ({
  to,
  name,
  packageName,
  investmentAmount,
  duration,
  totalOutputPct,
  startDate,
  endDate,
  dashboardLink,
}: SendInvestmentPurchaseEmailParams): Promise<void> => {
  try {
    // Render the React email template to HTML
    const emailHtml = await render(
      React.createElement(InvestmentPurchaseEmail, {
        name,
        packageName,
        investmentAmount,
        duration,
        totalOutputPct,
        startDate,
        endDate,
        dashboardLink,
      })
    );

    // Email options
    const mailOptions = {
      from: process.env.EMAIL_USER || 'noreply@cneox.com',
      to,
      subject: `Investment Confirmation - ${packageName}`,
      html: emailHtml,
    };

    // Send email
    await auth.sendMail(mailOptions);
    console.log(`✅ Investment purchase confirmation email sent to ${to}`);
  } catch (error: any) {
    console.error(`❌ Failed to send investment purchase email to ${to}:`, error.message);
    // Don't throw error - we don't want email failures to break investment flow
    // Log the error but allow investment to complete
  }
};

interface SendWithdrawalCreatedEmailParams {
  to: string;
  name: string;
  amount: number;
  charges: number;
  finalAmount: number;
  walletType: string;
  withdrawalId: string;
  dashboardLink: string;
}

/**
 * Send withdrawal created notification email
 */
export const sendWithdrawalCreatedEmail = async ({
  to,
  name,
  amount,
  charges,
  finalAmount,
  walletType,
  withdrawalId,
  dashboardLink,
}: SendWithdrawalCreatedEmailParams): Promise<void> => {
  try {
    const emailHtml = await render(
      React.createElement(WithdrawalCreatedEmail, {
        name,
        amount,
        charges,
        finalAmount,
        walletType,
        withdrawalId,
        dashboardLink,
      })
    );

    const mailOptions = {
      from: process.env.EMAIL_USER || 'noreply@cneox.com',
      to,
      subject: `Withdrawal Request Submitted - $${amount.toFixed(2)}`,
      html: emailHtml,
    };

    await auth.sendMail(mailOptions);
    console.log(`✅ Withdrawal created email sent to ${to}`);
  } catch (error: any) {
    console.error(`❌ Failed to send withdrawal created email to ${to}:`, error.message);
    // Don't throw error - we don't want email failures to break withdrawal flow
  }
};

interface SendWithdrawalApprovedEmailParams {
  to: string;
  name: string;
  amount: number;
  charges: number;
  finalAmount: number;
  walletType: string;
  withdrawalId: string;
  transactionId: string;
  dashboardLink: string;
}

/**
 * Send withdrawal approved notification email
 */
export const sendWithdrawalApprovedEmail = async ({
  to,
  name,
  amount,
  charges,
  finalAmount,
  walletType,
  withdrawalId,
  transactionId,
  dashboardLink,
}: SendWithdrawalApprovedEmailParams): Promise<void> => {
  try {
    const emailHtml = await render(
      React.createElement(WithdrawalApprovedEmail, {
        name,
        amount,
        charges,
        finalAmount,
        walletType,
        withdrawalId,
        transactionId,
        dashboardLink,
      })
    );

    const mailOptions = {
      from: process.env.EMAIL_USER || 'noreply@cneox.com',
      to,
      subject: `Withdrawal Approved - $${amount.toFixed(2)}`,
      html: emailHtml,
    };

    await auth.sendMail(mailOptions);
    console.log(`✅ Withdrawal approved email sent to ${to}`);
  } catch (error: any) {
    console.error(`❌ Failed to send withdrawal approved email to ${to}:`, error.message);
    // Don't throw error - we don't want email failures to break withdrawal flow
  }
};

interface SendWithdrawalRejectedEmailParams {
  to: string;
  name: string;
  amount: number;
  charges: number;
  finalAmount: number;
  walletType: string;
  withdrawalId: string;
  reason?: string;
  dashboardLink: string;
}

/**
 * Send withdrawal rejected notification email
 */
export const sendWithdrawalRejectedEmail = async ({
  to,
  name,
  amount,
  charges,
  finalAmount,
  walletType,
  withdrawalId,
  reason,
  dashboardLink,
}: SendWithdrawalRejectedEmailParams): Promise<void> => {
  try {
    const emailHtml = await render(
      React.createElement(WithdrawalRejectedEmail, {
        name,
        amount,
        charges,
        finalAmount,
        walletType,
        withdrawalId,
        reason,
        dashboardLink,
      })
    );

    const mailOptions = {
      from: process.env.EMAIL_USER || 'noreply@cneox.com',
      to,
      subject: `Withdrawal Request Rejected - $${amount.toFixed(2)}`,
      html: emailHtml,
    };

    await auth.sendMail(mailOptions);
    console.log(`✅ Withdrawal rejected email sent to ${to}`);
  } catch (error: any) {
    console.error(`❌ Failed to send withdrawal rejected email to ${to}:`, error.message);
    // Don't throw error - we don't want email failures to break withdrawal flow
  }
};

interface SendPasswordResetEmailParams {
  to: string;
  name: string;
  resetLink: string;
}

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async ({
  to,
  name,
  resetLink,
}: SendPasswordResetEmailParams): Promise<void> => {
  try {
    const emailHtml = await render(
      React.createElement(PasswordResetEmail, {
        name,
        resetLink,
      })
    );

    const mailOptions = {
      from: process.env.EMAIL_USER || 'noreply@cneox.com',
      to,
      subject: 'Reset Your Password - CNEOX',
      html: emailHtml,
    };

    await auth.sendMail(mailOptions);
    console.log(`✅ Password reset email sent to ${to}`);
  } catch (error: any) {
    console.error(`❌ Failed to send password reset email to ${to}:`, error.message);
    // Don't throw error - we don't want email failures to break password reset flow
  }
};

interface SendTicketCreatedEmailParams {
  to: string;
  name: string;
  ticketId: string;
  subject: string;
  department: string;
}

/**
 * Send ticket created email
 */
export const sendTicketCreatedEmail = async ({
  to,
  name,
  ticketId,
  subject,
  department,
}: SendTicketCreatedEmailParams): Promise<void> => {
  try {
    const emailHtml = await render(
      React.createElement(TicketCreatedEmail, {
        name,
        ticketId,
        subject,
        department,
      })
    );

    const mailOptions = {
      from: process.env.EMAIL_USER || 'noreply@cneox.com',
      to,
      subject: `Support Ticket Created - ${subject}`,
      html: emailHtml,
    };

    await auth.sendMail(mailOptions);
    console.log(`✅ Ticket created email sent to ${to}`);
  } catch (error: any) {
    console.error(`❌ Failed to send ticket created email to ${to}:`, error.message);
  }
};

interface SendTicketStatusUpdateEmailParams {
  to: string;
  name: string;
  ticketId: string;
  subject: string;
  oldStatus: string;
  newStatus: string;
  reply?: string;
}

/**
 * Send ticket status update email
 */
export const sendTicketStatusUpdateEmail = async ({
  to,
  name,
  ticketId,
  subject,
  oldStatus,
  newStatus,
  reply,
}: SendTicketStatusUpdateEmailParams): Promise<void> => {
  try {
    const emailHtml = await render(
      React.createElement(TicketStatusUpdateEmail, {
        name,
        ticketId,
        subject,
        oldStatus,
        newStatus,
        reply,
      })
    );

    const mailOptions = {
      from: process.env.EMAIL_USER || 'noreply@cneox.com',
      to,
      subject: `Ticket Status Updated - ${subject}`,
      html: emailHtml,
    };

    await auth.sendMail(mailOptions);
    console.log(`✅ Ticket status update email sent to ${to}`);
  } catch (error: any) {
    console.error(`❌ Failed to send ticket status update email to ${to}:`, error.message);
  }
};

