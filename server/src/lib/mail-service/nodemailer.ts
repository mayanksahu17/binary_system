// mailer.ts

/**
 * This module sets up the Nodemailer transport configuration using Gmail
 * and exports it for use in sending emails. It also imports the render function
 * from @react-email/render to be used with email templates.
 */

import nodemailer from 'nodemailer'; // For sending emails via SMTP
import { render } from '@react-email/render'; // To render React email templates into HTML

// Export render function for use in email templates
export { render };

/**
 * Nodemailer transport configuration using Gmail.
 * 
 * Notes:
 * - Make sure to enable "Allow less secure apps" or use App Passwords if you have 2FA enabled.
 * - Ensure `EMAIL_USER` and `EMAIL_PASS` are set in your environment variables (.env.local).
 *
 * Environment Variables:
 * - EMAIL_USER: Your Gmail email address (e.g., example@gmail.com)
 * - EMAIL_PASS: Your Gmail app password (not the regular Gmail password)
 * - CLIENT_URL: Frontend/client application URL for email links (e.g., http://localhost:3000 or https://yourdomain.com)
 *   - Falls back to FRONTEND_URL if CLIENT_URL is not set
 * 
 * Example usage:
 * 
 *   import { auth } from './mailer';
 * 
 *   const mailOptions = {
 *     from: process.env.EMAIL_USER,
 *     to: 'recipient@example.com',
 *     subject: 'Hello!',
 *     html: '<p>This is a test email</p>',
 *   };
 * 
 *   await auth.sendMail(mailOptions);
 */
// Validate email credentials are set
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

if (!EMAIL_USER || !EMAIL_PASS) {
  console.warn('⚠️  EMAIL_USER or EMAIL_PASS environment variables are not set. Email functionality will not work.');
}

export const auth = nodemailer.createTransport({
  host: "smtp.hostinger.com", // Hostinger SMTP server
  port: 465,                  // Use 465 for SSL
  secure: true,               // true for port 465, false for 587
  auth: {
    user: process.env.EMAIL_USER,   // Your email
    pass: process.env.EMAIL_PASS,   // Your email password
  },
});

