export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      description,
      screenshotUrls = [],
      userEmail,
      userName,
      url,
      userAgent,
      timestamp,
      screenSize,
    } = req.body || {};

    if (!description) {
      return res.status(400).json({ error: 'Missing bug description' });
    }

    const resendKey = process.env.RESEND_API_KEY;
    const recipientEmail = 'amelia-mara@outlook.com';

    // Build screenshot HTML
    const screenshotHtml = screenshotUrls.length > 0
      ? `
        <h3 style="margin-top:24px;color:#1a1a1a;">Screenshots</h3>
        ${screenshotUrls.map((url, i) => `
          <div style="margin:12px 0;">
            <a href="${url}" target="_blank" style="color:#ef4444;">Screenshot ${i + 1}</a><br/>
            <img src="${url}" alt="Screenshot ${i + 1}" style="max-width:100%;max-height:400px;border-radius:8px;margin-top:4px;border:1px solid #e5e5e5;" />
          </div>
        `).join('')}
      `
      : '<p style="color:#888;">No screenshots attached</p>';

    const htmlBody = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
          <h2 style="margin:0 0 4px;color:#dc2626;font-size:18px;">Bug Report — Checks Happy Beta</h2>
          <p style="margin:0;color:#888;font-size:13px;">${new Date(timestamp).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}</p>
        </div>

        <h3 style="color:#1a1a1a;margin-bottom:8px;">Description</h3>
        <div style="background:#f9fafb;border:1px solid #e5e5e5;border-radius:8px;padding:12px 16px;white-space:pre-wrap;color:#333;font-size:14px;line-height:1.5;">
${description}
        </div>

        ${screenshotHtml}

        <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;" />
        <table style="font-size:13px;color:#666;border-collapse:collapse;">
          <tr><td style="padding:2px 12px 2px 0;font-weight:600;">User</td><td>${userName} (${userEmail})</td></tr>
          <tr><td style="padding:2px 12px 2px 0;font-weight:600;">Page</td><td>${url}</td></tr>
          <tr><td style="padding:2px 12px 2px 0;font-weight:600;">Screen</td><td>${screenSize}</td></tr>
          <tr><td style="padding:2px 12px 2px 0;font-weight:600;">Device</td><td style="font-size:11px;">${userAgent}</td></tr>
        </table>
      </div>
    `;

    // Send email via Resend API
    if (!resendKey) {
      console.error('[BugReport] RESEND_API_KEY not configured');
      return res.status(500).json({ error: 'Email service not configured' });
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Checks Happy Bugs <bugs@checkshappy.com>',
        to: [recipientEmail],
        subject: `[Bug Report] ${description.substring(0, 60)}${description.length > 60 ? '...' : ''}`,
        html: htmlBody,
      }),
    });

    if (!emailResponse.ok) {
      const errData = await emailResponse.json();
      console.error('[BugReport] Resend error:', errData);
      return res.status(502).json({ error: 'Failed to send email' });
    }

    // Always log the report to server logs as a backup
    console.log('[BugReport]', JSON.stringify({
      description: description.substring(0, 200),
      screenshotUrls,
      userEmail,
      userName,
      timestamp,
    }));

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[BugReport] Error:', error);
    return res.status(500).json({ error: 'Failed to send bug report' });
  }
}
