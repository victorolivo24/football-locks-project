import { cookies } from 'next/headers';

export interface UserSession {
  name: string;
  userId: number;
}

// Simple user lookup - no passwords needed
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

export function setUserSession(name: string) {
  const cookieStore = cookies();
  cookieStore.set('user-name', name, {
    httpOnly: false, // Allow client-side access
    secure: false, // Don't require HTTPS for local testing
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });
}

export function getCurrentUser(): UserSession | null {
  const cookieStore = cookies();
  const userName = cookieStore.get('user-name')?.value;

  if (!userName) {
    return null;
  }

  return getUserByName(userName);
}

export function clearUserSession() {
  const cookieStore = cookies();
  cookieStore.delete('user-name');
}
