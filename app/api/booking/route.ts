import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

// Helper function to escape HTML to prevent XSS
function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, phone, message } = body;

    // Validate required fields
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Configure nodemailer transporter with Gmail
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Email to admin with booking details
    const adminEmail = {
      from: `"Viet Tax Consulting" <${process.env.SMTP_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject: `📩 New Booking from ${name}`,
      text: `New booking request received:

Name: ${name}
Email: ${email}
Phone: ${phone || "Not provided"}
Message: ${message}

Please respond to the customer at: ${email}`,
    };

    // Email to customer with confirmation
    const customerEmail = {
      from: `"Viet Tax Consulting" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "✅ Booking Received – Viet Tax Consulting",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Viet Tax Consulting</h2>
          <p>Dear ${escapeHtml(name)},</p>
          <p>Thank you for reaching out to Viet Tax Consulting.<br>
          We have received your booking request and will contact you shortly.</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <strong>Your message:</strong><br>
            "${escapeHtml(message)}"
          </div>
          <p>Best regards,<br>
          <strong>Viet Phung Consulting Team</strong></p>
        </div>
      `,
    };

    // Send emails with individual error handling
    const emailResults = await Promise.allSettled([
      transporter.sendMail(adminEmail),
      transporter.sendMail(customerEmail),
    ]);

    // Check if at least one email was sent successfully
    const adminEmailSuccess = emailResults[0].status === "fulfilled";
    const customerEmailSuccess = emailResults[1].status === "fulfilled";

    if (!adminEmailSuccess && !customerEmailSuccess) {
      // Both emails failed
      console.error("Both emails failed to send:", {
        adminError: emailResults[0].status === "rejected" ? emailResults[0].reason : null,
        customerError: emailResults[1].status === "rejected" ? emailResults[1].reason : null,
      });
      throw new Error("Failed to send emails");
    }

    // Log partial success if only one email was sent
    if (!adminEmailSuccess) {
      console.warn("Admin email failed to send, but customer email succeeded");
    }
    if (!customerEmailSuccess) {
      console.warn("Customer email failed to send, but admin email succeeded");
    }

    console.log("Booking emails sent successfully:", { 
      name, 
      email,
      adminEmailSent: adminEmailSuccess,
      customerEmailSent: customerEmailSuccess
    });

    return NextResponse.json(
      {
        success: true,
        message: "Booking email sent successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Booking API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
