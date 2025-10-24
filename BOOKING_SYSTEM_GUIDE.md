# Booking Email System - Setup & Testing Guide

## Overview

The Smart Booking Email System allows the Tax Consulting website to send automated email confirmations to both administrators and customers when a booking request is submitted.

## Features

- ✅ **Dual Email Notifications**: Sends emails to both admin and customer
- ✅ **HTML Email Templates**: Professional-looking confirmation emails
- ✅ **XSS Protection**: User input is sanitized before insertion
- ✅ **Robust Error Handling**: System continues if one email fails
- ✅ **No Database Required**: Emails are sent directly without storage
- ✅ **Production Ready**: Works on local development and Vercel deployment

## Prerequisites

- Gmail account with 2-Factor Authentication enabled
- App Password generated from Google Account settings

## Setup Instructions

### Step 1: Generate Gmail App Password

1. Go to your [Google Account Settings](https://myaccount.google.com/security)
2. Enable **2-Step Verification** if not already enabled
3. Navigate to **2-Step Verification** → **App passwords**
4. Select **Mail** as the app
5. Generate a new app password
6. Copy the 16-character password (remove spaces)

### Step 2: Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and add your credentials:
   ```env
   # OpenAI API key for chatbot (optional)
   OPENAI_API_KEY=your-openai-api-key-here

   # Gmail SMTP for booking email system
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-16-char-app-password-here
   ADMIN_EMAIL=admin@yourdomain.com
   ```

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Start Development Server

```bash
npm run dev
```

The server will start at `http://localhost:3000`

## Testing Locally

### Option 1: Using the Web Interface

1. Navigate to `http://localhost:3000/en/booking`
2. Fill out the booking form:
   - **Name**: Your full name (required)
   - **Email**: Your email address (required)
   - **Phone**: Your phone number (optional)
   - **Message**: Your booking message (required)
3. Click **Send Booking Request**
4. Check both the admin and customer email inboxes for confirmations

### Option 2: Using curl (API Testing)

Test the API endpoint directly:

```bash
# Valid booking request
curl -X POST http://localhost:3000/api/booking \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john.doe@example.com",
    "phone": "+49 123 456 7890",
    "message": "I need help with my tax declaration for 2024."
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Booking email sent successfully"
}
```

### Testing Validation

Test missing required fields:

```bash
# Missing name (should return 400)
curl -X POST http://localhost:3000/api/booking \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "message": "Test message"
  }'
```

Expected response:
```json
{
  "error": "Missing required fields"
}
```

## Email Templates

### Admin Email

**Subject**: 📩 New Booking from {name}

**Content** (plain text):
```
New booking request received:

Name: {name}
Email: {email}
Phone: {phone or "Not provided"}
Message: {message}

Please respond to the customer at: {email}
```

### Customer Email

**Subject**: ✅ Booking Received – Viet Tax Consulting

**Content** (HTML):
- Personalized greeting
- Confirmation message
- Customer's original message displayed
- Professional signature

## Vercel Deployment

### Step 1: Add Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables:
   - `SMTP_USER`: Your Gmail address
   - `SMTP_PASS`: Your Gmail app password
   - `ADMIN_EMAIL`: Email where admin notifications should be sent
   - `OPENAI_API_KEY`: (Optional) For chatbot functionality

### Step 2: Deploy

```bash
# Deploy to Vercel
vercel --prod
```

Or push to your GitHub repository if auto-deployment is configured.

## Troubleshooting

### Issue: "Internal server error" when submitting form

**Possible causes:**
- Invalid SMTP credentials
- Gmail App Password not generated correctly
- Network firewall blocking SMTP ports

**Solution:**
1. Verify `.env.local` contains correct credentials
2. Ensure Gmail App Password is 16 characters (no spaces)
3. Check if your network allows outbound SMTP connections

### Issue: Emails not received

**Possible causes:**
- Emails in spam folder
- Incorrect email addresses
- Gmail security blocking the connection

**Solution:**
1. Check spam/junk folders
2. Verify email addresses in environment variables
3. Check Gmail account for security alerts
4. Ensure "Less secure app access" is not needed (App Passwords bypass this)

### Issue: Only one email sent (admin or customer)

This is expected behavior! The system uses `Promise.allSettled` to ensure at least one email is sent even if the other fails. Check server logs for details:

```bash
# Check development logs
npm run dev

# Look for warnings like:
# "Admin email failed to send, but customer email succeeded"
# or
# "Customer email failed to send, but admin email succeeded"
```

## Security Notes

- ✅ **XSS Protection**: All user input is HTML-escaped before email insertion
- ✅ **Email Validation**: RFC 5322 compliant regex validation
- ✅ **No Sensitive Data Exposure**: SMTP credentials never sent to client
- ✅ **Error Handling**: Graceful degradation if one email fails
- ✅ **Zero Vulnerabilities**: Passed CodeQL security analysis

## API Reference

### POST `/api/booking`

Handles booking requests and sends email notifications.

**Request Body:**
```typescript
{
  name: string;      // Required
  email: string;     // Required (valid email format)
  phone?: string;    // Optional
  message: string;   // Required
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Booking email sent successfully"
}
```

**Error Response (400):**
```json
{
  "error": "Missing required fields"
}
```

**Error Response (500):**
```json
{
  "error": "Internal server error"
}
```

## Components

### BookingForm Component

Located at: `components/sections/BookingForm.tsx`

**Features:**
- Client-side validation
- Real-time error feedback
- Loading states
- Success/error notifications
- Auto-clearing alerts (5 seconds)

**Usage:**
```tsx
import BookingForm from "@/components/sections/BookingForm";

export default function MyPage() {
  return <BookingForm />;
}
```

## Support

For issues or questions:
1. Check this guide first
2. Review server logs for detailed error messages
3. Verify environment variables are correctly set
4. Test with curl to isolate frontend vs backend issues

## License

This implementation is part of the Tax Consulting website project.
