"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState, useRef, useCallback, useEffect } from "react";
import { useConvexAuth, useQuery, useMutation, usePaginatedQuery } from "convex/react";
import { toast } from "sonner";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { 
  Mail, Send, FileEdit, AlertOctagon, Trash2, Clock, 
  Search, Menu, Plus, Paperclip, Reply, Forward,
  MoreVertical, X, Maximize2, Minimize2, Check, User,
  Bold, Italic, Strikethrough, ListOrdered, Quote, Heading2, Type,
  ShieldAlert, ShieldCheck, Square, CheckSquare, Image as ImageIcon, File,
  MoreHorizontal, CornerUpLeft, CornerUpRight, Undo, Users, ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen, Loader2, CircleCheckBig, CircleAlert
} from "lucide-react";

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
  folder?: string;
  deletedAt?: number;
  openedAt?: number;
  attachments?: { storageId: Id<"_storage">; name: string; mimeType: string; size: number }[];
};

type AttachmentUrl = { name: string; mimeType: string; size: number; url: string | null };
type ComposeState = { to: string; subject: string; inReplyTo?: string; id?: Id<"emails"> };

function formatBytes(b: number) {
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
}

function BrandMailIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="2.5" y="4" width="19" height="16" rx="4" className="fill-current" opacity="0.2" />
      <rect x="2.5" y="4" width="19" height="16" rx="4" className="stroke-current" strokeWidth="1.5" />
      <path d="M4.5 7.5L12 13L19.5 7.5" className="stroke-current" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="18.5" cy="17.5" r="2.5" className="fill-current" />
    </svg>
  );
}

