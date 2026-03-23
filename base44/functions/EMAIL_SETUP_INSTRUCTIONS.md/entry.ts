# Custom Email Setup Instructions

## Option 1: Resend (Recommended - Easy Setup)

### Step 1: Sign up for Resend
1. Go to https://resend.com
2. Sign up for a free account (100 emails/day free)
3. Verify your domain or use their test domain

### Step 2: Get API Key
1. Go to API Keys section
2. Create a new API key
3. Copy the key (starts with `re_...`)

### Step 3: Add Secret to Base44
1. Go to your Base44 app settings
2. Add environment variable: `RESEND_API_KEY` = your API key
3. Add environment variable: `CUSTOM_EMAIL_FROM` = your email (e.g., "noreply@alpha-jachting.hr")

### Step 4: Install Resend Package
The function will automatically use the npm package when you deploy.

---

## Option 2: SendGrid

### Step 1: Sign up
1. Go to https://sendgrid.com
2. Free tier: 100 emails/day

### Step 2: Get API Key
1. Create API Key in Settings
2. Copy the key (starts with `SG.`)

### Step 3: Add to Base44
1. Add secret: `SENDGRID_API_KEY`
2. Add secret: `CUSTOM_EMAIL_FROM`

---

## After Setup

Once you've added the secrets, the email function will automatically:
- Use your custom email address
- Send beautiful HTML emails
- Include proper branding

## Testing

1. Go to App Invitations admin page
2. Send a test invite
3. Check the recipient's email (including spam folder)
4. Verify the email looks correct and links work

## Troubleshooting

**Emails not arriving:**
- Check spam folder
- Verify API key is correct
- Check email service dashboard for delivery logs

**Domain not verified:**
- Most services require domain verification for production use
- Use test domain for development

**Rate limits:**
- Free tiers have daily limits
- Upgrade plan if needed for production

## Current Status

Without custom email setup, the system uses Base44's built-in email (from `noreply@base44.com`).
This works but lacks custom branding in the sender address.