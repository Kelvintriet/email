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
    receivedAt: v.number(),
    read: v.boolean(),
  }).index("by_to", ["to"]),
});
