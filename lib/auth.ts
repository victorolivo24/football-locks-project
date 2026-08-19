import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { eq, sql } from 'drizzle-orm';
import { db } from './db';
import { users } from './db/schema';

export interface UserSession {
  name: string;
  userId: number;
}

const PASSWORD_PREFIX = 'scrypt';

let schemaEnsured = false;
export async function ensureUsersSchema() {
  if (schemaEnsured) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        passwordhash TEXT
      );
    `);
    await db.execute(sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS passwordhash TEXT;
    `);
    schemaEnsured = true;
  } catch (err) {
    console.warn('ensureUsersSchema notice:', (err as any)?.message);
  }
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${PASSWORD_PREFIX}$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  try {
    const [prefix, salt, hash] = storedHash.split('$');
    if (prefix !== PASSWORD_PREFIX || !salt || !hash) return false;

    const expected = Buffer.from(hash, 'hex');
    const actual = scryptSync(password, salt, 64);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export async function getUserByLogin(name: string) {
  const trimmedName = name.trim();
  if (!trimmedName) return null;
  await ensureUsersSchema();

  try {
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(sql`lower(${users.name}) = lower(${trimmedName})`)
      .limit(1);

    if (rows[0]) return rows[0];
  } catch (err: any) {
    console.warn('getUserByLogin query error, attempting fallback:', err?.message);
    try {
      const rows = await db
        .select({
          id: users.id,
          name: users.name,
        })
        .from(users)
        .where(sql`lower(${users.name}) = lower(${trimmedName})`)
        .limit(1);

      if (rows[0]) {
        return { id: rows[0].id, name: rows[0].name, passwordHash: null };
      }
    } catch (fallbackErr: any) {
      console.warn('getUserByLogin fallback query failed:', fallbackErr?.message);
    }
  }

  return null;
}

export async function createRegisteredUser(name: string, password?: string) {
  const trimmedName = name.trim();
  if (!trimmedName) return null;
  await ensureUsersSchema();
  const passwordHash = password && password.trim() ? hashPassword(password.trim()) : null;

  try {
    if (passwordHash) {
      const rows = await db
        .insert(users)
        .values({ name: trimmedName, passwordHash })
        .returning({ id: users.id, name: users.name, passwordHash: users.passwordHash });
      if (rows[0]) return rows[0];
    } else {
      const rows = await db
        .insert(users)
        .values({ name: trimmedName })
        .returning({ id: users.id, name: users.name });
      if (rows[0]) return { id: rows[0].id, name: rows[0].name, passwordHash: null };
    }
  } catch (err: any) {
    console.warn('createRegisteredUser insert notice:', err?.message);
    const existing = await getUserByLogin(trimmedName);
    if (existing) return existing;
    throw err;
  }

  return null;
}

export async function setPasswordForUser(userId: number, password: string) {
  await ensureUsersSchema();
  const passwordHash = hashPassword(password);
  try {
    await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
  } catch (err: any) {
    console.warn('setPasswordForUser error:', err?.message);
  }
}

export function setUserSession(user: UserSession, response?: NextResponse) {
  const cookieOptions = {
    httpOnly: false, // Allow client-side access
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  };

  if (response) {
    response.cookies.set('user-id', String(user.userId), cookieOptions);
    response.cookies.set('user-name', user.name, cookieOptions);
  }

  try {
    const cookieStore = cookies();
    cookieStore.set('user-id', String(user.userId), cookieOptions);
    cookieStore.set('user-name', user.name, cookieOptions);
  } catch {
    // Handled via response cookies
  }
}

export async function getCurrentUser(): Promise<UserSession | null> {
  const cookieStore = cookies();
  const userIdStr = cookieStore.get('user-id')?.value;
  const userName = cookieStore.get('user-name')?.value;
  const userId = Number(userIdStr);

  if (Number.isFinite(userId) && userId > 0) {
    try {
      const user = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
        .then((rows) => rows[0] || null);

      if (user) return { name: user.name, userId: user.id };
    } catch {
      // fallback to userName check
    }
  }

  if (userName) {
    try {
      const user = await getUserByLogin(userName);
      if (user) return { name: user.name, userId: user.id };
    } catch {}
  }

  return null;
}

export function clearUserSession(response?: NextResponse) {
  if (response) {
    response.cookies.delete('user-id');
    response.cookies.delete('user-name');
  }
  try {
    const cookieStore = cookies();
    cookieStore.delete('user-id');
    cookieStore.delete('user-name');
  } catch {}
}
