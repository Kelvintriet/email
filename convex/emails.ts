import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { query, mutation, internalMutation, internalQuery, internalAction } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Resend } from "resend";

const attachmentValidator = v.object({
  storageId: v.id("_storage"),
  name: v.string(),
  mimeType: v.string(),
  size: v.number(),
});

async function getCurrentUserEmail(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    return null;
  }

  const user = await ctx.db.get(userId);
  return user?.email ?? null;
}

async function requireCurrentUserEmail(ctx: QueryCtx | MutationCtx) {
  const userEmail = await getCurrentUserEmail(ctx);
  if (!userEmail) {
    throw new Error("Unauthenticated");
  }

  return userEmail;
}

// Returns the authenticated user's emails for a specific folder
export const list = query({
  args: { folder: v.optional(v.string()) }, // "inbox", "sent", "spam"
  handler: async (ctx, { folder }) => {
    const userEmail = await getCurrentUserEmail(ctx);
    if (!userEmail) return [];
    
    const targetFolder = folder || "inbox";
    
    if (targetFolder === "sent" || targetFolder === "scheduled") {
      return await ctx.db
        .query("emails")
        .withIndex("by_from", (q) => q.eq("from", userEmail))
        .filter((q) => q.eq(q.field("folder"), targetFolder))
        .order("desc")
        .collect();
    } else {
      // Inbox and spam are based on 'to' field
      return await ctx.db
        .query("emails")
        .withIndex("by_to", (q) => q.eq("to", userEmail))
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
    const userEmail = await getCurrentUserEmail(ctx);
    if (!userEmail) return [];
    const email = await ctx.db.get(id);
    if (!email || email.to !== userEmail) return [];
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
    const userEmail = await requireCurrentUserEmail(ctx);
    
    return await ctx.db.insert("emails", {
      ...args,
      from: userEmail,
      folder: "sent",
      receivedAt: Date.now(),
      read: true,
    });
  },
});

export const moveToFolder = mutation({
  args: { id: v.id("emails"), folder: v.string() },
  handler: async (ctx, { id, folder }) => {
    const userEmail = await requireCurrentUserEmail(ctx);
    const email = await ctx.db.get(id);
    if (!email || (email.to !== userEmail && email.from !== userEmail)) throw new Error("Not found");

    await ctx.db.patch(id, {
      folder: folder === "inbox" ? undefined : folder,
      deletedAt: folder === "trash" ? Date.now() : undefined,
    });
  },
});

export const markSenderAsSpam = mutation({
  args: { senderEmail: v.string() },
  handler: async (ctx, { senderEmail }) => {
    const userEmail = await requireCurrentUserEmail(ctx);

    // Add to spamSenders list if not already there
    const existing = await ctx.db
      .query("spamSenders")
      .withIndex("by_user_sender", (q) => q.eq("userEmail", userEmail).eq("senderEmail", senderEmail))
      .first();
      
    if (!existing) {
      await ctx.db.insert("spamSenders", {
        userEmail,
        senderEmail,
      });
    }

    // Move all existing emails from this sender to spam
    const existingEmails = await ctx.db
      .query("emails")
      .withIndex("by_to", (q) => q.eq("to", userEmail))
      .filter((q) => q.eq(q.field("from"), senderEmail))
      .collect();

    for (const email of existingEmails) {
       await ctx.db.patch(email._id, { folder: "spam" });
    }
  },
});

export const unmarkSenderAsSpam = mutation({
  args: { senderEmail: v.string() },
  handler: async (ctx, { senderEmail }) => {
    const userEmail = await requireCurrentUserEmail(ctx);

    const existing = await ctx.db
      .query("spamSenders")
      .withIndex("by_user_sender", (q) => q.eq("userEmail", userEmail).eq("senderEmail", senderEmail))
      .first();
      
    if (existing) {
      await ctx.db.delete(existing._id);
    }

    // Move all existing emails from this sender back to inbox
    const existingEmails = await ctx.db
      .query("emails")
      .withIndex("by_to", (q) => q.eq("to", userEmail))
      .filter((q) => q.eq(q.field("from"), senderEmail))
      .collect();

    for (const email of existingEmails) {
      if (email.folder === "spam") {
        await ctx.db.patch(email._id, { folder: undefined });
      }
    }
  },
});

// Returns all emails in the same thread (sorted oldest-first for conversation view)
export const listThread = query({
  args: { threadId: v.string() },
  handler: async (ctx, { threadId }) => {
    const userEmail = await getCurrentUserEmail(ctx);
    if (!userEmail) return [];
    return await ctx.db
      .query("emails")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .filter((q) => q.or(q.eq(q.field("to"), userEmail), q.eq(q.field("from"), userEmail)))
      .order("asc")
      .collect();
  },
});

export const markRead = mutation({
  args: { id: v.id("emails") },
  handler: async (ctx, { id }) => {
    const userEmail = await requireCurrentUserEmail(ctx);
    const email = await ctx.db.get(id);
    if (!email || email.to !== userEmail) throw new Error("Not found");
    await ctx.db.patch(id, { read: true });
  },
});

export const markUnread = mutation({
  args: { id: v.id("emails") },
  handler: async (ctx, { id }) => {
    const userEmail = await requireCurrentUserEmail(ctx);
    const email = await ctx.db.get(id);
    if (!email || email.to !== userEmail) throw new Error("Not found");
    await ctx.db.patch(id, { read: false });
  },
});


export const getBlockedSenders = query({
  args: {},
  handler: async (ctx) => {
    const userEmail = await getCurrentUserEmail(ctx);
    if (!userEmail) return [];
    
    const senders = await ctx.db
      .query("spamSenders")
      .withIndex("by_user_sender", (q) => q.eq("userEmail", userEmail))
      .collect();
      
    return senders.map(s => s.senderEmail);
  },
});

export const getScheduledEmailForSend = internalQuery({
  args: { emailId: v.id("emails") },
  handler: async (ctx, { emailId }) => {
    return await ctx.db.get(emailId);
  }
});

export const updateToSent = internalMutation({
  args: { emailId: v.id("emails") },
  handler: async (ctx, { emailId }) => {
    await ctx.db.patch(emailId, { folder: "sent", scheduledAt: undefined });
  }
});

export const sendScheduledEmailAction = internalAction({
  args: { emailId: v.id("emails") },
  handler: async (ctx, { emailId }) => {
    const email = await ctx.runQuery(internal.emails.getScheduledEmailForSend, { emailId });
    if (!email || email.folder !== "scheduled") return; // cancelled or already sent

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: email.from,
      to: email.to,
      subject: email.subject,
      html: email.htmlBody || email.body,
      ...(email.inReplyTo ? {
        headers: {
          "In-Reply-To": `<${email.inReplyTo}>`,
          "References": `<${email.inReplyTo}>`,
        }
      } : {})
    });

    if (error) {
      throw new Error(`Resend error: ${error.message}`);
    }
    await ctx.runMutation(internal.emails.updateToSent, { emailId });
  }
});

