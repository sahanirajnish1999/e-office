import nodemailer from 'nodemailer';
import { appConfig } from '../config/app.config.js';

let transporter = null;

export const getMailTransporter = async () => {
  if (transporter) return transporter;

  if (appConfig.smtp.user && appConfig.smtp.pass) {
    transporter = nodemailer.createTransport({
      host: appConfig.smtp.host,
      port: appConfig.smtp.port,
      auth: {
        user: appConfig.smtp.user,
        pass: appConfig.smtp.pass,
      },
    });
  } else {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }

  return transporter;
};

export const sendMail = async ({ to, subject, text, html }) => {
  const mailer = await getMailTransporter();
  const info = await mailer.sendMail({
    from: '"Enterprise Management" <no-reply@example.com>',
    to,
    subject,
    text,
    html,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log(`✉️ Email sent to ${to}. Preview: ${previewUrl}`);
  }

  return {
    messageId: info.messageId,
    previewUrl,
  };
};

/**
 * Send password reset verification email
 */
export const sendPasswordResetEmail = async (email, resetToken, host) => {
  const resetUrl = `http://${host}/api/auth/reset-password/${resetToken}`;

  const text = `You requested a password reset. Use this token to reset your password within 15 minutes: ${resetToken}\nOr POST to: ${resetUrl}`;
  const html = `
    <h2>Password Reset Request</h2>
    <p>You recently requested to reset your password. Use the token below or send a POST request with your new password.</p>
    <p><b>Reset Token:</b> <code>${resetToken}</code></p>
    <p>This token is valid for 15 minutes.</p>
    <p>If you did not request this, please ignore this email.</p>
  `;

  return sendMail({
    to: email,
    subject: 'Password Reset Verification',
    text,
    html,
  });
};

/**
 * Send email change decision notification
 */
export const sendEmailChangeNotification = async (recipientEmail, status, requestedEmail, note = '') => {
  const isApproved = status === 'approved';
  const subject = `Email Change Request ${isApproved ? 'Approved' : 'Rejected'}`;
  const text = isApproved
    ? `Your request to change your email address to ${requestedEmail} has been approved by the Super Admin.`
    : `Your request to change your email address to ${requestedEmail} was rejected by the Super Admin.${note ? ` Reason: ${note}` : ''}`;

  const html = `
    <h2>Email Change Request ${isApproved ? 'Approved ✅' : 'Rejected ❌'}</h2>
    <p>${text}</p>
  `;

  return sendMail({
    to: recipientEmail,
    subject,
    text,
    html,
  });
};
