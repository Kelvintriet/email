import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type AttachmentPayload = {
  filename: string;
  content: string; // base64
  contentType: string;
};

export async function POST(req: NextRequest) {
  let body: {
    from?: string;
    to?: string;
    subject?: string;
    body?: string;
    inReplyTo?: string;
    attachments?: AttachmentPayload[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { from, to, subject, body: emailBody, inReplyTo, attachments } = body;
  if (!from || !to || !subject || !emailBody) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const sendOptions: Parameters<typeof resend.emails.send>[0] = {
    from,
    to,
    subject,
    html: emailBody, // the compose sends HTML now
    ...(inReplyTo && {
      headers: {
        "In-Reply-To": `<${inReplyTo}>`,
        "References": `<${inReplyTo}>`,
      },
    }),
    ...(attachments?.length && {
      attachments: attachments.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content, "base64"),
        contentType: a.contentType,
      })),
    }),
  };

  const { data, error } = await resend.emails.send(sendOptions);

  if (error) {
    console.error("Resend error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data?.id });
}