export const saveScheduled = mutation({
  args: {
    from: v.string(),
    to: v.string(),
    subject: v.string(),
    body: v.string(),
    htmlBody: v.optional(v.string()),
    inReplyTo: v.optional(v.string()),
    scheduledAt: v.number()
  },
  handler: async (ctx, args) => {
    const userEmail = await requireCurrentUserEmail(ctx);
    
    const emailId = await ctx.db.insert("emails", {
      ...args,
      from: userEmail,
      folder: "scheduled",
      receivedAt: Date.now(),
      read: true,
    });
    
    await ctx.scheduler.runAt(args.scheduledAt, internal.emails.sendScheduledEmailAction, { emailId });
    return emailId;
  },
});

export const permanentlyDeleteTrash = internalMutation({
  args: {},
  handler: async (ctx) => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const trashedEmails = await ctx.db
      .query("emails")
      .filter((q) => q.eq(q.field("folder"), "trash"))
      .collect();

    for (const email of trashedEmails) {
      const deletedAt = email.deletedAt ?? email.receivedAt;
      if (deletedAt < thirtyDaysAgo) {
        await ctx.db.delete(email._id);
      }
    }
  },
});

export const listPaginated = query({
  args: { folder: v.optional(v.string()), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { folder, paginationOpts }) => {
    const userEmail = await getCurrentUserEmail(ctx);
    if (!userEmail) return { page: [], isDone: true, continueCursor: "" };
    
    const targetFolder = folder || "inbox";
    
    if (targetFolder === "sent" || targetFolder === "scheduled") {
      return await ctx.db
        .query("emails")
        .withIndex("by_from", (q) => q.eq("from", userEmail))
        .filter((q) => q.eq(q.field("folder"), targetFolder))
        .order("desc")
        .paginate(paginationOpts);
    } else {
      return await ctx.db
        .query("emails")
        .withIndex("by_to", (q) => q.eq("to", userEmail))
        .filter((q) => q.eq(q.field("folder"), targetFolder === "inbox" ? undefined : targetFolder))
        .order("desc")
        .paginate(paginationOpts);
    }
  },
});

