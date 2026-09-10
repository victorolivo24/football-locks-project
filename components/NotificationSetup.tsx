'use client';

import { useEffect, useState } from 'react';

type Prefs = {
  gameStart: boolean;
  gameFinal: boolean;
  rivalBust: boolean;
  rivalHit: boolean;
};

const DEFAULTS: Prefs = { gameStart: true, gameFinal: true, rivalBust: true, rivalHit: false };

const ALERTS: Array<{ key: keyof Prefs; label: string; detail: string }> = [
  { key: 'gameStart', label: 'A game I locked kicks off', detail: 'Only games you actually picked' },
  { key: 'gameFinal', label: 'A game I locked finishes', detail: 'Whether your lock hit or lost' },
  { key: 'rivalBust', label: 'Someone else busts', detail: 'The moment a rival loses a lock' },
  { key: 'rivalHit', label: "Someone else's lock hits", detail: 'Chatty — one per rival, per game' },
];

/** base64url VAPID key to the ArrayBuffer the Push API wants. */
function decodeKey(base64: string): ArrayBuffer {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

/** iOS only allows web push once the site is installed to the Home Screen. */
function isIos() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}

export default function NotificationSetup() {
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [needsInstall, setNeedsInstall] = useState(false);

  useEffect(() => {
    const ok = 'serviceWorker' in navigator && 'PushManager' in window;
    setSupported(ok);
    setNeedsInstall(isIos() && !isStandalone());
    if (!ok) return;

    (async () => {
      const registration = await navigator.serviceWorker.register('/sw.js').catch(() => null);
      const existing = await registration?.pushManager.getSubscription();
      if (!existing) return;

      const res = await fetch(`/api/push/preferences?endpoint=${encodeURIComponent(existing.endpoint)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.subscribed) {
        setSubscribed(true);
        setPrefs(data.preferences);
      }
    })();
  }, []);

  const save = async (next: Prefs) => {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeKey(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''),
      });
    }

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription, preferences: next }),
    });
    return res.ok;
  };

  const enable = async () => {
    setBusy(true);
    setNote('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setNote(
          permission === 'denied'
            ? 'Your browser is blocking notifications for this site. Allow them in site settings, then try again.'
            : 'Notifications were not enabled.'
        );
        return;
      }
      if (await save(prefs)) {
        setSubscribed(true);
        setNote('Done. Sending a test alert now.');
        await fetch('/api/push/preferences', { method: 'POST' });
      } else {
        setNote('Could not save. Try again.');
      }
    } catch (error: any) {
      setNote(error?.message ?? 'Something went wrong enabling notifications.');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setSubscribed(false);
      setNote('Notifications turned off on this device.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (key: keyof Prefs) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    if (subscribed) await save(next);
  };

  if (!supported && !needsInstall) return null;

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center space-x-2">
            <span className="text-xl">🔔</span>
            <h3 className="text-white font-bold text-lg">Notifications</h3>
          </div>
          <p className="text-xs text-green-200/80 mt-0.5">
            {subscribed
              ? 'On for this device. Alerts open the live gameday screen.'
              : 'Know the second someone busts, without opening the app.'}
          </p>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="text-xs font-bold text-yellow-300 bg-yellow-400/10 hover:bg-yellow-400/20 border border-yellow-400/30 px-3 py-1.5 rounded-lg transition-colors shrink-0"
        >
          {open ? 'Close' : subscribed ? 'Settings' : 'Set up'}
        </button>
      </div>

      {open && (
        <div className="space-y-4">
          {needsInstall && (
            <div className="bg-black/30 border border-yellow-400/30 rounded-xl p-4 space-y-2">
              <div className="text-sm font-bold text-yellow-300">One step first, on iPhone</div>
              <p className="text-xs text-green-200/80">
                Apple only allows notifications once the site is on your Home Screen. Takes about ten seconds:
              </p>
              <ol className="text-xs text-white/85 space-y-1.5 list-decimal list-inside">
                <li>Tap the <strong>Share</strong> button at the bottom of Safari (the square with an arrow)</li>
                <li>Scroll down and tap <strong>Add to Home Screen</strong></li>
                <li>Tap <strong>Add</strong> in the top right</li>
                <li>Open <strong>NFL Locks</strong> from your Home Screen and come back here</li>
              </ol>
              <p className="text-[11px] text-white/50">
                Must be Safari — Chrome on iPhone cannot do this.
              </p>
            </div>
          )}

          <div className="space-y-2">
            {ALERTS.map(({ key, label, detail }) => (
              <button
                key={key}
                onClick={() => toggle(key)}
                className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl border text-left transition-colors ${
                  prefs[key]
                    ? 'bg-yellow-500/15 border-yellow-400/40'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-white truncate">{label}</span>
                  <span className="block text-[11px] text-green-200/70">{detail}</span>
                </span>
                <span
                  className={`shrink-0 w-10 h-6 rounded-full flex items-center px-0.5 transition-colors ${
                    prefs[key] ? 'bg-yellow-400 justify-end' : 'bg-white/20 justify-start'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow" />
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {subscribed ? (
              <button
                onClick={disable}
                disabled={busy}
                className="text-xs font-semibold text-red-200 bg-red-500/10 hover:bg-red-500/20 border border-red-400/30 px-3 py-2 rounded-lg disabled:opacity-50"
              >
                Turn off on this device
              </button>
            ) : (
              <button
                onClick={enable}
                disabled={busy || needsInstall}
                className="text-sm font-bold text-black bg-gradient-to-r from-yellow-500 to-amber-400 hover:from-yellow-400 px-4 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy ? 'Enabling…' : needsInstall ? 'Add to Home Screen first' : 'Turn on notifications'}
              </button>
            )}
            {subscribed && (
              <button
                onClick={() => fetch('/api/push/preferences', { method: 'POST' })}
                className="text-xs font-semibold text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 rounded-lg"
              >
                Send test
              </button>
            )}
          </div>

          {note && <p className="text-[11px] text-green-200/80">{note}</p>}
        </div>
      )}
    </div>
  );
}
