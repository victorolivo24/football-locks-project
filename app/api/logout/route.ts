export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { clearUserSession } from '@/lib/auth';

export async function POST() {
  try {
    const response = NextResponse.json({ success: true });
    clearUserSession();
    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
