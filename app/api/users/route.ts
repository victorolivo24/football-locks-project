import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const allUsers = await db.select({ id: users.id, name: users.name }).from(users);
    return NextResponse.json({ users: allUsers });
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
