import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Returns only the authenticated user's emails
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const user = await ctx.db.get(userId);
    if (!user?.email) return [];
    return await ctx.db
      .query("emails")
      .withIndex("by_to", (q) => q.eq("to", user.email!))
      .order("desc")
      .collect();
  },
});

// Called server-side by the webhook API route (no auth context)
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
