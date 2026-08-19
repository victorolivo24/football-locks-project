import { NextRequest, NextResponse } from 'next/server';
import {
  createRegisteredUser,
  getUserByLogin,
  setPasswordForUser,
  setUserSession,
  verifyPassword,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { name, password } = await request.json();
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    const trimmedPassword = typeof password === 'string' ? password.trim() : '';

    if (!trimmedName) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    if (trimmedName.length > 40) {
      return NextResponse.json(
        { error: 'Name must be 40 characters or fewer' },
        { status: 400 }
      );
    }

    let user = await getUserByLogin(trimmedName);

    if (user) {
      if (user.passwordHash) {
        if (!trimmedPassword || !verifyPassword(trimmedPassword, user.passwordHash)) {
          return NextResponse.json(
            { error: 'Incorrect password' },
            { status: 401 }
          );
        }
      } else if (trimmedPassword) {
        await setPasswordForUser(user.id, trimmedPassword);
      }
    } else {
      user = await createRegisteredUser(trimmedName, trimmedPassword || undefined);
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Unable to create user' },
        { status: 500 }
      );
    }

    const sessionUser = { name: user.name, userId: user.id };

    // Create response
    const response = NextResponse.json(
      { success: true, user: sessionUser },
      { status: 200 }
    );

    // Set user session cookie
    setUserSession(sessionUser);

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
