import nodemailer from 'nodemailer';
import { ENV } from '../config/env.js';

/**
 * @returns {string} From header for outbound mail
 */
export function getMailFrom() {
  return (ENV.EMAIL_FROM || ENV.EMAIL_USER || '').trim() || undefined;
}

/**
 * @param {import('nodemailer').Transporter | null} [existing]
 * @returns {import('nodemailer').Transporter | null}
 */
export function createMailTransporter(existing = null) {
  if (existing) return existing;
  if (!ENV.EMAIL_USER || !ENV.EMAIL_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    service: 'Gmail',
    auth: { user: ENV.EMAIL_USER, pass: ENV.EMAIL_PASS },
  });
}
