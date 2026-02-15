// HTML Email Templates for App Invites

export const getCustomerInviteEmail = (magicLink, recipientName = null) => {
  return {
    subject: '🚢 Welcome to Alpha Yachting App',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Alpha Yachting</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f5f7fa;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f7fa; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <!-- Header with Logo -->
          <tr>
            <td style="background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">
                ⚓ Alpha Yachting
              </h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">
                Your Project Portal
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              ${recipientName ? `<p style="color: #1e293b; font-size: 16px; margin: 0 0 20px 0;">Hello ${recipientName},</p>` : ''}
              
              <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                You've been invited to access your yacht service projects through our secure mobile app. 
                Track work orders, view photos, and stay updated on your boat's maintenance - all in one place.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${magicLink}" 
                       style="display: inline-block; background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(14, 165, 233, 0.25);">
                      🔐 Access Your Projects
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color: #64748b; font-size: 14px; text-align: center; margin: 20px 0;">
                Or copy this link: <span style="color: #0ea5e9; word-break: break-all;">${magicLink}</span>
              </p>

              <!-- Installation Instructions -->
              <div style="background-color: #f8fafc; border-left: 4px solid #0ea5e9; padding: 20px; border-radius: 6px; margin: 30px 0;">
                <h3 style="color: #1e293b; margin: 0 0 12px 0; font-size: 16px;">📱 Install on Your Phone (Recommended)</h3>
                <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 10px 0;">
                  <strong>iPhone (Safari):</strong> Tap Share → "Add to Home Screen"
                </p>
                <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0;">
                  <strong>Android (Chrome):</strong> Tap Menu → "Install app" or "Add to Home Screen"
                </p>
              </div>

              <p style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 30px 0 0 0; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                🔒 This link is personal and secure. It expires in 7 days.<br>
                Questions? Just reply to this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #1e293b; margin: 0 0 8px 0; font-weight: 600; font-size: 14px;">
                Alfons Pirker
              </p>
              <p style="color: #64748b; margin: 0 0 4px 0; font-size: 13px;">
                Alpha Yachting
              </p>
              <p style="color: #64748b; margin: 0; font-size: 13px;">
                📧 info@alpha-jachting.hr | 📞 +385 52 757 907
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `
  };
};

export const getTechnicianInviteEmail = (magicLink, recipientName = null) => {
  return {
    subject: '🔧 Welcome to Alpha Team App',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Alpha Team</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f5f7fa;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f7fa; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">
                🔧 Alpha Team
              </h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">
                Mobile Technician App
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              ${recipientName ? `<p style="color: #1e293b; font-size: 16px; margin: 0 0 20px 0;">Hello ${recipientName},</p>` : ''}
              
              <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                Welcome to the Alpha Team! You've been invited to access our mobile technician app. 
                Manage your work orders, complete tasks, log time, and capture photos - all from your phone.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${magicLink}" 
                       style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(139, 92, 246, 0.25);">
                      🚀 Access Team App
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color: #64748b; font-size: 14px; text-align: center; margin: 20px 0;">
                Or copy this link: <span style="color: #8b5cf6; word-break: break-all;">${magicLink}</span>
              </p>

              <!-- Installation Instructions -->
              <div style="background-color: #faf5ff; border-left: 4px solid #8b5cf6; padding: 20px; border-radius: 6px; margin: 30px 0;">
                <h3 style="color: #1e293b; margin: 0 0 12px 0; font-size: 16px;">📱 Install on Your Phone (Required)</h3>
                <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 10px 0;">
                  <strong>iPhone (Safari):</strong> Tap Share → "Add to Home Screen"
                </p>
                <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0;">
                  <strong>Android (Chrome):</strong> Tap Menu → "Install app" or "Add to Home Screen"
                </p>
              </div>

              <div style="background-color: #f0fdf4; border: 1px solid #86efac; padding: 16px; border-radius: 6px; margin: 20px 0;">
                <p style="color: #166534; font-size: 14px; line-height: 1.6; margin: 0;">
                  ✅ <strong>What you can do:</strong> View assignments, complete tasks, log hours, upload photos, 
                  add notes, and track your work - all offline-ready.
                </p>
              </div>

              <p style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 30px 0 0 0; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                🔒 This link is personal and secure. It expires in 7 days.<br>
                Need help? Reply to this email or contact your team lead.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #1e293b; margin: 0 0 8px 0; font-weight: 600; font-size: 14px;">
                Alfons Pirker
              </p>
              <p style="color: #64748b; margin: 0 0 4px 0; font-size: 13px;">
                Alpha Yachting
              </p>
              <p style="color: #64748b; margin: 0; font-size: 13px;">
                📧 info@alpha-jachting.hr | 📞 +385 52 757 907
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `
  };
};