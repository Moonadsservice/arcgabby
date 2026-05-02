import { supabase } from './supabase';

const getResendKey = () => import.meta.env.VITE_RESEND_API_KEY;
const MAX_RETRIES = 3;
const INITIAL_DELAY = 10; // Reduced for testing

/**
 * Computes a simple hash for payload logging
 */
const getPayloadHash = (payload) => {
  const str = JSON.stringify(payload);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(16);
};

/**
 * Log email send attempt to Supabase
 */
const logEmailAttempt = async ({ userId, recipient, subject, payload, status, errorMessage, attempts }) => {
  if (!supabase) return;
  try {
    const payloadHash = getPayloadHash(payload);
    await supabase.from('email_send_logs').insert([{
      user_id: userId,
      recipient_email: recipient,
      subject,
      payload_hash: payloadHash,
      status,
      error_message: errorMessage,
      attempts
    }]);
  } catch (err) {
    console.error('Failed to log email attempt:', err);
  }
};

/**
 * Sends an email via Resend API with exponential backoff and logging
 */
export const sendEmail = async ({ to, subject, html, userId }) => {
  const RESEND_API_KEY = getResendKey();
  if (!RESEND_API_KEY || RESEND_API_KEY.startsWith('YOUR_')) {
    console.warn('Resend API Key not configured.');
    return { success: false, error: 'API Key missing' };
  }

  const recipients = Array.isArray(to) ? to : [to];
  const results = [];

  for (const recipient of recipients) {
    let attempt = 1;
    let delay = INITIAL_DELAY;
    let success = false;
    let lastError = null;

    while (attempt <= MAX_RETRIES && !success) {
      try {
        const payload = {
          from: 'ARC Assistant <notifications@resend.dev>',
          to: [recipient],
          subject,
          html,
        };

        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (response.ok) {
          success = true;
          await logEmailAttempt({ userId, recipient, subject, payload, status: 'success', attempts: attempt });
          results.push({ recipient, success: true, data });
        } else {
          lastError = data;
          if (response.status === 429 || response.status >= 500) {
            // Retry on rate limit or server error
            console.warn(`Retry ${attempt} for ${recipient} due to status ${response.status}`);
          } else {
            // Don't retry on other 4xx errors
            break;
          }
        }
      } catch (err) {
        lastError = err.message;
        console.error(`Attempt ${attempt} failed for ${recipient}:`, err);
      }

      if (!success && attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      }
      attempt++;
    }

    if (!success) {
      await logEmailAttempt({ 
        userId, 
        recipient, 
        subject, 
        payload: { to: [recipient], subject, html }, 
        status: 'failed', 
        errorMessage: lastError, 
        attempts: attempt - 1 
      });
      results.push({ recipient, success: false, error: lastError });
    }
  }

  return { 
    success: results.every(r => r.success), 
    results 
  };
};

/**
 * Resolves contact names to emails and sends flight notification
 */
export const sendFlightNotification = async ({ userId, flightNumber, contactNames, eventType }) => {
  if (!supabase) return { success: false, error: 'Supabase not configured' };

  try {
    // 1. Resolve contact names to emails
    const { data: contacts, error: contactError } = await supabase
      .from('emergency_contacts')
      .select('email, display_name')
      .eq('user_id', userId)
      .in('display_name', contactNames);

    if (contactError) throw contactError;
    if (!contacts || contacts.length === 0) return { success: false, error: 'No contacts found' };

    const emails = contacts.map(c => c.email);
    const subject = `ARC Alert: Flight ${flightNumber} ${eventType}`;
    const html = `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2>Flight Notification</h2>
        <p>This is an automated update from ARC for flight <strong>${flightNumber}</strong>.</p>
        <p>Status: <strong>${eventType}</strong></p>
        <p>Please stay tuned for further updates.</p>
      </div>
    `;

    // 2. Send emails
    return await sendEmail({ to: emails, subject, html, userId });
  } catch (err) {
    console.error('Flight notification failed:', err);
    return { success: false, error: err.message };
  }
};
