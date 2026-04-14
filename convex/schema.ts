import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,
  emails: defineTable({
    from: v.string(),
    to: v.string(),
    subject: v.string(),
    body: v.string(),
    htmlBody: v.optional(v.string()),
    receivedAt: v.number(),
    read: v.boolean(),
    // Threading
    messageId: v.optional(v.string()),
    inReplyTo: v.optional(v.string()),
    threadId: v.optional(v.string()),
    folder: v.optional(v.string()), // "inbox" | "sent" | "spam" | "scheduled"
    deletedAt: v.optional(v.number()),
    scheduledAt: v.optional(v.number()),
    openedAt: v.optional(v.number()),
    // Attachments stored in Convex Storage
    attachments: v.optional(v.array(v.object({
      storageId: v.id("_storage"),
      name: v.string(),
      mimeType: v.string(),
      size: v.number(),
    }))),
  }).index("by_to", ["to"]).index("by_thread", ["threadId"]).index("by_from", ["from"])
    .searchIndex("search_body", { searchField: "body" })
    .searchIndex("search_subject", { searchField: "subject" }),
  
  spamSenders: defineTable({
    userEmail: v.string(),
    senderEmail: v.string(),
  }).index("by_user_sender", ["userEmail", "senderEmail"]),
});
