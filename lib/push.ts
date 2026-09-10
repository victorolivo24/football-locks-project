import webpush from 'web-push';
import { db } from './db';
import { pushSubscriptions } from './db/schema';
import { eq, inArray } from 'drizzle-orm';

/** Which alert a message belongs to, matching the per-device preferences. */
export type AlertKind = 'gameStart' | 'gameFinal' | 'rivalBust' | 'rivalHit' | 'lockReminder';

export interface PushMessage {
  userId: number;
  kind: AlertKind;
  title: string;
  body: string;
  /** Where tapping the notification lands, usually the live gameday view. */
  url: string;
  /** Collapses repeats of the same event into one notification. */
  tag?: string;
}

let configured = false;

function configure(): boolean {
  if (configured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:nobody@example.com',
    publicKey,
    privateKey
  );
  configured = true;
  return true;
}

/**
 * Deliver a batch of alerts.
 *
 * Each device keeps its own preferences, so the same message can reach
 * someone's phone and not their laptop. Subscriptions the browser has
 * abandoned come back as 404/410 and are deleted rather than retried forever.
 */
export interface SendResult {
  sent: number;
  /** Why deliveries failed, so a test send can say something useful. */
  errors: Array<{ status?: number; detail: string }>;
  configured: boolean;
}

export async function sendAlerts(messages: PushMessage[]): Promise<SendResult> {
  if (messages.length === 0) return { sent: 0, errors: [], configured: true };
  if (!configure()) {
    return {
      sent: 0,
      errors: [{ detail: 'Server is missing VAPID keys, so nothing can be sent.' }],
      configured: false,
    };
  }

  const userIds = Array.from(new Set(messages.map(m => m.userId)));
  const subscriptions = await db.query.pushSubscriptions.findMany({
    where: inArray(pushSubscriptions.userId, userIds),
  });
  if (subscriptions.length === 0) {
    return {
      sent: 0,
      errors: [{ detail: 'No device is registered for this account.' }],
      configured: true,
    };
  }

  const stale: string[] = [];
  const errors: SendResult['errors'] = [];
  let delivered = 0;

  await Promise.all(subscriptions.flatMap((subscription) =>
    messages
      .filter(message => message.userId === subscription.userId && subscription[message.kind])
      .map(async (message) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            JSON.stringify({
              title: message.title,
              body: message.body,
              url: message.url,
              tag: message.tag,
            })
          );
          delivered++;
        } catch (error: any) {
          const status = error?.statusCode;
          const detail = String(error?.body ?? error?.message ?? 'unknown').slice(0, 200);

          // A subscription the browser has abandoned is worth dropping, but say
          // so — silently deleting made a broken setup look like a no-op.
          if (status === 404 || status === 410) stale.push(subscription.endpoint);

          errors.push({ status, detail });
          console.error('Push send failed:', status, detail);
        }
      })
  ));

  if (stale.length > 0) {
    console.error(`Dropping ${stale.length} expired push subscription(s).`);
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, stale));
  }

  return { sent: delivered, errors, configured: true };
}

export async function removeSubscription(endpoint: string) {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}