function FolderGlyph({ className = "h-[18px] w-[18px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 7.5C3 6.67 3.67 6 4.5 6H9.2C9.63 6 10.04 6.18 10.33 6.49L11.16 7.35C11.44 7.64 11.84 7.8 12.24 7.8H19.5C20.33 7.8 21 8.47 21 9.3V17.5C21 18.33 20.33 19 19.5 19H4.5C3.67 19 3 18.33 3 17.5V7.5Z" className="stroke-current" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function TrashGlyph({ className = "h-[18px] w-[18px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M4 7.5H20" className="stroke-current" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M9 7.5V5.8C9 5.36 9.36 5 9.8 5H14.2C14.64 5 15 5.36 15 5.8V7.5" className="stroke-current" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7.5 7.5L8.2 18.2C8.24 18.67 8.63 19.03 9.11 19.03H14.89C15.37 19.03 15.76 18.67 15.8 18.2L16.5 7.5" className="stroke-current" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.2 10.5V16" className="stroke-current" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M13.8 10.5V16" className="stroke-current" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ── Rich Text Toolbar ─────────────────────────────────────────────────────────
function RichTextToolbar({ editor }: { editor: any }) {
  if (!editor) return null;
  const tools = [
    { label: <Bold size={14}/>, title: "Bold", active: editor.isActive("bold"), action: () => editor.chain().focus().toggleBold().run() },
    { label: <Italic size={14}/>, title: "Italic", active: editor.isActive("italic"), action: () => editor.chain().focus().toggleItalic().run() },
    { label: <Strikethrough size={14}/>, title: "Strikethrough", active: editor.isActive("strike"), action: () => editor.chain().focus().toggleStrike().run() },
    { label: <ListOrdered size={14}/>, title: "Numbered list", active: editor.isActive("orderedList"), action: () => editor.chain().focus().toggleOrderedList().run() },
    { label: <div className="w-px h-4 bg-border mx-1" /> },
    { label: <Quote size={14}/>, title: "Blockquote", active: editor.isActive("blockquote"), action: () => editor.chain().focus().toggleBlockquote().run() },
    { label: <Heading2 size={14}/>, title: "Heading 2", active: editor.isActive("heading", { level: 2 }), action: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: <Type size={14}/>, title: "Paragraph", active: editor.isActive("paragraph"), action: () => editor.chain().focus().setParagraph().run() },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1 bg-muted/30 flex-shrink-0">
      {tools.map((t, i) => t.action ? (
        <button key={i} type="button" title={t.title}
          onClick={(e) => { e.preventDefault(); t.action?.(); }}
          className={"inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8 " + 
            (t.active ? "bg-accent text-accent-foreground " : "text-muted-foreground ")}>
          {t.label}
        </button>
      ) : <div key={i}>{t.label}</div>)}
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

  function isValidUsername(u: string) { return /^[a-z0-9._-]{1,32}$/.test(u); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmed = username.trim().toLowerCase();
    if (!isValidUsername(trimmed)) {
      setError("Username can only contain valid characters.");
      return;
    }
    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match."); return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters."); return;
    }
    setLoading(true);
    try {
      await signIn("password", { email: `${trimmed}@${DOMAIN}`, password, flow: mode === "signup" ? "signUp" : "signIn" });
    } catch {
      setError(mode === "signup" ? "That username is already taken." : "Incorrect username or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 font-sans">
      <div className="w-full max-w-[440px] bg-card text-card-foreground p-8 rounded-xl shadow-lg border border-border">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="rounded-full bg-primary/10 p-3">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-foreground">KoolMail</span>
        </div>
        <div className="flex flex-col space-y-1.5 text-center mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">{mode === "signin" ? "Welcome back" : "Create an account"}</h1>
          <p className="text-sm text-muted-foreground">{mode === "signin" ? `Enter your credentials to continue.` : `Your email will be username@${DOMAIN}.`}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex rounded-md border border-input focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 bg-background transition-colors w-full h-10">
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="Username" required autoComplete="username" className="flex h-10 w-full rounded-md bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 border-0 focus:ring-0 shadow-none min-w-0" />
              <span className="flex items-center px-3 text-sm text-muted-foreground select-none border-l border-input shrink-0 bg-muted/50 rounded-r-md">@${DOMAIN}</span>
            </div>
          </div>
          <div className="space-y-2">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required autoComplete={mode === "signup" ? "new-password" : "current-password"} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
          </div>
          {mode === "signup" && (
            <div className="space-y-2">
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm password" required autoComplete="new-password" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
            </div>
          )}
          {error && <p className="text-[0.8rem] font-medium text-destructive">{error}</p>}
          <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 mt-4">{loading ? "Please wait..." : (mode === "signup" ? "Sign up" : "Sign in")}</button>
          
          <div className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>Don't have an account? <button type="button" onClick={() => { setMode("signup"); setError(""); }} className="font-semibold text-primary hover:text-primary/80 hover:underline">Sign up</button></>
            ) : (
              <>Already have an account? <button type="button" onClick={() => { setMode("signin"); setError(""); setConfirmPassword(""); }} className="font-semibold text-primary hover:text-primary/80 hover:underline">Sign in</button></>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function MaskedDateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
    let out = digits.slice(0, 2);
    if (digits.length >= 3) out += "/" + digits.slice(2, 4);
    if (digits.length >= 5) out += "/" + digits.slice(4, 8);
    onChange(out);
  }
  return <input type="text" inputMode="numeric" value={value} onChange={handleChange} placeholder="mm/dd/yyyy" maxLength={10} className="w-[90px] text-sm text-foreground bg-transparent placeholder:text-muted-foreground px-2 py-1.5 focus:outline-none border-r border-input" />;
}

function MaskedTimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
    let out = digits.slice(0, 2);
    if (digits.length >= 3) out += ":" + digits.slice(2, 4);
    onChange(out);
  }
  return <input type="text" inputMode="numeric" value={value} onChange={handleChange} placeholder="hh:mm" maxLength={5} className="w-[60px] text-sm text-foreground bg-transparent placeholder:text-muted-foreground px-2 py-1.5 focus:outline-none" />;
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
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevPrefill = useRef(prefill);

  const saveSentMutation = useMutation(api.emails.saveSent);
  const saveDraftMutation = useMutation(api.emails.saveDraft);
  const deleteDraftMutation = useMutation(api.emails.deleteDraft);
  
  const draftIdRef = useRef<Id<"emails"> | undefined>(prefill?.id);
  const lastSavedHtmlRef = useRef(initialHtml ?? "");
  const draftTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [draftSyncStatus, setDraftSyncStatus] = useState<"saved" | "unsaved" | "saving">(prefill?.id ? "saved" : "unsaved");

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialHtml ?? "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "flex-1 overflow-y-auto px-4 py-3 text-sm text-foreground focus:outline-none [&>blockquote]:border-l-4 [&>blockquote]:border-muted [&>blockquote]:pl-3 [&>blockquote]:text-muted-foreground [&>h2]:text-lg [&>h2]:font-semibold min-h-[280px] bg-transparent"
      }
    },
    onUpdate: ({ editor }: any) => {
      const html = editor.getHTML();
      onEditorChange(html);
      
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
      if (html !== lastSavedHtmlRef.current) setDraftSyncStatus("unsaved");
      draftTimerRef.current = setTimeout(() => {
        if (html !== lastSavedHtmlRef.current && (to || subject || html.replace(/<[^>]*>?/gm, '').trim())) {
          setDraftSyncStatus("saving");
          saveDraftMutation({
            id: draftIdRef.current,
            to,
            subject: subject || "No Subject",
            body: html,
            htmlBody: html,
            inReplyTo: prefill?.inReplyTo,
          }).then(id => {
            if (id) draftIdRef.current = id;
            lastSavedHtmlRef.current = html;
            setDraftSyncStatus("saved");
          });
        }
      }, 3000);
    }
  });

  useEffect(() => {
    if (prefill && prefill !== prevPrefill.current) {
      setTo(prefill.to); setSubject(prefill.subject);
      draftIdRef.current = prefill.id;
      prevPrefill.current = prefill;
      lastSavedHtmlRef.current = initialHtml ?? "";
      setDraftSyncStatus(prefill.id ? "saved" : "unsaved");
    }
  }, [prefill]);

  function removeFile(i: number) { setFiles((f) => f.filter((_, j) => j !== i)); }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(e.target.files ?? []);
    const big = incoming.filter((f) => f.size > MAX_ATTACHMENT_MB * 1048576);
    if (big.length) { toast.error("Files over " + MAX_ATTACHMENT_MB + " MB: " + big.map((f) => f.name).join(", ")); setStatus("error"); return; }
    setFiles((p) => [...p, ...incoming]); e.target.value = "";
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const htmlBody = editor?.getHTML() ?? "";
    if (!htmlBody || htmlBody === "<p></p>" || htmlBody.trim() === "") {
      toast.error("Message body cannot be empty."); setStatus("error"); return;
    }
    setStatus("sending");
    const attachments = await Promise.all(files.map((file) =>
      new Promise<{ filename: string; content: string; contentType: string }>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve({ filename: file.name, content: (r.result as string).split(",")[1], contentType: file.type });
        r.readAsDataURL(file);
      })
    ));
    try {
      const trackingId = draftIdRef.current || crypto.randomUUID();
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: fromEmail, to, subject, body: htmlBody, inReplyTo: prefill?.inReplyTo, attachments: attachments.length ? attachments : undefined, trackingId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send");
      
      await saveSentMutation({
        from: fromEmail, to, subject, body: htmlBody, htmlBody: htmlBody, inReplyTo: prefill?.inReplyTo,
      });

      if (draftIdRef.current) {
        await deleteDraftMutation({ id: draftIdRef.current });
        draftIdRef.current = undefined;
      }

      setStatus("sent"); toast.success("Message sent"); onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Unknown error"); setStatus("error");
    }
  }

  async function handleScheduleSend(e: React.MouseEvent) {
    e.preventDefault();
    if (!scheduleDate || !scheduleTime) {
      toast.error("Please fill in both date (mm/dd/yyyy) and time (hh:mm)."); setStatus("error"); return;
    }
    const htmlBody = editor?.getHTML() ?? "";
    if (!htmlBody || htmlBody === "<p></p>" || htmlBody.trim() === "") {
      toast.error("Message body cannot be empty."); setStatus("error"); return;
    }
    
    const [month, day, year] = scheduleDate.split("/").map(Number);
    const [hours, minutes] = scheduleTime.split(":").map(Number);
    if (!month || !day || !year || year < 2000 || isNaN(hours) || isNaN(minutes)) {
      toast.error("Invalid date or time. Use mm/dd/yyyy and hh:mm."); setStatus("error"); return;
    }
    const timeMs = new Date(year, month - 1, day, hours, minutes).getTime();
    if (isNaN(timeMs) || timeMs <= Date.now()) {
      toast.error("Scheduled time must be in the future."); setStatus("error"); return;
    }
    
    setStatus("scheduling");
    try {
      if (onScheduleSend) {
        await onScheduleSend({ from: fromEmail, to, subject, body: htmlBody, htmlBody: htmlBody, inReplyTo: prefill?.inReplyTo, scheduledAt: timeMs });
      }
      if (draftIdRef.current) {
        await deleteDraftMutation({ id: draftIdRef.current });
        draftIdRef.current = undefined;
      }
      setStatus("sent"); toast.success("Message scheduled"); onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Unknown error"); setStatus("error");
    }
  }

  async function handleDiscard() {
    if (draftIdRef.current) {
      await deleteDraftMutation({ id: draftIdRef.current });
      draftIdRef.current = undefined;
    }
    onClose();
  }

  const DraftStatusIcon = () => {
    if (draftSyncStatus === "saving") {
      return <Loader2 size={14} className="animate-spin text-muted-foreground" />;
    }
    if (draftSyncStatus === "saved") {
      return <CircleCheckBig size={14} className="text-emerald-600" />;
    }
    return <CircleAlert size={14} className="text-amber-600" />;
  };

  return (
    <div className={"flex flex-col h-full min-h-0 bg-background font-sans " + (maximized ? "h-full " : "rounded-t-lg shadow-xl border border-border overflow-hidden " + (minimized ? "h-[48px]" : ""))}>
      <div className={"flex items-center justify-between bg-muted/50 px-4 py-3 flex-shrink-0 border-b border-border " + (maximized ? "" : "cursor-move select-none")} onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd} onPointerCancel={onDragEnd}>
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-semibold tracking-tight text-foreground truncate">{prefill?.inReplyTo ? "Reply" : "New Message"}</span>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground">
            <DraftStatusIcon />
            <span>
              {draftSyncStatus === "saving" ? "Saving" : draftSyncStatus === "saved" ? "Saved" : "Unsaved"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onToggleMinimize && <button type="button" onClick={onToggleMinimize} title={minimized ? "Restore" : "Minimize"} className="inline-flex h-7 w-7 items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-muted-foreground">{minimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}</button>}
          <button type="button" onClick={onToggleMaximize} title={maximized ? "Pop out" : "Maximize"} className={"inline-flex h-7 w-7 items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-muted-foreground" + (minimized ? " hidden" : "")}>{maximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}</button>
          <button type="button" onClick={onClose} className="inline-flex h-7 w-7 items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-muted-foreground"><X size={14} /></button>
        </div>
      </div>
      {!minimized && (
        <>
          {status === "sent" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-background p-8">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center"><Check size={32} className="text-primary" /></div>
              <p className="text-lg font-semibold tracking-tight text-foreground">Message sent</p>
            </div>
          ) : (
            <form onSubmit={handleSend} className="flex flex-col flex-1 min-h-0 overflow-hidden bg-background">
              <div className="border-b border-border px-4 py-2 flex-shrink-0 focus-within:bg-muted/20 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="w-8 flex-shrink-0 text-sm font-medium text-muted-foreground">To</span>
                  <input type="email" value={to} onChange={(e) => setTo(e.target.value)} required placeholder="recipient@example.com" className="flex h-9 w-full rounded-md border-0 bg-transparent px-0 py-1 text-sm shadow-none focus-visible:outline-none focus-visible:ring-0 placeholder:text-muted-foreground" />
                </div>
              </div>
              <div className="border-b border-border px-4 py-2 flex-shrink-0 focus-within:bg-muted/20 transition-colors">
                <div className="flex items-center gap-3">
                  <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} required placeholder="Subject" className="flex h-9 w-full rounded-md border-0 bg-transparent px-0 py-1 text-sm font-semibold shadow-none focus-visible:outline-none focus-visible:ring-0 placeholder:text-muted-foreground/60" />
                </div>
              </div>
              <RichTextToolbar editor={editor} />
              <div className="flex-1 min-h-0 overflow-hidden">
                <EditorContent editor={editor} className={(maximized ? "[&>div]:min-h-[400px] " : "") + "h-full min-h-0 overflow-y-auto px-6 py-5 text-sm leading-7"} />
              </div>
              
              {files.length > 0 && (
                <div className="flex flex-wrap gap-2 px-4 py-3 border-t border-border flex-shrink-0 bg-muted/30">
                  {files.map((f, i) => (
                    <div key={i} className="inline-flex items-center gap-1.5 rounded-full bg-background border border-border px-3 py-1 text-xs font-medium text-foreground shadow-sm">
                      <Paperclip size={12} className="text-muted-foreground flex-shrink-0" />
                      <span className="max-w-[120px] truncate">{f.name}</span>
                      <span className="text-muted-foreground ml-1">({formatBytes(f.size)})</span>
                      <button type="button" onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive ml-1 -mr-1 rounded-full p-0.5 hover:bg-muted transition-colors"><X size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex items-center justify-between border-t border-border px-4 py-3 flex-shrink-0 bg-muted/10">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => void handleDiscard()} className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md border border-input bg-background px-4 text-sm font-medium text-destructive shadow-sm transition-colors hover:bg-destructive/10">
                    Discard
                  </button>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-muted-foreground gap-2">
                    <Paperclip size={16} /> Attach
                  </button>
                  <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-background border border-input rounded-md shadow-sm h-9 focus-within:ring-1 focus-within:ring-ring transition-all overflow-hidden">
                    <MaskedDateInput value={scheduleDate} onChange={setScheduleDate} />
                    <MaskedTimeInput value={scheduleTime} onChange={setScheduleTime} />
                    <button type="button" onClick={handleScheduleSend} disabled={status === "sending" || status === "scheduling"} className="inline-flex items-center justify-center px-3 h-full text-xs font-medium text-foreground hover:bg-accent hover:text-accent-foreground border-l border-input transition-colors disabled:opacity-50 bg-background whitespace-nowrap gap-1">
                      {status === "scheduling" ? "..." : <><Clock size={12} /> Schedule</>}
                    </button>
                  </div>
                  <button type="submit" disabled={status === "sending" || status === "scheduling"} className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 gap-2">
                    <Send size={14} /> {status === "sending" ? "Sending..." : "Send"}
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

function AttachmentList({ emailId }: { emailId: Id<"emails"> }) {
  const atts = useQuery(api.emails.getAttachmentUrls, { id: emailId }) as AttachmentUrl[] | undefined;
  if (!atts?.length) return null;
  return (
    <div className="mt-8 border-t border-border pt-6">
      <p className="mb-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{atts.length} Attachments</p>
      <div className="flex flex-wrap gap-3">
        {atts.map((att, i) => (
          <a key={i} href={att.url ?? "#"} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5 text-sm hover:bg-accent transition-colors max-w-[260px] shadow-sm">
            {att.mimeType.startsWith("image/") ? (
              <div className="h-10 w-10 rounded border border-border bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                <img src={att.url ?? ""} alt={att.name} className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                <File size={20} className="text-primary" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{att.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{formatBytes(att.size)}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function InboxView() {
  const { signOut } = useAuthActions();
  const currentUser = useQuery(api.users.getCurrentUser);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<"inbox" | "sent" | "spam" | "scheduled" | "trash" | "drafts">("inbox");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  
  const { results: paginatedEmails, status: paginationStatus, loadMore } = usePaginatedQuery(
    api.emails.listPaginated,
    { folder: currentFolder },
    { initialNumItems: 50 }
  );

  const searchResults = useQuery(api.emails.search, searchQuery ? { query: searchQuery, folder: currentFolder } : "skip");
  const emails = searchQuery ? searchResults : paginatedEmails;
  const isLoadingEmails = searchQuery ? searchResults === undefined : paginationStatus === "LoadingFirstPage";

  const blockedSenders = useQuery(api.emails.getBlockedSenders) || [];

  const markRead = useMutation(api.emails.markRead);
  const markUnread = useMutation(api.emails.markUnread);
  const moveToFolder = useMutation(api.emails.moveToFolder);
  const markSenderAsSpam = useMutation(api.emails.markSenderAsSpam);
  const unmarkSenderAsSpam = useMutation(api.emails.unmarkSenderAsSpam);
  const saveScheduledMutation = useMutation(api.emails.saveScheduled);
  const deletePermanently = useMutation(api.emails.deletePermanently);
  
  const bulkMoveToFolder = useMutation(api.emails.bulkMoveToFolder);
  const bulkMarkRead = useMutation(api.emails.bulkMarkRead);
  const bulkDeletePermanently = useMutation(api.emails.bulkDeletePermanently);

  const [selected, setSelected] = useState<Email | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<Id<"emails">>>(new Set());

  const threadEmailsServer = useQuery(api.emails.listThread, selected?.threadId ? { threadId: selected.threadId } : "skip");
  const threadMails = selected?.threadId && threadEmailsServer ? threadEmailsServer : (selected ? [selected] : []);

  const [expandedEmails, setExpandedEmails] = useState<Set<Id<"emails">>>(new Set());
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  
  const toggleGroup = useCallback((group: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group); else next.add(group);
      return next;
    });
  }, []);
  
  const handleForward = useCallback((email: Email) => {
    const subj = email.subject.startsWith("Fwd:") ? email.subject : "Fwd: " + email.subject;
    setComposePrefill({ to: "", subject: subj, inReplyTo: email.messageId });
    setComposeEditorHtml(`<br><br><div class="gmail_quote"><blockquote class="gmail_quote" style="margin:0px 0px 0px 0.8ex;border-left:1px solid rgb(204,204,204);padding-left:1ex">---------- Forwarded message ---------<br>From: ${email.from}<br>Date: ${new Date(email.receivedAt).toLocaleString()}<br>Subject: ${email.subject}<br>To: ${email.to}<br><br>${email.htmlBody || email.body}</blockquote></div>`);
    setComposeMode("floating");
  }, []);
  const [showHtml, setShowHtml] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.dropdown-container')) {
        setActiveDropdown(null);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => { if (selected) setExpandedEmails(new Set([selected._id])); }, [selected?._id]);

  const toggleExpand = useCallback((id: Id<"emails">) => {
    setExpandedEmails(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const [composeMode, setComposeMode] = useState<null | "floating" | "maximized" | "minimized">(null);
  const [composePrefill, setComposePrefill] = useState<ComposeState | undefined>(undefined);
  const [composeEditorHtml, setComposeEditorHtml] = useState("");
  const [composePosition, setComposePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionStartRef = useRef({ x: 0, y: 0 });

  const handleDragStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (composeMode === "maximized") return;
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;
    isDraggingRef.current = true; setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    positionStartRef.current = { ...composePosition };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [composeMode, composePosition]);

  const handleDragMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    setComposePosition({ x: positionStartRef.current.x + (e.clientX - dragStartRef.current.x), y: positionStartRef.current.y + (e.clientY - dragStartRef.current.y) });
  }, []);

  const handleDragEnd = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false; setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  const openCompose = useCallback((prefill?: ComposeState) => {
    if (composeMode === "minimized") { setComposeMode("floating"); return; }
    setComposePrefill(prefill); setComposeMode("floating");
  }, [composeMode]);

  const closeCompose = useCallback(() => {
    setComposeMode(null); setComposePrefill(undefined); setComposeEditorHtml(""); setComposePosition({ x: 0, y: 0 });
  }, []);

  const toggleMaximize = useCallback(() => { setComposeMode((m) => m === "maximized" ? "floating" : "maximized"); setComposePosition({ x: 0, y: 0 }); }, []);
  const toggleMinimize = useCallback(() => setComposeMode((m) => m === "minimized" ? "floating" : "minimized"), []);

  async function openEmail(email: Email) {
    if (email.folder === "drafts") {
      openCompose({ to: email.to, subject: email.subject, id: email._id });
      setComposeEditorHtml(email.body);
      return;
    }
    setSelected(email); setShowHtml(false);
    if (composeMode === "maximized") setComposeMode("floating");
    if (!email.read) await markRead({ id: email._id });
  }

  function handleReply(email: Email) {
    const subj = email.subject.startsWith("Re:") ? email.subject : "Re: " + email.subject;
    setComposePrefill({ to: email.from, subject: subj, inReplyTo: email.messageId });
    setComposeMode("floating");
  }

  const typedEmails = emails as Email[] | undefined;
  const unread = paginatedEmails?.filter((e) => !e.read).length ?? 0;
  const userEmail = currentUser?.email ?? "";
  const rightPaneIsCompose = composeMode === "maximized";

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      if (e.key.toLowerCase() === "c") { e.preventDefault(); openCompose(); }
      if (e.key.toLowerCase() === "r" && selected) { e.preventDefault(); handleReply(selected); }
      if (e.key.toLowerCase() === "e" && selected && currentFolder !== "trash") {
        e.preventDefault(); moveToFolder({ id: selected._id, folder: "trash" }); setSelected(null); toast.success("Moved to deleted items");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openCompose, handleReply, moveToFolder, selected, currentFolder]);

  async function handleMarkSpam(email: Email) { await moveToFolder({ id: email._id, folder: "spam" }); if (selected?._id === email._id) setSelected(null); toast.success("Moved to junk email"); }
  async function handleUnmarkSpam(email: Email) { await moveToFolder({ id: email._id, folder: "inbox" }); if (selected?._id === email._id) setSelected(null); }
  async function handleSpamSender(email: Email) { if (confirm(`Block ${email.from}?`)) { await markSenderAsSpam({ senderEmail: email.from }); if (selected?.from === email.from) setSelected(null); } }
  async function handleUnmarkSpamSender(email: Email) { if (confirm(`Unblock ${email.from}?`)) { await unmarkSenderAsSpam({ senderEmail: email.from }); if (selected?.from === email.from) setSelected(null); } }

  const toggleSelect = (id: Id<"emails">, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };
  
  const selectAll = () => {
    if (selectedIds.size === (typedEmails?.length ?? 0)) setSelectedIds(new Set());
    else setSelectedIds(new Set(typedEmails?.map(e => e._id) ?? []));
  };

  const handleBulkMarkRead = async (read: boolean) => { await bulkMarkRead({ ids: Array.from(selectedIds), read }); setSelectedIds(new Set()); toast.success(`Marked ${selectedIds.size} items as ${read ? 'read' : 'unread'}`); };
  const handleBulkMove = async (folder: string) => { await bulkMoveToFolder({ ids: Array.from(selectedIds), folder }); setSelectedIds(new Set()); if (selected && selectedIds.has(selected._id)) setSelected(null); toast.success(`Moved ${selectedIds.size} items`); };
  const handleBulkDeletePermanently = async () => {
    await bulkDeletePermanently({ ids: Array.from(selectedIds) });
    const count = selectedIds.size;
    setSelectedIds(new Set());
    if (selected && selectedIds.has(selected._id)) setSelected(null);
    toast.success(`Permanently deleted ${count} items`);
  };

  const getTrashDaysRemaining = (email: Email) => {
    const msInDay = 24 * 60 * 60 * 1000;
    const deletedAt = email.deletedAt ?? email.receivedAt;
    const ageDays = Math.floor((Date.now() - deletedAt) / msInDay);
    return Math.max(0, 30 - ageDays);
  };

  const FolderItem = ({ id, icon, label, count }: { id: typeof currentFolder, icon: React.ReactNode, label: string, count?: number }) => (
    <button 
      onClick={() => { setCurrentFolder(id); setSelected(null); setSelectedIds(new Set()); setSearchQuery(""); setSearchInput(""); }} 
      className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors ${currentFolder === id && !searchQuery ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
    >
      <div className="flex items-center gap-2">
        <span className={currentFolder === id && !searchQuery ? 'text-primary' : 'text-muted-foreground'}>{icon}</span>
        <span>{label}</span>
      </div>
      {count !== undefined && count > 0 && (
        <span className={`text-xs px-2 py-0.5 rounded-full ${currentFolder === id && !searchQuery ? 'bg-primary/20 text-primary font-semibold' : 'bg-muted text-muted-foreground font-medium'}`}>{count}</span>
      )}
    </button>
  );

  // Group emails by date
  const groupedEmails = (() => {
    if (!typedEmails || typedEmails.length === 0) return {};
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const thisWeekStart = todayStart - 86400000 * 7;
    const lastWeekStart = todayStart - 86400000 * 14;
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const groups: Record<string, Email[]> = {
      "Today": [],
      "Yesterday": [],
      "This Week": [],
      "Last Week": [],
      "This Month": [],
      "Older": []
    };

    typedEmails.forEach(e => {
      const time = e.scheduledAt || e.receivedAt;
      if (time >= todayStart) groups["Today"].push(e);
      else if (time >= yesterdayStart) groups["Yesterday"].push(e);
      else if (time >= thisWeekStart) groups["This Week"].push(e);
      else if (time >= lastWeekStart) groups["Last Week"].push(e);
      else if (time >= thisMonthStart) groups["This Month"].push(e);
      else groups["Older"].push(e);
    });

    return Object.fromEntries(Object.entries(groups).filter(([_, list]) => list.length > 0));
  })();

  return (
    <div className="flex h-screen flex-col bg-background text-foreground font-sans overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-2 flex-shrink-0 z-20 shadow-sm h-14">
        <div className="flex items-center gap-4 w-56">
          <button type="button" onClick={() => setIsSidebarCollapsed((value) => !value)} className="p-2 -ml-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {isSidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary/10 p-1.5 text-primary"><BrandMailIcon className="h-[18px] w-[18px]"/></div>
            <span className="text-lg font-bold tracking-tight text-foreground">KoolMail</span>
          </div>
        </div>
        
        <div className="flex-1 max-w-[600px] mx-8 relative flex items-center">
          <div className="relative w-full">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
            <input 
              type="text" 
              placeholder="Search in mail" 
              className="flex h-9 w-full rounded-md border border-input bg-muted/40 hover:bg-muted/80 focus:bg-background px-3 py-1 pl-9 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setSearchQuery(searchInput)}
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm hidden sm:block font-medium text-foreground">{userEmail}</span>
          <button onClick={() => void signOut()} className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md px-3 text-xs font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background shadow-sm">Sign out</button>
        </div>
      </header>

      {/* Top Action Bar */}
      <div className="relative z-40 flex items-center gap-1.5 px-4 py-2 border-b border-border bg-card flex-shrink-0 overflow-visible min-h-[48px]">
        <div className="relative dropdown-container">
          <button onClick={() => setActiveDropdown(activeDropdown === 'new-mail' ? null : 'new-mail')} className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors gap-1.5">
            <FileEdit size={14} /> New message <ChevronDown size={14} className="opacity-70 ml-1" />
          </button>
          {activeDropdown === 'new-mail' && (
            <div className="absolute left-0 top-full mt-1 w-48 bg-popover text-popover-foreground rounded-md shadow-md border border-border z-[60] p-1">
              <button onClick={() => { setActiveDropdown(null); openCompose(); }} className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm flex items-center gap-2 transition-colors"><Mail size={14}/> Message</button>
            </div>
          )}
        </div>
        
        <div className="w-px h-5 bg-border mx-2 flex-shrink-0" />
        
        <div className="flex items-center gap-1">
          <button onClick={() => {
            if (currentFolder === "trash") {
              if (selectedIds.size > 0) {
                handleBulkMove("inbox");
              } else if (selected) {
                moveToFolder({ id: selected._id, folder: "inbox" });
                setSelected(null);
              }
              return;
            }
            if (selectedIds.size > 0) handleBulkMove('trash');
            else if (selected) { moveToFolder({id: selected._id, folder: 'trash'}); setSelected(null); }
          }} className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 gap-1.5 text-muted-foreground" disabled={!selected && selectedIds.size === 0}>
            {currentFolder === "trash" ? <Undo size={14} /> : <Trash2 size={14} />} {currentFolder === "trash" ? "Restore" : "Delete"}
          </button>

          {currentFolder === "trash" && (
            <button
              onClick={() => {
                if (selectedIds.size > 0) {
                  void handleBulkDeletePermanently();
                } else if (selected) {
                  void deletePermanently({ id: selected._id });
                  setSelected(null);
                  toast.success("Permanently deleted");
                }
              }}
              className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md px-3 text-xs font-medium transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50 gap-1.5 text-destructive"
              disabled={!selected && selectedIds.size === 0}
            >
              <Trash2 size={14} /> Delete forever
            </button>
          )}

          <div className="relative dropdown-container">
            <button onClick={() => { if(selected || selectedIds.size > 0) setActiveDropdown(activeDropdown === 'report' ? null : 'report'); }} className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 gap-1.5 text-muted-foreground" disabled={!selected && selectedIds.size === 0}>
              <AlertOctagon size={14} /> Report <ChevronDown size={14} className="opacity-70 ml-1" />
            </button>
            {activeDropdown === 'report' && (
              <div className="absolute left-0 top-full mt-1 w-48 bg-popover text-popover-foreground rounded-md shadow-md border border-border z-[60] p-1">
                <button onClick={() => { setActiveDropdown(null); if (selectedIds.size > 0) handleBulkMove('spam'); else if (selected) handleMarkSpam(selected); }} className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm flex items-center gap-2 text-destructive"><ShieldAlert size={14}/> Report junk</button>
              </div>
            )}
          </div>
        </div>

        <div className="w-px h-5 bg-border mx-2 flex-shrink-0" />
        
        <div className="flex items-center gap-1">
          <div className="relative dropdown-container">
            <button onClick={() => { if(selected || selectedIds.size > 0) setActiveDropdown(activeDropdown === 'move-to' ? null : 'move-to'); }} className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 gap-1.5 text-muted-foreground" disabled={!selected && selectedIds.size === 0}>
              Move to <ChevronDown size={14} className="opacity-70 ml-1" />
            </button>
            {activeDropdown === 'move-to' && (
              <div className="absolute left-0 top-full mt-1 w-48 bg-popover text-popover-foreground rounded-md shadow-md border border-border z-[60] p-1">
                <button onClick={() => { setActiveDropdown(null); if (selectedIds.size > 0) handleBulkMove('inbox'); else if (selected) { moveToFolder({id: selected._id, folder: 'inbox'}); setSelected(null); } }} className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm flex items-center gap-2"><Mail size={14}/> Inbox</button>
                <button onClick={() => { setActiveDropdown(null); if (selectedIds.size > 0) handleBulkMove('trash'); else if (selected) { moveToFolder({id: selected._id, folder: 'trash'}); setSelected(null); } }} className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm flex items-center gap-2"><Trash2 size={14}/> Deleted items</button>
              </div>
            )}
          </div>

          <div className="relative dropdown-container">
            <button onClick={() => { if(selected) setActiveDropdown(activeDropdown === 'reply' ? null : 'reply'); }} className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 gap-1.5 text-muted-foreground" disabled={!selected}>
              <CornerUpLeft size={14} /> Reply <ChevronDown size={14} className="opacity-70 ml-1" />
            </button>
            {activeDropdown === 'reply' && (
              <div className="absolute left-0 top-full mt-1 w-48 bg-popover text-popover-foreground rounded-md shadow-md border border-border z-[60] p-1">
                <button onClick={() => { setActiveDropdown(null); handleReply(selected!); }} className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm flex items-center gap-2"><CornerUpLeft size={14}/> Reply</button>
                <button onClick={() => { setActiveDropdown(null); handleReply(selected!); }} className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm flex items-center gap-2"><CornerUpLeft size={14}/> Reply all</button>
                <button onClick={() => { setActiveDropdown(null); handleForward(selected!); }} className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm flex items-center gap-2"><Forward size={14}/> Forward</button>
              </div>
            )}
          </div>
        </div>

        {currentFolder === "trash" && (
          <div className="ml-auto flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs text-destructive">
            <span>Deleted items auto-remove in 30 days. Restore or delete forever anytime.</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden bg-background">
        {/* Sidebar */}
        {!isSidebarCollapsed && (
          <div className="w-64 bg-muted/10 border-r border-border flex flex-col py-3 flex-shrink-0 z-10">
            <nav className="flex flex-col gap-1 px-3 overflow-y-auto flex-1">
              <div className="flex items-center gap-2 px-2 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-6">
                Folders
              </div>
              <FolderItem id="inbox" icon={<FolderGlyph />} label="Inbox" count={unread} />
              <FolderItem id="spam" icon={<AlertOctagon size={18} />} label="Junk Email" />
              <FolderItem id="drafts" icon={<FolderGlyph />} label="Drafts" />
              <FolderItem id="sent" icon={<Send size={18} />} label="Sent Items" />
              <FolderItem id="trash" icon={<TrashGlyph />} label="Deleted Items" />
              <FolderItem id="scheduled" icon={<Clock size={18} />} label="Scheduled" />
            </nav>
          </div>
        )}

        {/* Email List */}
        <div className="w-[400px] xl:w-[440px] flex-shrink-0 border-r border-border bg-background flex flex-col z-0">
          <div className="px-5 py-3 flex items-center justify-between border-b border-border bg-background flex-shrink-0 z-10">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tracking-tight text-foreground border-b-2 border-primary pb-1 -mb-1">Focused</span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
               <CheckSquare size={16} className="cursor-pointer hover:text-foreground transition-colors" onClick={selectAll} />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {isLoadingEmails && <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>}
            {!isLoadingEmails && Object.keys(groupedEmails).length === 0 && (
              <div className="flex flex-col items-center justify-center p-12 text-center gap-4">
                <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center">
                  <Mail size={40} className="text-muted-foreground/50" />
                </div>
                <p className="text-base font-medium text-muted-foreground">{searchQuery ? "No results found" : "Nothing to see here"}</p>
              </div>
            )}
            
            {!isLoadingEmails && Object.entries(groupedEmails).map(([groupTitle, groupMails]) => (
              <div key={groupTitle}>
                <div onClick={() => toggleGroup(groupTitle)} className="flex items-center gap-2 px-5 py-2.5 bg-muted/30 sticky top-0 z-10 border-b border-border cursor-pointer hover:bg-muted/50 transition-colors backdrop-blur-[2px]">
                  {collapsedGroups.has(groupTitle) ? <ChevronRight size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{groupTitle}</span>
                </div>
                {!collapsedGroups.has(groupTitle) && groupMails.map((email) => {
                  const isSelected = selected?._id === email._id;
                  const isChecked = selectedIds.has(email._id);
                  const showRecipient = currentFolder === "sent" || currentFolder === "drafts" || currentFolder === "scheduled";
                  
                  return (
                    <div key={email._id} className="relative group">
                      <button 
                        onClick={() => openEmail(email)} 
                        className={`w-full text-left border-b border-border p-4 transition-colors flex flex-col relative ${isSelected ? 'bg-accent/50 hover:bg-accent border-l-2 border-l-primary z-10' : isChecked ? 'bg-accent/30' : 'bg-background hover:bg-muted/50'}`}
                      >
                        {!email.read && !isSelected && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary" />}
                        
                        <div className="flex justify-between items-center mb-1.5 pl-6">
                          <div className="flex items-center gap-3 truncate pr-4">
                            {!showRecipient && <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold uppercase flex-shrink-0">{email.from.charAt(0)}</div>}
                            <span className={`text-sm truncate ${!email.read ? 'font-bold text-foreground' : 'font-medium text-foreground/80'}`}>
                              {showRecipient ? email.to || "(No recipient)" : email.from}
                            </span>
                          </div>
                          <span className={`text-xs whitespace-nowrap flex-shrink-0 ${!email.read ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                            {new Date(email.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        
                        <div className="pl-[52px]">
                          <div className={`text-sm truncate mb-1 ${!email.read ? 'font-bold text-primary' : 'text-foreground'}`}>
                            {email.subject || "(No subject)"}
                          </div>
                          <div className="text-xs text-muted-foreground truncate flex items-center gap-1.5 font-medium">
                            {email.attachments && email.attachments.length > 0 && <Paperclip size={12} className="flex-shrink-0" />}
                            {email.body.replace(/<[^>]*>?/gm, '').slice(0, 100)}
                          </div>
                          {currentFolder === "trash" && (
                            <div className="mt-1 text-[11px] font-medium text-destructive/80">
                              Auto-delete in {getTrashDaysRemaining(email)} day{getTrashDaysRemaining(email) === 1 ? "" : "s"}
                            </div>
                          )}
                        </div>
                      </button>
                      <div className={`absolute left-3 top-5 z-10 ${isChecked || isSelected ? 'block' : 'hidden group-hover:block'}`}>
                        <div className="bg-background rounded-sm w-4 h-4 flex items-center justify-center border border-input shadow-sm">
                           <input type="checkbox" checked={isChecked} onChange={(e) => toggleSelect(email._id, e as any)} onClick={(e) => e.stopPropagation()} className="w-4 h-4 rounded-sm border-input text-primary focus:ring-primary focus:ring-offset-background cursor-pointer" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            {!searchQuery && paginationStatus === "CanLoadMore" && (
              <button onClick={() => loadMore(20)} className="w-full py-5 text-sm text-primary font-semibold hover:bg-muted/50 transition-colors">
                Load more messages
              </button>
            )}
          </div>
        </div>

        {/* Right pane: compose (maximized) OR email reader */}
        <div className="flex-1 bg-muted/20 overflow-hidden flex flex-col min-w-0 shadow-sm relative z-0">
          {rightPaneIsCompose ? (
            <ComposeForm fromEmail={userEmail} maximized minimized={false} onToggleMaximize={toggleMaximize} onToggleMinimize={toggleMinimize} onClose={closeCompose} prefill={composePrefill} initialHtml={composeEditorHtml} onEditorChange={setComposeEditorHtml} onScheduleSend={saveScheduledMutation} />
          ) : selected ? (
            <div className="flex flex-col h-full overflow-y-auto p-4">
              {/* Subject Header Card */}
              <div className="bg-card rounded-xl shadow-sm border border-border px-6 py-5 flex-shrink-0 flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-foreground leading-tight" title={selected.subject}>{selected.subject || "(No subject)"}</h2>
                  <div className="inline-flex items-center mt-3 px-2.5 py-0.5 bg-accent text-accent-foreground text-xs font-semibold uppercase tracking-wider rounded-md border border-border">Inbox</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 dropdown-container relative">
                  <button onClick={() => setActiveDropdown(activeDropdown === 'top-more' ? null : 'top-more')} className="inline-flex h-8 w-8 items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 text-muted-foreground"><MoreHorizontal size={18}/></button>
                  {activeDropdown === 'top-more' && (
                     <div className="absolute right-0 top-10 mt-1 w-48 bg-popover text-popover-foreground rounded-md shadow-md border border-border z-50 p-1">
                       {selected.folder === "trash" ? (
                         <>
                           <button onClick={() => { setActiveDropdown(null); moveToFolder({id: selected._id, folder: 'inbox'}); setSelected(null); }} className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm flex items-center gap-2"><Undo size={14}/> Restore</button>
                           <button onClick={() => { setActiveDropdown(null); void deletePermanently({id: selected._id}); setSelected(null); toast.success("Permanently deleted"); }} className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm flex items-center gap-2 text-destructive"><Trash2 size={14}/> Delete forever</button>
                         </>
                       ) : (
                         <>
                           <button onClick={() => { setActiveDropdown(null); moveToFolder({id: selected._id, folder: 'trash'}); setSelected(null); }} className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm flex items-center gap-2 text-destructive"><Trash2 size={14}/> Delete</button>
                           <button onClick={() => { setActiveDropdown(null); handleMarkSpam(selected); }} className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm flex items-center gap-2"><ShieldAlert size={14}/> Junk</button>
                         </>
                       )}
                     </div>
                  )}
                </div>
              </div>

              {/* Email Threads/Cards */}
              <div className="flex-1 space-y-4 pb-12">
                {threadMails.map((email, idx) => {
                  const isExpanded = expandedEmails.has(email._id) || threadMails.length === 1;
                  return (
                    <div key={email._id} id={email._id} className={"bg-card rounded-xl shadow-sm border border-border overflow-hidden transition-all " + (isExpanded ? "ring-1 ring-border" : "")}>
                       <div onClick={() => toggleExpand(email._id)} className={"px-6 py-5 flex items-start justify-between " + (isExpanded ? "bg-muted/10 border-b border-border" : "cursor-pointer hover:bg-muted/40 transition-colors")}>
                          <div className="flex items-center gap-4 overflow-hidden">
                             <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold uppercase flex-shrink-0 border border-primary/20">
                               {email.from.charAt(0)}
                             </div>
                             <div className="min-w-0">
                               <div className="font-semibold text-foreground text-sm truncate">{email.from}</div>
                               {isExpanded && <div className="text-xs font-medium text-muted-foreground truncate mt-1">To: You</div>}
                             </div>
                          </div>
                          <div className="flex items-start gap-4">
                             <span className="text-muted-foreground text-xs font-medium whitespace-nowrap pt-1.5">
                               {new Date(email.receivedAt).toLocaleString(undefined, { weekday: isExpanded ? 'short' : undefined, month: 'short', day: 'numeric', year: isExpanded ? 'numeric' : undefined, hour: 'numeric', minute: '2-digit' })}
                             </span>
                             {isExpanded && (
                               <div className="flex items-center gap-1">
                                  <button onClick={(e) => { e.stopPropagation(); handleReply(email); }} className="inline-flex h-8 w-8 items-center justify-center whitespace-nowrap rounded-md transition-colors hover:bg-accent text-muted-foreground hover:text-foreground" title="Reply"><CornerUpLeft size={16}/></button>
                                  <button onClick={(e) => { e.stopPropagation(); handleReply(email); }} className="inline-flex h-8 w-8 items-center justify-center whitespace-nowrap rounded-md transition-colors hover:bg-accent text-muted-foreground hover:text-foreground" title="Reply All"><CornerUpRight size={16}/></button>
                                  <div className="relative dropdown-container">
                                    <button onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === 'email-more-' + email._id ? null : 'email-more-' + email._id); }} className="inline-flex h-8 w-8 items-center justify-center whitespace-nowrap rounded-md transition-colors hover:bg-accent text-muted-foreground hover:text-foreground"><MoreHorizontal size={16}/></button>
                                    {activeDropdown === 'email-more-' + email._id && (
                                       <div className="absolute right-0 mt-1 w-48 bg-popover text-popover-foreground rounded-md shadow-md border border-border z-50 p-1">
                                         <button onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); handleReply(email); }} className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm flex items-center gap-2"><CornerUpLeft size={14}/> Reply</button>
                                         <button onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); handleForward(email); }} className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm flex items-center gap-2"><Forward size={14}/> Forward</button>
                                         <button onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); markUnread({id: email._id}); setSelected({...selected, read: false}); }} className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm flex items-center gap-2"><Mail size={14}/> Mark as unread</button>
                                         <div className="h-px bg-border my-1" />
                                         {email.folder === "trash" ? (
                                           <>
                                             <button onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); moveToFolder({id: email._id, folder: 'inbox'}); setSelected(null); }} className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm flex items-center gap-2"><Undo size={14}/> Restore</button>
                                             <button onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); void deletePermanently({id: email._id}); setSelected(null); toast.success("Permanently deleted"); }} className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm flex items-center gap-2 text-destructive"><Trash2 size={14}/> Delete forever</button>
                                           </>
                                         ) : (
                                           <button onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); moveToFolder({id: email._id, folder: 'trash'}); setSelected(null); }} className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm flex items-center gap-2 text-destructive"><Trash2 size={14}/> Delete</button>
                                         )}
                                       </div>
                                    )}
                                  </div>
                               </div>
                             )}
                          </div>
                       </div>
                       {isExpanded && (
                         <div className="px-6 pb-6 pt-4 bg-card">
                            {showHtml && email.htmlBody ? (
                              <iframe srcDoc={email.htmlBody} sandbox="allow-same-origin" className="w-full min-h-[400px] border-0 bg-transparent" title="HTML email" />
                            ) : (
                              <div dangerouslySetInnerHTML={{ __html: email.htmlBody || email.body }} className="whitespace-pre-wrap text-sm text-foreground/90 font-sans leading-relaxed [&>blockquote]:border-l-4 [&>blockquote]:border-muted [&>blockquote]:pl-4 [&>blockquote]:text-muted-foreground [&>blockquote]:italic" />
                            )}
                            {email.attachments?.length ? <AttachmentList emailId={email._id} /> : null}
                            
                            {/* Bottom Action Buttons */}
                            <div className="mt-8 flex items-center gap-3 border-t border-border pt-6">
                              <button onClick={() => handleReply(email)} className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md px-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground border border-input bg-background shadow-sm gap-2">
                                <CornerUpLeft size={16} className="text-muted-foreground" /> Reply
                              </button>
                              <button onClick={() => handleForward(email)} className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md px-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground border border-input bg-background shadow-sm gap-2">
                                <Forward size={16} className="text-muted-foreground" /> Forward
                              </button>
                            </div>
                         </div>
                       )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center px-8 bg-background">
              <div className="h-32 w-32 mb-6 opacity-50">
                <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <rect x="14" y="22" width="92" height="68" rx="16" className="fill-muted/60" />
                  <rect x="14" y="22" width="92" height="68" rx="16" className="stroke-border" strokeWidth="2" />
                  <path d="M24 34L60 58L96 34" className="stroke-foreground/30" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M24 78L46 58" className="stroke-foreground/30" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M96 78L74 58" className="stroke-foreground/30" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M28 48H50" className="stroke-foreground/25" strokeWidth="4" strokeLinecap="round" />
                  <path d="M28 62H66" className="stroke-foreground/25" strokeWidth="4" strokeLinecap="round" />
                  <path d="M28 76H40" className="stroke-foreground/25" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-foreground tracking-tight">Select an item to read</p>
              <p className="text-sm text-muted-foreground mt-2 max-w-[250px]">Click on any email in the list to view its contents right here.</p>
            </div>
          )}
        </div>
      </div>

      {/* Floating compose panel */}
      {(composeMode === "floating" || composeMode === "minimized") && (
        <div style={{ transform: `translate(${composePosition.x}px, ${composePosition.y}px)` }} className={"fixed bottom-0 right-16 z-50 origin-bottom-right " + (isDragging ? "" : "transition-transform duration-300 ") + (composeMode === "minimized" ? "w-[280px] h-[40px]" : "w-[600px] h-[520px] max-h-[85vh] flex flex-col")}>
          <ComposeForm fromEmail={userEmail} maximized={false} minimized={composeMode === "minimized"} onToggleMaximize={toggleMaximize} onToggleMinimize={toggleMinimize} onClose={closeCompose} prefill={composePrefill} initialHtml={composeEditorHtml} onEditorChange={setComposeEditorHtml} onScheduleSend={saveScheduledMutation} onDragStart={handleDragStart} onDragMove={handleDragMove} onDragEnd={handleDragEnd} />
        </div>
      )}
    </div>
  );
}

export default function InboxPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <LoginForm />;
  return <InboxView />;
}