export const search = query({
  args: { query: v.string(), folder: v.optional(v.string()) },
  handler: async (ctx, { query, folder }) => {
    const userEmail = await getCurrentUserEmail(ctx);
    if (!userEmail) return [];
    const targetFolder = folder || "inbox";

    const subjectResults = await ctx.db
      .query("emails")
      .withSearchIndex("search_subject", (q) => q.search("subject", query))
      .take(20);
      
    const bodyResults = await ctx.db
      .query("emails")
      .withSearchIndex("search_body", (q) => q.search("body", query))
      .take(20);

    const merged = [...subjectResults, ...bodyResults];
    const unique = Array.from(new Map(merged.map(e => [e._id, e])).values());

    return unique.filter((e) => {
      const isAuth = targetFolder === "sent" || targetFolder === "scheduled" ? e.from === userEmail : e.to === userEmail;
      const isFolder = e.folder === (targetFolder === "inbox" ? undefined : targetFolder);
      return isAuth && isFolder;
    });
  },
});

export const bulkMoveToFolder = mutation({
  args: { ids: v.array(v.id("emails")), folder: v.string() },
  handler: async (ctx, { ids, folder }) => {
    const userEmail = await requireCurrentUserEmail(ctx);
    for (const id of ids) {
      const email = await ctx.db.get(id);
      if (email && (email.to === userEmail || email.from === userEmail)) {
        await ctx.db.patch(id, {
          folder: folder === "inbox" ? undefined : folder,
          deletedAt: folder === "trash" ? Date.now() : undefined,
        });
      }
    }
  },
});

export const bulkMarkRead = mutation({
  args: { ids: v.array(v.id("emails")), read: v.boolean() },
  handler: async (ctx, { ids, read }) => {
    const userEmail = await requireCurrentUserEmail(ctx);
    for (const id of ids) {
      const email = await ctx.db.get(id);
      if (email && email.to === userEmail) {
        await ctx.db.patch(id, { read });
      }
    }
  },
});

export const deletePermanently = mutation({
  args: { id: v.id("emails") },
  handler: async (ctx, { id }) => {
    const userEmail = await requireCurrentUserEmail(ctx);
    const email = await ctx.db.get(id);
    if (!email || (email.to !== userEmail && email.from !== userEmail)) {
      throw new Error("Not found");
    }
    if (email.folder !== "trash") {
      throw new Error("Email must be in trash before permanent delete");
    }
    await ctx.db.delete(id);
  },
});

export const bulkDeletePermanently = mutation({
  args: { ids: v.array(v.id("emails")) },
  handler: async (ctx, { ids }) => {
    const userEmail = await requireCurrentUserEmail(ctx);
    for (const id of ids) {
      const email = await ctx.db.get(id);
      if (email && (email.to === userEmail || email.from === userEmail) && email.folder === "trash") {
        await ctx.db.delete(id);
      }
    }
  },
});

export const markOpened = mutation({
  args: { id: v.id("emails") },
  handler: async (ctx, { id }) => {
    const email = await ctx.db.get(id);
    if (email && !email.openedAt) {
      await ctx.db.patch(id, { openedAt: Date.now() });
    }
  },
});

export const saveDraft = mutation({
  args: {
    id: v.optional(v.id("emails")),
    to: v.string(),
    subject: v.string(),
    body: v.string(),
    htmlBody: v.optional(v.string()),
    inReplyTo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userEmail = await requireCurrentUserEmail(ctx);
    const { id, ...draftFields } = args;
    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (existing && existing.from === userEmail) {
         await ctx.db.patch(args.id, { ...draftFields, receivedAt: Date.now() });
         return args.id;
      }
    }
    
    return await ctx.db.insert("emails", {
      ...draftFields,
      from: userEmail,
      folder: "drafts",
      receivedAt: Date.now(),
      read: true,
    });
  }
});

export const deleteDraft = mutation({
  args: { id: v.id("emails") },
  handler: async (ctx, { id }) => {
    const userEmail = await requireCurrentUserEmail(ctx);
    const email = await ctx.db.get(id);
    if (!email || email.from !== userEmail || email.folder !== "drafts") {
      throw new Error("Not found");
    }
    await ctx.db.delete(id);
  },
});
