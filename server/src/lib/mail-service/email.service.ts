import React from 'react';
import { auth, render } from './nodemailer';
import SignupWelcomeEmail from './mail-templates/signup-welcome';
import InvestmentPurchaseEmail from './mail-templates/investment-purchase';

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

