import nodemailer from 'nodemailer';
import { ENV } from '../config/env.js';

const getTransport = () => {
  if (!ENV.EMAIL_USER || !ENV.EMAIL_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: ENV.EMAIL_USER,
      pass: ENV.EMAIL_PASS,
    },
  });
};

export const sendAdminAnnouncementEmail = async ({
  recipients,
  title,
  message,
}) => {
  const transport = getTransport();
  if (!transport || recipients.length === 0) {
    return {
      sent: 0,
      skipped: recipients.length,
      configured: !!transport,
    };
  }

  await transport.sendMail({
    from: ENV.EMAIL_FROM || ENV.EMAIL_USER,
    bcc: recipients,
    subject: title,
    text: message,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.5"><h2>${title}</h2><p>${message.replace(/\n/g, '<br>')}</p></div>`,
  });

  return {
    sent: recipients.length,
    skipped: 0,
    configured: true,
  };
};
