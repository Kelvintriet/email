/**
 * Cloudflare Email Worker — postal-mime edition
 *
 * Requires Wrangler + postal-mime:
 *   cd cloudflare && npm install postal-mime && npx wrangler deploy
 *
 * Environment variables (set in Cloudflare dashboard or wrangler.toml / .env):
 *   CONVEX_SITE_URL   — e.g. https://lucky-fox-123.convex.site
 *   WEBHOOK_SECRET    — must match WEBHOOK_SECRET env var in Convex
 */
import PostalMime from "postal-mime";

export default {
  async fetch(request, env, ctx) {
    return new Response("KoolMail Worker is active! 🚀\n\nI'm designed to process emails, not webpages, but I'm alive and well.", {
      headers: { "Content-Type": "text/plain" },
    });
  },
  async email(message, env, _ctx) {
    // ── 1. Parse the full raw email with postal-mime ──────────────────────
    const rawBuffer = await new Response(message.raw).arrayBuffer();
    const parsed = await new PostalMime().parse(rawBuffer);

    const from = parsed.from?.address ?? message.from;
    const to =
      parsed.to?.[0]?.address ?? message.to;
    const subject = parsed.subject ?? "(no subject)";
    const body = parsed.text?.trim() ?? "";
    const htmlBody = parsed.html ?? undefined;

    // Extract Message-ID for reply threading (strip angle brackets)
    const messageId = parsed.headers
      .find((h) => h.key.toLowerCase() === "message-id")
      ?.value?.replace(/[<>]/g, "")
      .trim();

    // Extract In-Reply-To and References for thread grouping
    const inReplyTo = parsed.headers
      .find((h) => h.key.toLowerCase() === "in-reply-to")
      ?.value?.replace(/[<>]/g, "")
      .trim();

    // threadId: use the oldest ancestor (first entry in References), fall back to
    // inReplyTo, then the email's own messageId — so all messages in a chain share one ID.
    const referencesHeader = parsed.headers
      .find((h) => h.key.toLowerCase() === "references")
      ?.value;
    const firstReference = referencesHeader
      ? referencesHeader.split(/\s+/)[0]?.replace(/[<>]/g, "").trim()
      : undefined;
    const threadId = firstReference || inReplyTo || messageId;

    const baseUrl = env.CONVEX_SITE_URL.replace(/\/$/, "");
    const headers = {
      "Content-Type": "application/json",
      "x-webhook-secret": env.WEBHOOK_SECRET,
    };

    // ── 2. Upload each attachment to Convex Storage ───────────────────────
    const savedAttachments = [];

    for (const att of parsed.attachments ?? []) {
      // Step A: get a one-time upload URL from Convex
      const urlRes = await fetch(`${baseUrl}/api/email/upload-url`, {
        method: "POST",
        headers,
        body: JSON.stringify({ contentType: att.mimeType }),
      });
      if (!urlRes.ok) {
        console.error("upload-url failed", urlRes.status, await urlRes.text());
        continue;
      }
      const { url: uploadUrl } = await urlRes.json();

      // Step B: PUT the binary directly to the Convex Storage upload URL
      const putRes = await fetch(uploadUrl, {
        method: "POST", // Convex storage uses POST for presigned uploads
        headers: { "Content-Type": att.mimeType ?? "application/octet-stream" },
        body: att.content, // ArrayBuffer from postal-mime
      });
      if (!putRes.ok) {
        console.error("attachment PUT failed", putRes.status, await putRes.text());
        continue;
      }
      const { storageId } = await putRes.json();

      savedAttachments.push({
        storageId,
        name: att.filename ?? "attachment",
        mimeType: att.mimeType ?? "application/octet-stream",
        size: att.content.byteLength,
      });
    }

    // ── 3. Save email metadata to Convex ─────────────────────────────────
    const ingestRes = await fetch(`${baseUrl}/api/email/ingest`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        from,
        to,
        subject,
        body: body || "(empty)",
        htmlBody,
        messageId,
        inReplyTo,
        threadId,
        attachments: savedAttachments.length ? savedAttachments : undefined,
      }),
    });

    if (!ingestRes.ok) {
      const text = await ingestRes.text();
      throw new Error(`Ingest failed ${ingestRes.status}: ${text}`);
    }
  },
};
