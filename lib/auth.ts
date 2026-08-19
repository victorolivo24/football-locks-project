import { cookies } from 'next/headers';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { eq, sql } from 'drizzle-orm';
import { db } from './db';
import { users } from './db/schema';

export interface UserSession {
  name: string;
  userId: number;
}

const PASSWORD_PREFIX = 'scrypt';

// Fallback for legacy cookies if the database is unavailable.
const USER_MAP = {
  'Victor': { id: 1, name: 'Victor' },
  'Mihir': { id: 2, name: 'Mihir' },
  'Dakota': { id: 3, name: 'Dakota' },
  'Chris': { id: 4, name: 'Chris' },
  'Ryan': { id: 5, name: 'Ryan' },
  'Jihoo': { id: 6, name: 'Jihoo' },
} as const;

export type UserName = keyof typeof USER_MAP;

export function validateUserName(name: string): boolean {
  return name in USER_MAP;
}

export function getUserByName(name: string): UserSession | null {
  const user = USER_MAP[name as UserName];
  return user ? { name: user.name, userId: user.id } : null;
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${PASSWORD_PREFIX}$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [prefix, salt, hash] = storedHash.split('$');
  if (prefix !== PASSWORD_PREFIX || !salt || !hash) return false;

  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function getUserByLogin(name: string) {
  const trimmedName = name.trim();
  return db
    .select({
      id: users.id,
      name: users.name,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(sql`lower(${users.name}) = lower(${trimmedName})`)
    .limit(1)
    .then((rows) => rows[0] || null);
}

export async function createRegisteredUser(name: string, password?: string) {
  const trimmedName = name.trim();
  const passwordHash = password ? hashPassword(password) : null;

  return db
    .insert(users)
    .values({ name: trimmedName, passwordHash })
    .returning({ id: users.id, name: users.name, passwordHash: users.passwordHash })
    .then((rows) => rows[0]);
}

export async function setPasswordForUser(userId: number, password: string) {
  const passwordHash = hashPassword(password);
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

export function setUserSession(user: UserSession) {
  const cookieStore = cookies();
  cookieStore.set('user-id', String(user.userId), {
    httpOnly: false,
    secure: false,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60,
  });
  cookieStore.set('user-name', user.name, {
    httpOnly: false, // Allow client-side access
    secure: false, // Don't require HTTPS for local testing
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });
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
      // db fallback below
    }
  }

  if (userName) {
    try {
      const user = await getUserByLogin(userName);
      if (user) return { name: user.name, userId: user.id };
    } catch {
      // db fallback below
    }
    return getUserByName(userName);
  }

  return null;
}

export function clearUserSession() {
  const cookieStore = cookies();
  cookieStore.delete('user-id');
  cookieStore.delete('user-name');
}
