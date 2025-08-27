import { NextRequest, NextResponse } from 'next/server';
import { validateUserName, setUserSession, getUserByName } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();

    // Validate input
    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Validate username
    if (!validateUserName(name)) {
      return NextResponse.json(
        { error: 'Invalid username' },
        { status: 400 }
      );
    }

    // Get user info
    const user = getUserByName(name);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 400 }
      );
    }

    // Create response
    const response = NextResponse.json(
      { success: true, user },
      { status: 200 }
    );

    // Set user session cookie
    setUserSession(name);

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
