"use client";

import { useState } from "react";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import Link from "next/link";

const DOMAIN = "koolname.asia";

type Email = {
  _id: Id<"emails">;
  from: string;
  to: string;
  subject: string;
  body: string;
  receivedAt: number;
  read: boolean;
};

function LoginForm() {
  const { signIn } = useAuthActions();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Validate username: only lowercase letters, numbers, dots, hyphens, underscores
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
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        {/* Logo / title */}
        <h1 className="mb-1 text-2xl font-semibold text-zinc-900">
          {mode === "signin" ? "Sign in" : "Create account"}
        </h1>
        <p className="mb-6 text-sm text-zinc-500">
          {mode === "signin"
            ? `Sign in to your @${DOMAIN} inbox.`
            : `Pick a username — your email will be username@${DOMAIN}.`}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 uppercase tracking-wide">
              Username
            </label>
            <div className="flex rounded-lg border border-zinc-300 focus-within:ring-2 focus-within:ring-zinc-900 overflow-hidden">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                placeholder="yourname"
                required
                autoComplete="username"
                className="flex-1 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
              />
              <span className="flex items-center bg-zinc-50 px-3 text-sm text-zinc-400 border-l border-zinc-300 select-none">
                @{DOMAIN}
              </span>
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 uppercase tracking-wide">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters"
              required
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          {/* Confirm password — only on sign up */}
          {mode === "signup" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500 uppercase tracking-wide">
                Confirm password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                required
                autoComplete="new-password"
                className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
          >
            {loading
              ? mode === "signup" ? "Creating…" : "Signing in…"
              : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        {/* Toggle mode */}
        <p className="mt-5 text-center text-sm text-zinc-500">
          {mode === "signin" ? (
            <>
              No account?{" "}
              <button
                onClick={() => { setMode("signup"); setError(""); }}
                className="font-medium text-zinc-900 hover:underline"
              >
                Create one
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                onClick={() => { setMode("signin"); setError(""); setConfirmPassword(""); }}
                className="font-medium text-zinc-900 hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function InboxView() {
  const { signOut } = useAuthActions();
  const currentUser = useQuery(api.users.getCurrentUser);
  const emails = useQuery(api.emails.list);
  const markRead = useMutation(api.emails.markRead);
  const [selected, setSelected] = useState<Email | null>(null);

  async function openEmail(email: Email) {
    setSelected(email);
    if (!email.read) await markRead({ id: email._id });
  }

  const typedEmails = emails as Email[] | undefined;
  const unread = typedEmails?.filter((e) => !e.read).length ?? 0;
  const userEmail = currentUser?.email ?? "";

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-zinc-900">Inbox</span>
          {unread > 0 && (
            <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white">
              {unread}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-500">{userEmail}</span>
          <Link
            href="/compose"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
          >
            Compose
          </Link>
          <button
            onClick={() => void signOut()}
            className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-full max-w-md border-r border-zinc-200 bg-white overflow-y-auto">
          {emails === undefined && (
            <p className="px-6 py-8 text-sm text-zinc-400">Loading…</p>
          )}
          {typedEmails?.length === 0 && (
            <p className="px-6 py-8 text-sm text-zinc-400">Your inbox is empty.</p>
          )}
          {typedEmails?.map((email) => (
            <button
              key={email._id}
              onClick={() => openEmail(email)}
              className={`w-full border-b border-zinc-100 px-6 py-4 text-left transition-colors hover:bg-zinc-50 ${
                selected?._id === email._id ? "bg-zinc-50" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm ${ email.read ? "text-zinc-500" : "font-semibold text-zinc-900"}`}>
                  {email.from}
                </span>
                <span className="text-xs text-zinc-400">
                  {new Date(email.receivedAt).toLocaleDateString()}
                </span>
              </div>
              <p className={`text-sm truncate ${email.read ? "text-zinc-400" : "font-medium text-zinc-700"}`}>
                {email.subject}
              </p>
              <p className="mt-0.5 text-xs text-zinc-400 truncate">{email.body.slice(0, 80)}</p>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          {selected ? (
            <div className="max-w-2xl">
              <button
                onClick={() => setSelected(null)}
                className="mb-4 text-sm text-zinc-400 hover:text-zinc-700 transition-colors"
              >
                ← Back
              </button>
              <h2 className="text-xl font-semibold text-zinc-900 mb-2">{selected.subject}</h2>
              <div className="mb-1 text-sm text-zinc-500">
                <span className="font-medium text-zinc-700">From:</span> {selected.from}
              </div>
              <div className="mb-4 text-sm text-zinc-500">
                <span className="font-medium text-zinc-700">Date:</span>{" "}
                {new Date(selected.receivedAt).toLocaleString()}
              </div>
              <hr className="border-zinc-200 mb-4" />
              <pre className="whitespace-pre-wrap text-sm text-zinc-700 font-sans leading-relaxed">
                {selected.body}
              </pre>
            </div>
          ) : (
            <p className="text-sm text-zinc-400">Select an email to read it.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function InboxPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <LoginForm />;
  return <InboxView />;
}
