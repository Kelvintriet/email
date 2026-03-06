import { NextRequest, NextResponse } from "next/server";
import { simpleParser } from "mailparser";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { from?: string; to?: string; raw?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { from, to, raw } = body;
  if (!from || !to || !raw) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Parse the full raw email — handles multipart, quoted-printable, base64, etc.
  const parsed = await simpleParser(raw);
  const subject = parsed.subject ?? "(no subject)";
  // Prefer plain text; fall back to HTML stripped of tags; fall back to raw snippet
  const emailBody =
    parsed.text?.trim() ||
    (typeof parsed.html === "string"
      ? parsed.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      : undefined) ||
    raw.slice(0, 500);

  // Only save if the recipient is a registered user
  const user = await convex.query(api.users.getByEmail, { email: to });
  if (!user) {
    return NextResponse.json({ message: "Recipient not registered, discarding" });
  }

  await convex.mutation(api.emails.save, { from, to, subject, body: emailBody });
  return NextResponse.json({ message: "Email saved" });
}
