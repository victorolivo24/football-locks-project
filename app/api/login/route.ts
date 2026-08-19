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
    const body = await request.json().catch(() => ({}));
    const { name, password, mode = 'login' } = body;
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    const trimmedPassword = typeof password === 'string' ? password.trim() : '';

    if (!trimmedName) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    if (trimmedName.length < 2) {
      return NextResponse.json(
        { error: 'Name must be at least 2 characters long' },
        { status: 400 }
      );
    }

    if (trimmedName.length > 40) {
      return NextResponse.json(
        { error: 'Name must be 40 characters or fewer' },
        { status: 400 }
      );
    }

    const existingUser = await getUserByLogin(trimmedName);

    if (mode === 'register') {
      if (existingUser) {
        return NextResponse.json(
          { error: `An account named "${existingUser.name}" already exists. Please log in.` },
          { status: 409 }
        );
      }

      const newUser = await createRegisteredUser(trimmedName, trimmedPassword || undefined);
      if (!newUser) {
        return NextResponse.json(
          { error: 'Unable to create account. Please try again.' },
          { status: 500 }
        );
      }

      const sessionUser = { name: newUser.name, userId: newUser.id };
      const response = NextResponse.json(
        { success: true, user: sessionUser, message: 'Account created successfully!' },
        { status: 201 }
      );
      setUserSession(sessionUser, response);
      return response;
    }

    // Default: Login mode
    if (!existingUser) {
      return NextResponse.json(
        { error: `No account found for "${trimmedName}". Please create an account.` },
        { status: 404 }
      );
    }

    if (existingUser.passwordHash) {
      if (!trimmedPassword) {
        return NextResponse.json(
          { error: 'This account has a password. Please enter your password.' },
          { status: 401 }
        );
      }
      if (!verifyPassword(trimmedPassword, existingUser.passwordHash)) {
        return NextResponse.json(
          { error: 'Incorrect password.' },
          { status: 401 }
        );
      }
    } else if (trimmedPassword) {
      // If user had no password and provides one, save it for future logins
      await setPasswordForUser(existingUser.id, trimmedPassword);
    }

    const sessionUser = { name: existingUser.name, userId: existingUser.id };
    const response = NextResponse.json(
      { success: true, user: sessionUser },
      { status: 200 }
    );
    setUserSession(sessionUser, response);
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
