import { httpRouter, httpActionGeneric as httpAction } from "convex/server";
import { internal } from "./_generated/api";
import { ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

function checkSecret(req: Request): boolean {
  const secret = req.headers.get("x-webhook-secret");
  return !!secret && secret === process.env.WEBHOOK_SECRET;
}

/**
 * POST /api/email/upload-url
 * Called by the Cloudflare Worker once per attachment.
 * Returns a short-lived Convex Storage upload URL.
 * Body: { contentType: string }
 */
http.route({
  path: "/api/email/upload-url",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!checkSecret(req)) {
      return new Response("Unauthorized", { status: 401 });
    }
    const uploadUrl = await ctx.storage.generateUploadUrl();
    return new Response(JSON.stringify({ url: uploadUrl }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

/**
 * POST /api/email/ingest
 * Called by the Cloudflare Worker after attachments are uploaded.
 * Body: {
 *   from, to, subject, body, htmlBody?,
 *   messageId?,
 *   attachments?: [{ storageId, name, mimeType, size }]
 * }
 */
http.route({
  path: "/api/email/ingest",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!checkSecret(req)) {
      return new Response("Unauthorized", { status: 401 });
    }
    let data: {
      from?: string;
      to?: string;
      subject?: string;
      body?: string;
      htmlBody?: string;
      messageId?: string;
      inReplyTo?: string;
      threadId?: string;
      attachments?: { storageId: string; name: string; mimeType: string; size: number }[];
    };
    try {
      data = await req.json();
    } catch {
      return new Response("Bad JSON", { status: 400 });
    }
    const { from, to, subject, body, htmlBody, messageId, inReplyTo, threadId, attachments } = data;
    if (!from || !to || !subject || !body) {
      return new Response("Missing required fields", { status: 400 });
    }
    try {
      await ctx.runMutation(internal.emails.saveFromWorker, {
        from,
        to,
        subject,
        body,
        htmlBody,
        messageId,
        inReplyTo,
        threadId,
        attachments: attachments as { storageId: Id<"_storage">; name: string; mimeType: string; size: number }[] | undefined,
      });
    } catch (e) {
      if (e instanceof ConvexError) {
        return new Response(e.message, { status: 422 });
      }
      throw e;
    }
    return new Response("OK", { status: 200 });
  }),
});

export default http;
