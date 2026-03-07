import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

const attachmentValidator = v.object({
  storageId: v.id("_storage"),
  name: v.string(),
  mimeType: v.string(),
  size: v.number(),
});

// Returns the authenticated user's emails for a specific folder
export const list = query({
  args: { folder: v.optional(v.string()) }, // "inbox", "sent", "spam"
  handler: async (ctx, { folder }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const user = await ctx.db.get(userId);
    if (!user?.email) return [];
    
    const targetFolder = folder || "inbox";
    
    if (targetFolder === "sent") {
      return await ctx.db
        .query("emails")
        .withIndex("by_from", (q) => q.eq("from", user.email!))
        .filter((q) => q.eq(q.field("folder"), "sent"))
        .order("desc")
        .collect();
    } else {
      // Inbox and spam are based on 'to' field
      return await ctx.db
        .query("emails")
        .withIndex("by_to", (q) => q.eq("to", user.email!))
        .filter((q) => q.eq(
          q.field("folder"), 
          targetFolder === "inbox" ? undefined : targetFolder // Note: old inbox emails have undefined folder
        ))
        .order("desc")
        .collect();
    }
  },
});

// Returns signed download URLs for all attachments on an email
export const getAttachmentUrls = query({
  args: { id: v.id("emails") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const user = await ctx.db.get(userId);
    const email = await ctx.db.get(id);
    if (!email || email.to !== user?.email) return [];
    if (!email.attachments?.length) return [];
    return await Promise.all(
      email.attachments.map(async (att) => ({
        name: att.name,
        mimeType: att.mimeType,
        size: att.size,
        url: await ctx.storage.getUrl(att.storageId),
      }))
    );
  },
});

// Called server-side by the old Next.js webhook (kept for backward compat)
export const save = mutation({
  args: {
    from: v.string(),
    to: v.string(),
    subject: v.string(),
    body: v.string(),
  },
  handler: async (ctx, { from, to, subject, body }) => {
    return await ctx.db.insert("emails", {
      from,
      to,
      subject,
      body,
      receivedAt: Date.now(),
      read: false,
    });
  },
});

// Called by the Convex HTTP ingest action (from Cloudflare Worker)
export const saveFromWorker = internalMutation({
  args: {
    from: v.string(),
    to: v.string(),
    subject: v.string(),
    body: v.string(),
    htmlBody: v.optional(v.string()),
    messageId: v.optional(v.string()),
    inReplyTo: v.optional(v.string()),
    threadId: v.optional(v.string()),
    attachments: v.optional(v.array(attachmentValidator)),
  },
  handler: async (ctx, args) => {
    // Check if sender is marked as spam
    const spamRecord = await ctx.db
      .query("spamSenders")
      .withIndex("by_user_sender", (q) => q.eq("userEmail", args.to).eq("senderEmail", args.from))
      .first();

    return await ctx.db.insert("emails", {
      ...args,
      folder: spamRecord ? "spam" : undefined, // undefined = inbox
      receivedAt: Date.now(),
      read: false,
    });
  },
});

// Saves an email sent by the user locally so it appears in the "Sent" folder
export const saveSent = mutation({
  args: {
    from: v.string(),
    to: v.string(),
    subject: v.string(),
    body: v.string(),
    htmlBody: v.optional(v.string()),
    inReplyTo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    
    return await ctx.db.insert("emails", {
      ...args,
      folder: "sent",
      receivedAt: Date.now(),
      read: true,
    });
  },
});

export const moveToFolder = mutation({
  args: { id: v.id("emails"), folder: v.string() },
  handler: async (ctx, { id, folder }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const user = await ctx.db.get(userId);
    const email = await ctx.db.get(id);
    if (!email || (email.to !== user?.email && email.from !== user?.email)) throw new Error("Not found");
    
    await ctx.db.patch(id, { folder: folder === "inbox" ? undefined : folder });
  },
});

export const markSenderAsSpam = mutation({
  args: { senderEmail: v.string() },
  handler: async (ctx, { senderEmail }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const user = await ctx.db.get(userId);
    if (!user?.email) throw new Error("No user email");

    // Add to spamSenders list if not already there
    const existing = await ctx.db
      .query("spamSenders")
      .withIndex("by_user_sender", (q) => q.eq("userEmail", user.email!).eq("senderEmail", senderEmail))
      .first();
      
    if (!existing) {
      await ctx.db.insert("spamSenders", {
        userEmail: user.email,
        senderEmail,
      });
    }

    // Move all existing emails from this sender to spam
    const existingEmails = await ctx.db
      .query("emails")
      .withIndex("by_to", (q) => q.eq("to", user.email!))
      .filter((q) => q.eq(q.field("from"), senderEmail))
      .collect();

    for (const email of existingEmails) {
       await ctx.db.patch(email._id, { folder: "spam" });
    }
  },
});

// Returns all emails in the same thread (sorted oldest-first for conversation view)
export const listThread = query({
  args: { threadId: v.string() },
  handler: async (ctx, { threadId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const user = await ctx.db.get(userId);
    if (!user?.email) return [];
    return await ctx.db
      .query("emails")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .filter((q) => q.eq(q.field("to"), user.email!))
      .order("asc")
      .collect();
  },
});

export const markRead = mutation({
  args: { id: v.id("emails") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");
    const user = await ctx.db.get(userId);
    const email = await ctx.db.get(id);
    if (!email || email.to !== user?.email) throw new Error("Not found");
    await ctx.db.patch(id, { read: true });
  },
});

