import {NextRequest, NextResponse} from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {name, email, phone, service, message} = body;

    // Validate required fields
    if (!name || !email || !service || !message) {
      return NextResponse.json(
        {error: 'Missing required fields'},
        {status: 400}
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {error: 'Invalid email format'},
        {status: 400}
      );
    }

    // Log the booking request
    console.log('New booking request:', {
      name,
      email,
      phone,
      service,
      message,
      timestamp: new Date().toISOString()
    });

    // In a real application, you would:
    // 1. Save to database
    // 2. Send confirmation email to client
    // 3. Send notification email to staff
    // 4. Integrate with calendar system

    // For now, just return success
    return NextResponse.json(
      {
        success: true,
        message: 'Booking request received successfully'
      },
      {status: 200}
    );
  } catch (error) {
    console.error('Error processing booking request:', error);
    return NextResponse.json(
      {error: 'Internal server error'},
      {status: 500}
    );
  }
}
