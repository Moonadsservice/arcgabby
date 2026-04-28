const RESEND_API_KEY = import.meta.env.VITE_RESEND_API_KEY;

export const sendEmail = async ({ to, subject, html }) => {
  if (!RESEND_API_KEY || RESEND_API_KEY.startsWith('YOUR_')) {
    console.warn('Resend API Key not configured.');
    return { success: false, error: 'API Key missing' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'ARC Assistant <notifications@resend.dev>', // You should update this with your verified domain
        to: Array.isArray(to) ? to : [to],
        subject: subject,
        html: html,
      }),
    });

    const data = await response.json();
    if (response.ok) {
      return { success: true, data };
    } else {
      console.error('Resend Error:', data);
      return { success: false, error: data };
    }
  } catch (err) {
    console.error('Failed to send email:', err);
    return { success: false, error: err.message };
  }
};
