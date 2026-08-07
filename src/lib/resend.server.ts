import { Resend } from 'resend';

/**
 * Sends an email using Resend.
 * This is a server-side helper to be used inside TanStack server functions or routes.
 * 
 * Requirements:
 * 1. Add RESEND_API_KEY to secrets.
 * 2. Ensure the sender domain is verified in Resend.
 */
export async function sendResendEmail(payload: {
  from?: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  reply_to?: string | string[];
  attachments?: any[];
  tags?: { name: string; value: string }[];
}) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not set in environment variables.');
  }

  const resend = new Resend(apiKey);

  const { from, to, subject, html, text, ...rest } = payload;

  // Resend requires at least one of html, text, or react.
  // We ensure 'text' is at least an empty string if nothing else is provided.
  const emailOptions: any = {
    from: from || 'Nexo <noreply@mail.usenexoapp.com>',
    to,
    subject,
    ...rest,
  };

  if (html) emailOptions.html = html;
  if (text) emailOptions.text = text;
  if (!html && !text) emailOptions.text = '';

  const { data, error } = await resend.emails.send(emailOptions);

  if (error) {
    console.error('Resend email error:', error);
    throw new Error(`Failed to send email via Resend: ${error.message}`);
  }

  return data;
}

