import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

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
          <p>Dear ${name},</p>
          <p>Thank you for reaching out to Viet Tax Consulting.<br>
          We have received your booking request and will contact you shortly.</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <strong>Your message:</strong><br>
            "${message}"
          </div>
          <p>Best regards,<br>
          <strong>Viet Phung Consulting Team</strong></p>
        </div>
      `,
    };

    // Send both emails
    await Promise.all([
      transporter.sendMail(adminEmail),
      transporter.sendMail(customerEmail),
    ]);

    console.log("Booking emails sent successfully:", { name, email });

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
