import webpush from 'web-push';
import { db } from './db';
import { pushSubscriptions } from './db/schema';
import { eq, inArray } from 'drizzle-orm';

/** Which alert a message belongs to, matching the per-device preferences. */
export type AlertKind = 'gameStart' | 'gameFinal' | 'rivalBust' | 'rivalHit';

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
export async function sendAlerts(messages: PushMessage[]): Promise<number> {
  if (messages.length === 0 || !configure()) return 0;

  const userIds = Array.from(new Set(messages.map(m => m.userId)));
  const subscriptions = await db.query.pushSubscriptions.findMany({
    where: inArray(pushSubscriptions.userId, userIds),
  });
  if (subscriptions.length === 0) return 0;

  const stale: string[] = [];
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
          if (status === 404 || status === 410) stale.push(subscription.endpoint);
          else console.error('Push send failed:', status, error?.body ?? error?.message);
        }
      })
  ));

  if (stale.length > 0) {
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, stale));
  }

  return delivered;
}

export async function removeSubscription(endpoint: string) {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}
