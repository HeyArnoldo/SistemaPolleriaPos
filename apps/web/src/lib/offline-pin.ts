import bcrypt from 'bcryptjs';
import { db } from './db';
import type { StoredOfflineSession } from './db';

export type { StoredOfflineSession };

export async function saveOfflinePin(
  user: { id: number; role: string; username: string; profile?: { firstName?: string } },
  pin: string,
): Promise<void> {
  const pinHash = await bcrypt.hash(pin, 4);
  await db.offlineSession.clear();
  await db.offlineSession.add({
    userId: user.id,
    role: user.role,
    username: user.username,
    displayName: user.profile?.firstName ?? user.username,
    pinHash,
  });
}

export async function getStoredOfflineSession(): Promise<StoredOfflineSession | undefined> {
  return db.offlineSession.toCollection().first();
}

export async function verifyOfflinePin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

export async function clearOfflinePin(): Promise<void> {
  await db.offlineSession.clear();
}
