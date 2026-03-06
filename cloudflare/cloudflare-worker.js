/**
 * Cloudflare Email Worker
 *
 * Deploy this worker and bind it to your Cloudflare Email Routing rule.
 * Required environment variables (set in your Worker settings):
 *   WEBHOOK_URL    — e.g. https://yourdomain.com/api/webhook/email
 *   WEBHOOK_SECRET — must match WEBHOOK_SECRET in your Next.js .env.local
 */
export default {
  async email(message, env, _ctx) {
    // Read the full raw email bytes — mailparser on the Next.js side handles
    // all multipart boundaries, quoted-printable, base64, encodings, etc.
    const rawBytes = await new Response(message.raw).arrayBuffer();
    const raw = new TextDecoder().decode(rawBytes);

    const response = await fetch(env.WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": env.WEBHOOK_SECRET,
      },
      body: JSON.stringify({
        from: message.from,
        to: message.to,
        raw, // Full raw RFC 2822 message — Next.js parses subject/body from this
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Webhook failed ${response.status}: ${text}`);
    }
  },
};
