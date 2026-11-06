"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { AtSign, CalendarDays, Camera, Check, School } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, FieldLabel } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { updateProfile } from "@/lib/supabase/profiles";
import type { CurrentProfile } from "@/lib/supabase/auth";

/**
 * Real profile view + working edit (persists to `profiles`).
 * Still no sender-history anywhere — anonymity is preserved.
 */
export function ProfileEditor({
  profile,
  usage,
}: {
  profile: CurrentProfile;
  usage: { used: number; limit: number };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [username, setUsername] = useState(profile.username);
  const [className, setClassName] = useState(profile.className);

  const joined = new Date(profile.createdAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateProfile({ username, displayName, className });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setEditing(false);
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2600);
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-sm font-medium text-ink-soft">Your corner of 2K27.</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-ink sm:text-4xl">Profile</h1>
      </header>

      {/* Identity card */}
      <motion.section
        aria-label="Identity"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="overflow-hidden rounded-2xl border border-line bg-paper-elevated shadow-[var(--shadow-card)]"
      >
        <div className="h-20 bg-gradient-to-r from-accent/20 via-joke-soft to-observation-soft" aria-hidden="true" />
        <div className="-mt-8 px-5 pb-5 sm:px-6 sm:pb-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-end gap-3">
              <Avatar name={profile.displayName} size="lg" className="ring-4 ring-paper-elevated" />
              <div className="pb-1">
                <h2 className="text-xl font-black tracking-tight text-ink">{profile.displayName}</h2>
                <p className="text-sm text-ink-faint">@{profile.username}</p>
              </div>
            </div>
            <div className="flex gap-2 pb-1">
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                <Camera className="h-4 w-4" aria-hidden="true" />
                Edit profile
              </Button>
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-paper px-3.5 py-3">
              <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                <AtSign className="h-3.5 w-3.5" aria-hidden="true" /> Username
              </dt>
              <dd className="mt-0.5 font-semibold text-ink">{profile.username}</dd>
            </div>
            <div className="rounded-xl bg-paper px-3.5 py-3">
              <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                <School className="h-3.5 w-3.5" aria-hidden="true" /> Class
              </dt>
              <dd className="mt-0.5 font-semibold text-ink">{profile.className}</dd>
            </div>
            <div className="rounded-xl bg-paper px-3.5 py-3">
              <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> Joined
              </dt>
              <dd className="mt-0.5 font-semibold text-ink">{joined}</dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-soft">
            <span className="rounded-full bg-ink px-2.5 py-1 text-paper">{profile.role}</span>
            <span>
              {usage.used}/{usage.limit} submissions used today
            </span>
          </div>

          {saved && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-compliment-soft px-3 py-1.5 text-sm font-semibold text-compliment"
              role="status"
            >
              <Check className="h-4 w-4" aria-hidden="true" /> Profile saved.
            </motion.p>
          )}
        </div>
      </motion.section>

      {/* Privacy note */}
      <Card className="bg-paper">
        <CardBody>
          <p className="text-sm leading-relaxed text-ink-soft">
            <span className="font-bold text-ink">Your submissions stay anonymous.</span> This page
            never shows who wrote what about whom — not even to you. Admins can investigate
            abuse, but the public feed never reveals senders.
          </p>
        </CardBody>
      </Card>

      {/* Edit modal */}
      <Modal open={editing} onClose={() => setEditing(false)} title="Edit profile">
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div>
            <FieldLabel htmlFor="profile-display">Display name</FieldLabel>
            <Input
              id="profile-display"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value.slice(0, 60))}
              required
              minLength={1}
            />
          </div>
          <div>
            <FieldLabel htmlFor="profile-username">Username</FieldLabel>
            <Input
              id="profile-username"
              value={username}
              onChange={(e) => setUsername(e.target.value.slice(0, 30))}
              required
              minLength={3}
            />
            <p className="mt-1 text-xs text-ink-faint">3–30 characters. Used for mentions, never for sender identity.</p>
          </div>
          <div>
            <FieldLabel htmlFor="profile-class">Class</FieldLabel>
            <Input
              id="profile-class"
              value={className}
              onChange={(e) => setClassName(e.target.value.slice(0, 40))}
              required
              minLength={1}
            />
          </div>
          {error && (
            <p
              className="rounded-xl bg-roast-soft px-4 py-3 text-sm font-semibold text-roast"
              role="alert"
            >
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
