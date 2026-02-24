/**
 * Send a notification via Pushover (https://pushover.net).
 * Requires PUSHOVER_API_TOKEN and PUSHOVER_GROUP_KEY (or PUSHOVER_USER_KEY) in env.
 */

const PUSHOVER_API = 'https://api.pushover.net/1/messages.json';

export type PushoverOptions = {
  title?: string;
};

/**
 * Sends a Pushover notification. No-op if env vars are not set.
 * Uses PUSHOVER_GROUP_KEY if set, otherwise PUSHOVER_USER_KEY.
 */
export async function sendPushoverNotification(
  message: string,
  options: PushoverOptions = {}
): Promise<boolean> {
  const token = process.env.PUSHOVER_API_TOKEN;
  const user = process.env.PUSHOVER_GROUP_KEY ?? process.env.PUSHOVER_USER_KEY;

  if (!token || !user) {
    return false;
  }

  try {
    const body = new URLSearchParams({
      token,
      user,
      message: message.slice(0, 1024), // API limit
      ...(options.title && { title: options.title.slice(0, 250) }),
    });

    const res = await fetch(PUSHOVER_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Pushover API error:', res.status, text);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Pushover send failed:', err);
    return false;
  }
}
