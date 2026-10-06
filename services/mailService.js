'use strict';

// Outgoing email. Configured by SMTP_URL (a nodemailer connection URL, e.g.
// smtps://user:pass@smtp.example.com:465). Without it, mail is logged and
// skipped so the rest of a flow still works in dev and before SMTP is set up.

const nodemailer = require('nodemailer');

const FROM = process.env.MAIL_FROM || 'Cairn <dev@cappylabs.uk>';

let transport;
const getTransport = () => {
  if (!process.env.SMTP_URL) return null;
  transport = transport || nodemailer.createTransport(process.env.SMTP_URL);
  return transport;
};

/** Is outgoing mail configured? */
const isConfigured = () => Boolean(process.env.SMTP_URL);

/**
 * Send a plain-text email. Resolves to true when sent, false when skipped
 * because SMTP isn't configured. Rejects on a delivery error.
 */
async function send({ to, subject, text, replyTo }) {
  const t = getTransport();
  if (!t) {
    console.warn(`[mail] SMTP_URL not set; skipped "${subject}" to ${to}`);
    return false;
  }
  await t.sendMail({ from: FROM, to, subject, text, replyTo });
  return true;
}

module.exports = { send, isConfigured };
