// mailer.ts

/**
 * This module sets up the Nodemailer transport configuration using Gmail
 * and exports it for use in sending emails. It also imports the render function
 * from @react-email/render to be used with email templates.
 */

import nodemailer from 'nodemailer'; // For sending emails via SMTP
import { render } from '@react-email/render'; // To render React email templates into HTML

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
export const auth = nodemailer.createTransport({
  service: 'gmail',      // Using Gmail as the SMTP service
  secure: true,          // Use SSL (port 465)
  port: 465,             // SMTP port for secure connection
  auth: {
    user: process.env.EMAIL_USER, // Gmail user from environment
    pass: process.env.EMAIL_PASS, // Gmail app password from environment
  },
});

