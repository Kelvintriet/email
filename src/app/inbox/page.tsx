"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState, useRef, useCallback, useEffect } from "react";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

const DOMAIN = "koolname.asia";
const MAX_ATTACHMENT_MB = 25;

type Email = {
  _id: Id<"emails">;
  from: string;
  to: string;
  subject: string;
  body: string;
  htmlBody?: string;
  messageId?: string;
  threadId?: string;
  receivedAt: number;
  scheduledAt?: number;
  read: boolean;
  attachments?: { storageId: Id<"_storage">; name: string; mimeType: string; size: number }[];
};

type AttachmentUrl = { name: string; mimeType: string; size: number; url: string | null };
type ComposeState = { to: string; subject: string; inReplyTo?: string };

function formatBytes(b: number) {
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
}

function Icon({ path, className = "h-4 w-4" }: { path: string; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

// ── Rich Text Toolbar ─────────────────────────────────────────────────────────
// Must receive editorRef so it can focus the editor before execCommand,
// otherwise clicking a toolbar button loses the selection and nothing happens.
type RichTextToolbarProps = { editorRef: React.RefObject<HTMLDivElement | null> };
function RichTextToolbar({ editorRef }: RichTextToolbarProps) {
  function cmd(command: string, value?: string) {
    const el = editorRef.current;
    if (!el) return;
    el.focus(); // restore focus + caret before running the command
    document.execCommand(command, false, value ?? undefined);
  }
  const tools: { label: string; title: string; tw?: string; action: () => void }[] = [
    { label: "B",  title: "Bold",          tw: "font-bold",        action: () => cmd("bold") },
    { label: "I",  title: "Italic",        tw: "italic",           action: () => cmd("italic") },
    { label: "U",  title: "Underline",     tw: "underline",        action: () => cmd("underline") },
    { label: "S",  title: "Strikethrough", tw: "line-through",     action: () => cmd("strikeThrough") },
    { label: "•",  title: "Bullet list",                           action: () => cmd("insertUnorderedList") },
    { label: "1.", title: "Numbered list",                         action: () => cmd("insertOrderedList") },
    { label: "❝",  title: "Blockquote",                            action: () => cmd("formatBlock", "blockquote") },
    { label: "H2", title: "Heading 2",                             action: () => cmd("formatBlock", "h2") },
    { label: "P",  title: "Paragraph",                             action: () => cmd("formatBlock", "p") },
  ];
  return (
    <div className="flex flex-wrap gap-0.5 border-b border-zinc-100 px-3 py-2 bg-zinc-50 flex-shrink-0">
      {tools.map((t) => (
        <button key={t.label} type="button" title={t.title}
          onMouseDown={(e) => {
            e.preventDefault(); // keep editor selection intact
            t.action();
          }}
          className={"min-w-[30px] h-8 px-2 rounded-full text-xs text-zinc-600 hover:bg-[#EAE0D5]/60 hover:text-green-800 active:bg-[#EAE0D5] transition-colors select-none" + (t.tw ? " " + t.tw : "")}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Login ────────────────────────────────────────────────────────────────────
function LoginForm() {
  const { signIn } = useAuthActions();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function isValidUsername(u: string) {
    return /^[a-z0-9._-]{1,32}$/.test(u);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmed = username.trim().toLowerCase();
    if (!isValidUsername(trimmed)) {
      setError("Username can only contain letters, numbers, dots, hyphens, and underscores (max 32 chars).");
      return;
    }
    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      await signIn("password", {
        email: `${trimmed}@${DOMAIN}`,
        password,
        flow: mode === "signup" ? "signUp" : "signIn",
      });
    } catch {
      setError(
        mode === "signup"
          ? "That username is already taken. Try another."
          : "Incorrect username or password."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#EAE0D5]">
      <div className="w-full max-w-sm rounded-3xl border border-[#EAE0D5] bg-white p-8 shadow-lg shadow-green-100/60">
        {/* Logo */}
        <div className="mb-6 flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-full bg-[#41431B] flex items-center justify-center shadow-sm">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-lg font-serif font-bold text-[#20220E]">KoolMail</span>
        </div>

        <h1 className="mb-1 text-2xl font-serif font-semibold text-zinc-900">
          {mode === "signin" ? "Welcome back" : "Create account"}
        </h1>
        <p className="mb-6 text-sm text-zinc-500">
          {mode === "signin"
            ? `Sign in to your @${DOMAIN} inbox.`
            : `Pick a username — your email will be username@${DOMAIN}.`}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500 uppercase tracking-wide">
              Username
            </label>
            <div className="flex rounded-full border border-zinc-200 focus-within:border-[#5A5D24] focus-within:ring-2 focus-within:ring-[#41431B]/20 overflow-hidden transition-all">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                placeholder="yourname"
                required
                autoComplete="username"
                className="flex-1 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none bg-transparent"
              />
              <span className="flex items-center bg-zinc-50 px-3 text-sm text-zinc-400 border-l border-zinc-200 select-none">
                @{DOMAIN}
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500 uppercase tracking-wide">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters"
              required
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              className="w-full rounded-full border border-zinc-200 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#5A5D24] focus:ring-2 focus:ring-[#41431B]/20 transition-all"
            />
          </div>

          {mode === "signup" && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500 uppercase tracking-wide">
                Confirm password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                required
                autoComplete="new-password"
                className="w-full rounded-full border border-zinc-200 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#5A5D24] focus:ring-2 focus:ring-[#41431B]/20 transition-all"
              />
            </div>
          )}

          {error && (
            <p className="rounded-full bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-full rounded-full bg-[#41431B] py-2.5 text-sm font-semibold text-white hover:bg-[#20220E] disabled:opacity-50 transition-colors shadow-sm"
          >
            {loading
              ? mode === "signup" ? "Creating…" : "Signing in…"
              : mode === "signup" ? "Create account" : "Sign in"}
          </button>

          <p className="text-center text-sm text-zinc-500">
            {mode === "signin" ? (
              <>
                No account?{" "}
                <button
                  onClick={() => { setMode("signup"); setError(""); }}
                  className="font-semibold text-[#41431B] hover:text-[#20220E]"
                >
                  Create one
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  onClick={() => { setMode("signin"); setError(""); setConfirmPassword(""); }}
                  className="font-semibold text-[#41431B] hover:text-[#20220E]"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}

// ── Strip email reply chains ─────────────────────────────────────────────────
function stripReplyChain(body: string): string {
  // Find "On [date] ... wrote:" (Gmail-style) and drop everything from there
  const idx = body.search(/\nOn .+wrote:/);
  if (idx !== -1) return body.slice(0, idx).trim();
  return body.trim();
}

// ── Masked date / time inputs ───────────────────────────────────────────────
function MaskedDateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
    let out = digits.slice(0, 2);
    if (digits.length >= 3) out += "/" + digits.slice(2, 4);
    if (digits.length >= 5) out += "/" + digits.slice(4, 8);
    onChange(out);
  }
  return (
    <input
      type="text"
      inputMode="numeric"
      value={value}
      onChange={handleChange}
      placeholder="mm/dd/yyyy"
      maxLength={10}
      className="w-[92px] text-xs text-zinc-600 placeholder:text-zinc-300 px-2.5 py-1.5 focus:outline-none bg-transparent border-r border-zinc-100"
    />
  );
}

function MaskedTimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
    let out = digits.slice(0, 2);
    if (digits.length >= 3) out += ":" + digits.slice(2, 4);
    onChange(out);
  }
  return (
    <input
      type="text"
      inputMode="numeric"
      value={value}
      onChange={handleChange}
      placeholder="hh:mm"
      maxLength={5}
      className="w-[54px] text-xs text-zinc-600 placeholder:text-zinc-300 px-2 py-1.5 focus:outline-none bg-transparent"
    />
  );
}

// ── Compose Form ─────────────────────────────────────────────────────────────
type ComposeFormProps = {
  fromEmail: string;
  maximized: boolean;
  minimized: boolean;
  onToggleMaximize: () => void;
  onToggleMinimize: () => void;
  onClose: () => void;
  prefill?: ComposeState;
  /** HTML to seed the editor with — lifted from parent so it survives float↔maximize toggle */
  initialHtml?: string;
  onEditorChange: (html: string) => void;
  onScheduleSend?: (args: any) => Promise<any>;
  onDragStart?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDragMove?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: React.PointerEvent<HTMLDivElement>) => void;
};

function ComposeForm({ fromEmail, maximized, minimized, onToggleMaximize, onToggleMinimize, onClose, prefill, initialHtml, onEditorChange, onScheduleSend, onDragStart, onDragMove, onDragEnd }: ComposeFormProps) {
  const [to, setTo] = useState(prefill?.to ?? "");
  const [subject, setSubject] = useState(prefill?.subject ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error" | "scheduling">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevPrefill = useRef(prefill);

  const saveSentMutation = useMutation(api.emails.saveSent);

  // Restore saved editor content every time this component mounts (float↔maximize remounts it)
  useEffect(() => {
    if (editorRef.current && initialHtml) {
      editorRef.current.innerHTML = initialHtml;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally only on mount

  useEffect(() => {
    if (prefill && prefill !== prevPrefill.current) {
      setTo(prefill.to); setSubject(prefill.subject);
      prevPrefill.current = prefill;
    }
  }, [prefill]);

  function removeFile(i: number) { setFiles((f) => f.filter((_, j) => j !== i)); }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(e.target.files ?? []);
    const big = incoming.filter((f) => f.size > MAX_ATTACHMENT_MB * 1048576);
    if (big.length) { setErrorMsg("Files over " + MAX_ATTACHMENT_MB + " MB: " + big.map((f) => f.name).join(", ")); setStatus("error"); return; }
    setFiles((p) => [...p, ...incoming]); e.target.value = "";
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const htmlBody = editorRef.current?.innerHTML ?? "";
    if (!htmlBody || htmlBody === "<br>" || htmlBody.trim() === "") {
      setErrorMsg("Message body cannot be empty."); setStatus("error"); return;
    }
    setStatus("sending"); setErrorMsg("");
    const attachments = await Promise.all(files.map((file) =>
      new Promise<{ filename: string; content: string; contentType: string }>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve({ filename: file.name, content: (r.result as string).split(",")[1], contentType: file.type });
        r.readAsDataURL(file);
      })
    ));
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: fromEmail, to, subject, body: htmlBody, inReplyTo: prefill?.inReplyTo, attachments: attachments.length ? attachments : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send");
      
      // Save the sent email directly to Convex so it appears in the "Sent" folder
      await saveSentMutation({
        from: fromEmail,
        to,
        subject,
        body: htmlBody,
        htmlBody: htmlBody,
        inReplyTo: prefill?.inReplyTo,
      });

      setStatus("sent"); setTimeout(onClose, 1500);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error"); setStatus("error");
    }
  }

  async function handleScheduleSend(e: React.MouseEvent) {
    e.preventDefault();
    if (!scheduleDate || !scheduleTime) {
      setErrorMsg("Please fill in both date (mm/dd/yyyy) and time (hh:mm).");
      setStatus("error");
      return;
    }
    const htmlBody = editorRef.current?.innerHTML ?? "";
    if (!htmlBody || htmlBody === "<br>" || htmlBody.trim() === "") {
      setErrorMsg("Message body cannot be empty."); setStatus("error"); return;
    }
    
    // Parse date (mm/dd/yyyy) and time (hh:mm) entered by user
    const [month, day, year] = scheduleDate.split("/").map(Number);
    const [hours, minutes] = scheduleTime.split(":").map(Number);
    if (!month || !day || !year || year < 2000 || isNaN(hours) || isNaN(minutes)) {
      setErrorMsg("Invalid date or time. Use mm/dd/yyyy and hh:mm."); setStatus("error"); return;
    }
    const timeMs = new Date(year, month - 1, day, hours, minutes).getTime();
    if (isNaN(timeMs) || timeMs <= Date.now()) {
      setErrorMsg("Scheduled time must be in the future."); setStatus("error"); return;
    }
    
    setStatus("scheduling"); setErrorMsg("");
    try {
      if (onScheduleSend) {
        await onScheduleSend({
          from: fromEmail,
          to,
          subject,
          body: htmlBody,
          htmlBody: htmlBody,
          inReplyTo: prefill?.inReplyTo,
          scheduledAt: timeMs
        });
      }
      setStatus("sent"); setTimeout(onClose, 1500);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error"); setStatus("error");
    }
  }

  return (
    <div className={"flex flex-col h-full overflow-hidden transition-all duration-300 " + (maximized ? "h-full " : "rounded-2xl border border-zinc-200 shadow-2xl shadow-zinc-900/20 bg-white " + (minimized ? "h-[48px]" : ""))}>
      <div 
        className={"flex items-center justify-between bg-[#41431B] px-4 py-2.5 flex-shrink-0 " + (maximized ? "" : "cursor-move select-none")}
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
      >
        <span className="text-sm font-semibold text-white">{prefill?.inReplyTo ? "Reply" : "New Message"}</span>
        <div className="flex items-center gap-2">
          {onToggleMinimize && (
            <button type="button" onClick={onToggleMinimize} title={minimized ? "Restore" : "Minimize"}
              className="text-[#A0A368] hover:text-white transition-colors p-0.5 rounded">
              {minimized
                ? <Icon path="M4.5 15.75l7.5-7.5 7.5 7.5" className="h-4 w-4" />
                : <Icon path="M19.5 8.25l-7.5 7.5-7.5-7.5" className="h-4 w-4" />}
            </button>
          )}
          <button type="button" onClick={onToggleMaximize} title={maximized ? "Minimize" : "Maximize"}
            className={"text-[#A0A368] hover:text-white transition-colors p-0.5 rounded" + (minimized ? " hidden" : "")}>
            {maximized
              ? <Icon path="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15v4.5M15 15h4.5M15 15l5.25 5.25M9 15H4.5M9 15v4.5M9 15l-5.25 5.25" className="h-4 w-4" />
              : <Icon path="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" className="h-4 w-4" />}
          </button>
          <button type="button" onClick={onClose} className="text-[#A0A368] hover:text-white transition-colors p-0.5 rounded">
            <Icon path="M6 18L18 6M6 6l12 12" className="h-4 w-4" />
          </button>
        </div>
      </div>
      {!minimized && (
        <>
          {status === "sent" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-white">
              <div className="h-12 w-12 rounded-full bg-[#EAE0D5]/60 flex items-center justify-center">
                <Icon path="M5 13l4 4L19 7" className="h-6 w-6 text-[#41431B]" />
              </div>
              <p className="text-sm font-medium text-zinc-700">Message sent!</p>
            </div>
          ) : (
            <form onSubmit={handleSend} className="flex flex-col flex-1 overflow-hidden bg-white">
              <div className="border-b border-zinc-100 px-4 py-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-10 flex-shrink-0 text-xs font-semibold text-zinc-400 uppercase">To</span>
              <input type="email" value={to} onChange={(e) => setTo(e.target.value)} required placeholder="recipient@example.com"
                className="flex-1 py-1 text-sm text-zinc-900 placeholder:text-zinc-300 focus:outline-none" />
            </div>
          </div>
          <div className="border-b border-zinc-100 px-4 py-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-10 flex-shrink-0 text-xs font-semibold text-zinc-400 uppercase">Subj</span>
              <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} required placeholder="Subject"
                className="flex-1 py-1 text-sm text-zinc-900 placeholder:text-zinc-300 focus:outline-none" />
            </div>
          </div>
          <RichTextToolbar editorRef={editorRef} />
          <div ref={editorRef} contentEditable suppressContentEditableWarning
            data-placeholder="Write your message…"
            onInput={() => { if (editorRef.current) onEditorChange(editorRef.current.innerHTML); }}
            className={("flex-1 overflow-y-auto px-4 py-3 text-sm text-zinc-800 focus:outline-none" +
              " [&>blockquote]:border-l-4 [&>blockquote]:border-green-300 [&>blockquote]:pl-3 [&>blockquote]:text-zinc-500" +
              " [&>h2]:text-base [&>h2]:font-semibold" +
              " empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-300 empty:before:pointer-events-none" +
              (maximized ? " min-h-[400px]" : " min-h-[280px]"))} />
          {status === "error" && <p className="px-4 py-1.5 text-xs text-red-500 bg-red-50 flex-shrink-0">{errorMsg}</p>}
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 py-2 border-t border-zinc-100 flex-shrink-0">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 rounded-full bg-[#EAE0D5] border border-[#EAE0D5] px-2.5 py-1 text-xs text-zinc-700">
                  <Icon path="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" className="h-3.5 w-3.5 text-[#41431B] flex-shrink-0" />
                  <span className="max-w-[120px] truncate">{f.name}</span>
                  <span className="text-zinc-400">({formatBytes(f.size)})</span>
                  <button type="button" onClick={() => removeFile(i)} className="text-zinc-400 hover:text-red-500 ml-0.5">
                    <Icon path="M6 18L18 6M6 6l12 12" className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-2.5 flex-shrink-0">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-[#20220E] transition-colors rounded-full px-2 py-1 hover:bg-[#EAE0D5]">
                <Icon path="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" className="h-4 w-4" />
                Attach
              </button>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
              <span className="text-xs text-zinc-400 hidden sm:block truncate max-w-[180px]">From: {fromEmail}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-white rounded-full border border-zinc-200 focus-within:border-[#5A5D24] focus-within:ring-1 focus-within:ring-[#41431B]/20 overflow-hidden transition-all shadow-sm">
                <MaskedDateInput value={scheduleDate} onChange={setScheduleDate} />
                <MaskedTimeInput value={scheduleTime} onChange={setScheduleTime} />
              </div>
              <button type="button" onClick={handleScheduleSend} disabled={status === "sending" || status === "scheduling"}
                className="rounded-full border border-[#41431B] bg-white px-3 py-1.5 text-sm font-semibold text-[#41431B] hover:bg-[#EAE0D5] focus:ring-2 focus:ring-[#41431B]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                {status === "scheduling" ? "Scheduling…" : "Schedule"}
              </button>
              <button type="submit" disabled={status === "sending" || status === "scheduling"}
                className="rounded-full bg-[#41431B] px-5 py-1.5 text-sm font-semibold text-white hover:bg-[#20220E] focus:ring-2 focus:ring-[#41431B]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                {status === "sending" ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </form>
          )}
        </>
      )}
    </div>
  );
}

// ── Attachment list ───────────────────────────────────────────────────────────
function AttachmentList({ emailId }: { emailId: Id<"emails"> }) {
  const atts = useQuery(api.emails.getAttachmentUrls, { id: emailId }) as AttachmentUrl[] | undefined;
  if (!atts?.length) return null;
  return (
    <div className="mt-4 border-t border-zinc-100 pt-4">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#41431B]">Attachments ({atts.length})</p>
      <div className="flex flex-wrap gap-3">
        {atts.map((att, i) => (
          <a key={i} href={att.url ?? "#"} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-full border border-[#EAE0D5] bg-[#EAE0D5] px-3 py-2 text-sm hover:bg-[#EAE0D5]/60 transition-colors max-w-xs">
            {att.mimeType.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={att.url ?? ""} alt={att.name} className="h-8 w-8 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-white border border-[#EAE0D5] flex items-center justify-center flex-shrink-0">
                <Icon path="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" className="h-4 w-4 text-[#41431B]" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-medium text-zinc-700 truncate">{att.name}</p>
              <p className="text-xs text-zinc-400">{formatBytes(att.size)}</p>
            </div>
            <Icon path="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" className="h-4 w-4 text-[#41431B] flex-shrink-0 ml-1" />
          </a>
        ))}
      </div>
    </div>
  );
}

// ── Inbox View ───────────────────────────────────────────────────────────────
function InboxView() {
  const { signOut } = useAuthActions();
  const currentUser = useQuery(api.users.getCurrentUser);
  const [currentFolder, setCurrentFolder] = useState<"inbox" | "sent" | "spam" | "scheduled">("inbox");
  const emails = useQuery(api.emails.list, { folder: currentFolder });
  const blockedSenders = useQuery(api.emails.getBlockedSenders) || [];

  const markRead = useMutation(api.emails.markRead);
  const markUnread = useMutation(api.emails.markUnread);
  const moveToFolder = useMutation(api.emails.moveToFolder);
  const markSenderAsSpam = useMutation(api.emails.markSenderAsSpam);
  const unmarkSenderAsSpam = useMutation(api.emails.unmarkSenderAsSpam);
  const saveScheduledMutation = useMutation(api.emails.saveScheduled);

  const [selected, setSelected] = useState<Email | null>(null);
  const threadEmailsServer = useQuery(api.emails.listThread, selected?.threadId ? { threadId: selected.threadId } : "skip");
  const threadMails = selected?.threadId && threadEmailsServer ? threadEmailsServer : (selected ? [selected] : []);

  const [expandedEmails, setExpandedEmails] = useState<Set<Id<"emails">>>(new Set());
  const [showHtml, setShowHtml] = useState(false);

  useEffect(() => {
    if (selected) {
      setExpandedEmails(new Set([selected._id]));
    }
  }, [selected?._id]);

  const toggleExpand = useCallback((id: Id<"emails">) => {
    setExpandedEmails(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  // "floating" = bottom-right panel, "maximized" = takes over right pane, null = closed
  const [composeMode, setComposeMode] = useState<null | "floating" | "maximized" | "minimized">(null);
  const [composePrefill, setComposePrefill] = useState<ComposeState | undefined>(undefined);
  // Lifted editor HTML — persists across float↔maximize remounts
  const [composeEditorHtml, setComposeEditorHtml] = useState("");
  const [composePosition, setComposePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionStartRef = useRef({ x: 0, y: 0 });

  const handleDragStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (composeMode === "maximized") return;
    if ((e.target as HTMLElement).closest('button')) return;
    isDraggingRef.current = true;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    positionStartRef.current = { ...composePosition };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [composeMode, composePosition]);

  const handleDragMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    setComposePosition({
      x: positionStartRef.current.x + (e.clientX - dragStartRef.current.x),
      y: positionStartRef.current.y + (e.clientY - dragStartRef.current.y),
    });
  }, []);

  const handleDragEnd = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  const openCompose = useCallback((prefill?: ComposeState) => {
    if (composeMode === "minimized") {
      setComposeMode("floating");
      return;
    }
    setComposePrefill(prefill); setComposeMode("floating");
  }, [composeMode]);
  const closeCompose = useCallback(() => {
    setComposeMode(null); setComposePrefill(undefined); setComposeEditorHtml(""); setComposePosition({ x: 0, y: 0 });
  }, []);
  const toggleMaximize = useCallback(() => {
    setComposeMode((m) => m === "maximized" ? "floating" : "maximized");
    setComposePosition({ x: 0, y: 0 });
  }, []);
  const toggleMinimize = useCallback(() => setComposeMode((m) => m === "minimized" ? "floating" : "minimized"), []);

  async function openEmail(email: Email) {
    setSelected(email); setShowHtml(false);
    if (composeMode === "maximized") setComposeMode("floating");
    if (!email.read) await markRead({ id: email._id });
  }

  function handleReply(email: Email) {
    const subj = email.subject.startsWith("Re:") ? email.subject : "Re: " + email.subject;
    setComposePrefill({ to: email.from, subject: subj, inReplyTo: email.messageId });
    setComposeMode("maximized");
  }

  const typedEmails = emails as Email[] | undefined;
  const unread = typedEmails?.filter((e) => !e.read).length ?? 0;
  const userEmail = currentUser?.email ?? "";
  const rightPaneIsCompose = composeMode === "maximized";

  async function handleMarkSpam(email: Email) {
    await moveToFolder({ id: email._id, folder: "spam" });
    if (selected?._id === email._id) setSelected(null);
  }

  async function handleUnmarkSpam(email: Email) {
    await moveToFolder({ id: email._id, folder: "inbox" });
    if (selected?._id === email._id) setSelected(null);
  }

  async function handleSpamSender(email: Email) {
    if (confirm(`Are you sure you want to mark ${email.from} as a spam sender? All past and future emails from them will be sent to Spam.`)) {
      await markSenderAsSpam({ senderEmail: email.from });
      if (selected?.from === email.from) setSelected(null);
    }
  }

  async function handleUnmarkSpamSender(email: Email) {
    if (confirm(`Are you sure you want to unmark ${email.from} as a spam sender? Their past emails will be moved back to the Inbox.`)) {
      await unmarkSenderAsSpam({ senderEmail: email.from });
      if (selected?.from === email.from) setSelected(null);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-[#F3E3D0] backdrop-blur-xl">
      <header className="flex items-center justify-between border-b border-[#EAE0D5] bg-[#F3E3D0]/80 backdrop-blur-md px-6 py-3.5 border-b border-black/5 shadow-sm flex-shrink-0 z-10 relative">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-[#41431B] flex items-center justify-center shadow-sm">
            <Icon path="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" className="h-4 w-4 text-white" />
          </div>
          <span className="text-base font-serif font-bold text-[#20220E]">KoolMail</span>
          {unread > 0 && <span className="rounded-full bg-[#41431B] px-2 py-0.5 text-xs font-semibold text-white">{unread}</span>}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-500 hidden sm:block">{userEmail}</span>
          <button onClick={() => openCompose()}
            className="flex items-center gap-1.5 rounded-full bg-[#41431B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#20220E] transition-colors shadow-sm">
            <Icon path="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" className="h-4 w-4" />
            Compose
          </button>
          <button onClick={() => void signOut()} className="text-sm text-zinc-400 hover:text-zinc-700 transition-colors">Sign out</button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden gap-3 p-3">
        {/* Left Navigation Icon Bar */}
        <div className="flex flex-col gap-4 py-2 w-12 flex-shrink-0 items-center">
          <button onClick={() => { setCurrentFolder("inbox"); setSelected(null); }} title="Inbox"
            className={"p-2.5 rounded-full transition-all " + (currentFolder === "inbox" ? "bg-[#41431B] text-white shadow-md shadow-green-600/20" : "text-[#20220E] hover:bg-[#EAE0D5]/60")}>
            <Icon path="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" className="w-5 h-5" />
          </button>
          <button onClick={() => { setCurrentFolder("sent"); setSelected(null); }} title="Sent"
            className={"p-2.5 rounded-full transition-all " + (currentFolder === "sent" ? "bg-[#41431B] text-white shadow-md shadow-green-600/20" : "text-[#20220E] hover:bg-[#EAE0D5]/60")}>
            <Icon path="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" className="w-5 h-5" />
          </button>
          <button onClick={() => { setCurrentFolder("spam"); setSelected(null); }} title="Spam"
            className={"p-2.5 rounded-full transition-all " + (currentFolder === "spam" ? "bg-[#41431B] text-white shadow-md shadow-green-600/20" : "text-[#20220E] hover:bg-[#EAE0D5]/60")}>
            <Icon path="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" className="w-5 h-5" />
          </button>
          <button onClick={() => { setCurrentFolder("scheduled"); setSelected(null); }} title="Scheduled"
            className={"p-2.5 rounded-full transition-all " + (currentFolder === "scheduled" ? "bg-[#41431B] text-white shadow-md shadow-green-600/20" : "text-[#20220E] hover:bg-[#EAE0D5]/60")}>
            <Icon path="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" className="w-5 h-5" />
          </button>
        </div>

        {/* Email list */}
        <div className="w-72 xl:w-80 flex-shrink-0 rounded-3xl border border-white/40 bg-white/40 backdrop-blur-xl shadow-lg ring-1 ring-black/5 overflow-hidden p-2 flex flex-col shadow-sm">
          <div className="px-4 py-3 border-b border-zinc-50 flex-shrink-0">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#41431B]">
              {currentFolder === "inbox" ? "Inbox" : currentFolder === "sent" ? "Sent Mails" : currentFolder === "scheduled" ? "Scheduled" : "Spam"}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {emails === undefined && <p className="px-5 py-8 text-sm text-zinc-400">Loading…</p>}
            {typedEmails?.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 px-5 py-12 text-center">
                <div className="h-10 w-10 rounded-2xl bg-[#EAE0D5] flex items-center justify-center">
                  <Icon path="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" className="h-5 w-5 text-[#A0A368]" />
                </div>
                <p className="text-sm text-zinc-400">
                  {currentFolder === "inbox" ? "Inbox is empty" : currentFolder === "sent" ? "No sent emails yet" : currentFolder === "scheduled" ? "No scheduled emails" : "Spam is empty"}
                </p>
              </div>
            )}
            {typedEmails?.map((email) => (
              <button key={email._id} onClick={() => openEmail(email)}
                className={"w-full mb-2 rounded-2xl border border-black/5 bg-white/60 p-4 text-left shadow-sm backdrop-blur-md transition-all hover:translate-y-[-2px] hover:shadow-md " +
                  (selected?._id === email._id ? "bg-white/90 border border-[#41431B]/20 shadow-md ring-1 ring-[#41431B]/10" : "border-l-transparent")}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className={"text-sm leading-tight truncate flex-1 mr-2 " + (email.read ? "text-zinc-500" : "font-semibold text-zinc-900")}>
                    {currentFolder === "sent" || currentFolder === "scheduled" ? email.to : email.from}
                  </span>
                  {!email.read && <span className="h-2 w-2 rounded-full bg-[#41431B] flex-shrink-0" />}
                </div>
                <p className={"text-sm truncate " + (email.read ? "text-zinc-400" : "font-medium text-zinc-700")}>{email.subject}</p>
                <p className="mt-0.5 text-xs text-zinc-400 truncate">
                  {currentFolder === "scheduled" && email.scheduledAt
                    ? `Scheduled for ${new Date(email.scheduledAt).toLocaleString()} · ${email.body.slice(0, 45)}`
                    : `${new Date(email.receivedAt).toLocaleDateString()} · ${email.body.slice(0, 45)}`}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Right pane: compose (maximized) OR email reader */}
        <div className="flex-1 rounded-3xl border border-white/40 bg-white/40 backdrop-blur-xl shadow-lg ring-1 ring-black/5 overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col shadow-sm min-w-0">
          {rightPaneIsCompose ? (
            <ComposeForm 
              fromEmail={userEmail} 
              maximized 
              minimized={false} 
              onToggleMaximize={toggleMaximize} 
              onToggleMinimize={toggleMinimize} 
              onClose={closeCompose} 
              prefill={composePrefill} 
              initialHtml={composeEditorHtml} 
              onEditorChange={setComposeEditorHtml} 
              onScheduleSend={saveScheduledMutation}
            />
          ) : selected ? (
            <div className="flex flex-col h-full">
              <div className="border-b border-zinc-100 px-6 py-4 flex-shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <button onClick={() => setSelected(null)}
                      className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[#41431B] hover:text-[#20220E] transition-colors">
                      <Icon path="M10 19l-7-7m0 0l7-7m-7 7h18" className="h-3.5 w-3.5" /> Back
                    </button>
                    <h2 className="text-4xl font-serif font-medium text-[#41431B] truncate mb-1">{selected.subject}</h2>
                    {threadMails.length > 1 && (
                      <span className="text-xs font-medium text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">
                        {threadMails.length} messages
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <div className="flex items-center gap-2">
                       {selected.htmlBody && (
                        <button onClick={() => setShowHtml((v) => !v)}
                          className="flex items-center gap-1 rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
                          {showHtml ? "Plain text" : "View HTML"}
                        </button>
                      )}
                      {currentFolder !== "scheduled" && (
                        <button onClick={() => handleReply(selected)}
                          className="flex items-center gap-1.5 rounded-full bg-[#41431B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#20220E] transition-colors">
                          <Icon path="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" className="h-3.5 w-3.5" /> Reply
                        </button>
                      )}
                    </div>
                    {(currentFolder === "inbox" || currentFolder === "spam") && (
                      <div className="flex items-center gap-2">
                        {currentFolder === "spam" ? (
                          <button onClick={() => { handleUnmarkSpam(selected); setSelected(null); }}
                            className="flex items-center gap-1 rounded-full border border-[#A0A368] bg-[#EAE0D5] px-2 py-1 text-xs font-medium text-[#41431B] hover:bg-[#EAE0D5]/60 transition-colors">
                            Not Spam
                          </button>
                        ) : (
                          <button onClick={() => { handleMarkSpam(selected); setSelected(null); }}
                            className="flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors">
                            Spam
                          </button>
                        )}
                        
                        {blockedSenders.includes(selected.from) ? (
                          <button onClick={() => { handleUnmarkSpamSender(selected); setSelected(null); }}
                            className="flex items-center gap-1 rounded-full border border-[#A0A368] bg-[#EAE0D5] px-2 py-1 text-xs font-medium text-[#41431B] hover:bg-[#EAE0D5]/60 transition-colors">
                            Unblock Sender
                          </button>
                        ) : (
                          <button onClick={() => { handleSpamSender(selected); setSelected(null); }}
                            className="flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors">
                            Block Sender
                          </button>
                        )}
                        
                        <button onClick={() => { 
                            if (selected.read) {
                              markUnread({ id: selected._id });
                            } else {
                              markRead({ id: selected._id });
                            }
                            setSelected({ ...selected, read: !selected.read });
                          }}
                          className="flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 transition-colors">
                          {selected.read ? "Mark Unread" : "Mark Read"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-5 bg-zinc-50/50 space-y-4">
                {threadMails.map((email) => {
                  const isExpanded = expandedEmails.has(email._id) || threadMails.length === 1;
                  const isLatest = email._id === threadMails[threadMails.length - 1]?._id;
                  
                  return (
                    <div key={email._id} id={email._id} className={"border rounded-3xl bg-white overflow-hidden transition-all " + (isExpanded ? "border-zinc-200 shadow-sm" : "border-zinc-100/80 hover:border-zinc-200")}>
                      <div 
                        className={"px-5 py-3.5 flex items-center justify-between cursor-pointer " + (isExpanded ? "border-b border-zinc-100/50 bg-zinc-50/30" : "")}
                        onClick={() => toggleExpand(email._id)}
                      >
                         <div className="flex items-center gap-3 overflow-hidden">
                            <span className="font-semibold text-zinc-900 text-sm whitespace-nowrap">{email.from}</span>
                            {!isExpanded && <span className="text-zinc-500 text-xs truncate max-w-[300px] xl:max-w-md">{email.body.replace(/\s+/g, ' ').slice(0, 80)}...</span>}
                         </div>
                         <div className="text-zinc-500 text-xs whitespace-nowrap pl-4 flex items-center gap-3">
                            {new Date(email.receivedAt).toLocaleString()}
                            {isExpanded && (
                              <button onClick={(e) => { e.stopPropagation(); handleReply(email); }} className="hover:text-[#41431B] p-1 bg-zinc-100/50 hover:bg-[#EAE0D5] rounded-full transition-colors" title="Reply">
                                <Icon path="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" className="h-3.5 w-3.5" />
                              </button>
                            )}
                         </div>
                      </div>
                      
                      {isExpanded && (
                        <div className="px-5 py-4">
                           <div className="mb-4 text-xs text-zinc-500">
                             <span className="font-medium text-zinc-700">To:</span> {email.to}
                           </div>
                           {showHtml && email.htmlBody ? (
                             <iframe srcDoc={email.htmlBody} sandbox="allow-same-origin" className="w-full min-h-[400px] border-0 rounded-3xl bg-white" title="HTML email" />
                           ) : (
                             <pre className="whitespace-pre-wrap text-sm text-zinc-700 font-sans leading-relaxed">{stripReplyChain(email.body)}</pre>
                           )}
                           {email.attachments?.length ? <AttachmentList emailId={email._id} /> : null}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center px-8">
              <div className="h-14 w-14 rounded-2xl bg-[#EAE0D5] flex items-center justify-center">
                <Icon path="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" className="h-7 w-7 text-[#A0A368]" />
              </div>
              <p className="text-sm font-medium text-zinc-500">Select an email to read it</p>
              <p className="text-xs text-zinc-400">or hit <span className="font-medium text-[#41431B]">Compose</span> to write a new message</p>
            </div>
          )}
        </div>
      </div>

      {/* Floating compose panel */}
      {(composeMode === "floating" || composeMode === "minimized") && (
        <div 
          className={"fixed bottom-6 right-6 z-50 origin-bottom-right " + (isDragging ? "" : "transition-transform duration-300 ") + (composeMode === "minimized" ? "w-[340px] h-[48px]" : "w-[680px] h-[560px] max-h-[80vh] flex flex-col")}
          style={{ transform: `translate(${composePosition.x}px, ${composePosition.y}px)` }}
        >
          <ComposeForm 
            fromEmail={userEmail} 
            maximized={false} 
            minimized={composeMode === "minimized"}
            onToggleMaximize={toggleMaximize} 
            onToggleMinimize={toggleMinimize}
            onClose={closeCompose} 
            prefill={composePrefill} 
            initialHtml={composeEditorHtml} 
            onEditorChange={setComposeEditorHtml} 
            onScheduleSend={saveScheduledMutation}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
          />
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function InboxPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <LoginForm />;
  return <InboxView />;
}
