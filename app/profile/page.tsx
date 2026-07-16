"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import ProfileForm from "./form"
import UserCrawls from "./UserCrawls"
import SavedProperties from "./SavedProperties"
import RoamPassport from "./RoamPassport"
import FavoritesSection from "./FavoritesSection"
import VisitHistorySection from "@/components/profile/VisitHistorySection"
import ProfileSnapshotLibrary, {
  type ProfileSnapshot,
} from "@/components/profile/ProfileSnapshotLibrary"
import { supabaseBrowser } from "@/lib/supabase/client"
import { logEvent } from "@/lib/logEvent"

type SnapshotRow = {
  id: string
  title: string | null
  city: string | null
  cover_image_url: string | null
  route_summary: string | null
  checked_in_count: number | null
  total_stops: number | null
  visibility: string | null
  source_type: string | null
  source_id: string | null
  created_at: string
  updated_at: string | null
}

function safeLogEvent(
  eventName: string,
  metadata: Record<string, unknown> = {}
) {
  try {
    void Promise.resolve(logEvent(eventName, { metadata }))
  } catch (error) {
    console.warn("logEvent failed:", eventName, error)
  }
}

export default function UserProfilePage() {
  const [username, setUsername] = useState<string | null>(null)
  const [snapshots, setSnapshots] = useState<ProfileSnapshot[]>([])
  const [snapshotsLoading, setSnapshotsLoading] = useState(true)
  const [snapshotsError, setSnapshotsError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    safeLogEvent("profile_page_viewed")

    async function loadProfilePageData() {
      const supabase = supabaseBrowser()

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (cancelled) return

      if (authError || !user) {
        if (authError) {
          console.error(
            "[profile/page] Failed to load authenticated user:",
            authError
          )
        }

        setSnapshotsLoading(false)
        return
      }

      const [profileResult, snapshotsResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .maybeSingle(),

        supabase
          .from("flow_snapshots")
          .select(`
            id,
            title,
            city,
            cover_image_url,
            route_summary,
            checked_in_count,
            total_stops,
            visibility,
            source_type,
            source_id,
            created_at,
            updated_at
          `)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ])

      if (cancelled) return

      if (profileResult.error) {
        console.error(
          "[profile/page] Failed to load username:",
          profileResult.error
        )
      }

      setUsername(profileResult.data?.username ?? null)

      if (snapshotsResult.error) {
        console.error(
          "[profile/page] Failed to load snapshot library:",
          snapshotsResult.error
        )

        setSnapshots([])
        setSnapshotsError("Failed to load your snapshot library.")
        setSnapshotsLoading(false)
        return
      }

      const normalizedSnapshots = (
        (snapshotsResult.data ?? []) as SnapshotRow[]
      ).map(normalizeSnapshot)

      setSnapshots(normalizedSnapshots)
      setSnapshotsError(null)
      setSnapshotsLoading(false)

      safeLogEvent("profile_snapshot_library_loaded", {
        snapshot_count: normalizedSnapshots.length,
        public_snapshot_count: normalizedSnapshots.filter(
          (snapshot) => snapshot.visibility === "public"
        ).length,
      })
    }

    void loadProfilePageData()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute left-[-12%] top-[-10%] h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute right-[-15%] top-[20%] h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl space-y-8 px-4 pb-12 pt-[calc(4rem+env(safe-area-inset-top)+1rem)] sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-400">
              Roam Profile
            </p>

            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Your Passport
            </h1>

            <p className="max-w-2xl text-sm leading-6 text-neutral-400">
              Track your movement, hosted flows, saved guides, badges, and city
              progress.
            </p>
          </div>

          {username ? (
            <Link
              href={`/u/${username}`}
              onClick={() =>
                safeLogEvent("profile_public_profile_clicked", { username })
              }
              className="inline-flex items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:border-cyan-400 hover:bg-cyan-500/20"
            >
              View Public Profile →
            </Link>
          ) : (
            <div className="rounded-full border border-neutral-800 bg-neutral-950/80 px-4 py-2 text-sm text-neutral-500">
              Add a username to view public profile
            </div>
          )}
        </div>

        <section>
          <RoamPassport />
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
          <div className="space-y-5">
            <VisitHistorySection />

            {snapshotsLoading ? (
              <SnapshotLibrarySkeleton />
            ) : snapshotsError ? (
              <SnapshotLibraryError message={snapshotsError} />
            ) : (
              <ProfileSnapshotLibrary initialSnapshots={snapshots} />
            )}

            <ProfilePanel
              eyebrow="Saved"
              title="Property Guides"
              description="Quick access to the neighborhood guides you’ve saved."
            >
              <SavedProperties />
            </ProfilePanel>

            <ProfilePanel
              eyebrow="Library"
              title="Saved Venues & Flows"
              description="A compact library of places and routes you may want to revisit."
            >
              <SavedLibraryShell />
            </ProfilePanel>

            <ProfilePanel
              eyebrow="Activity"
              title="Your Flows"
              description="Hosted, upcoming, and past flows in one cleaner view."
            >
              <UserCrawls />
            </ProfilePanel>
          </div>

          <ProfilePanel
            eyebrow="Account"
            title="Settings"
            description="Tune your identity, taste profile, and social preferences."
            sticky
          >
            <ProfileForm />
          </ProfilePanel>
        </section>
      </div>
    </div>
  )
}

function SavedLibraryShell() {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="space-y-3">
      <div
        className={[
          "relative overflow-hidden rounded-2xl border border-neutral-800 bg-black/20",
          expanded ? "max-h-none" : "max-h-[460px]",
        ].join(" ")}
      >
        <div
          className={[
            "space-y-4 p-3 sm:p-4",
            "[&_section]:space-y-3",
            "[&_h2]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-white",
            "[&_ul]:gap-3 [&_ul]:space-y-3",
            "[&_li]:!rounded-2xl [&_li]:!border-neutral-800 [&_li]:!bg-neutral-900/70 [&_li]:!p-3 [&_li]:!shadow-none",
            "[&_h3]:!text-sm [&_h3]:!font-semibold [&_h3]:!text-white",
            "[&_p]:!text-xs [&_p]:!text-neutral-400",
            "[&_span]:!text-neutral-300",
            "[&_a]:!text-cyan-300 [&_a:hover]:!text-cyan-100",
            "[&_button]:!text-cyan-300 [&_button:hover]:!text-cyan-100",
            "[&_.text-red-600]:!text-red-300",
            "[&_.text-blue-600]:!text-cyan-300",
            "[&_.text-gray-500]:!text-neutral-500",
            "[&_.bg-white]:!bg-neutral-900/70",
            "[&_.border-gray-200]:!border-neutral-800",
          ].join(" ")}
        >
          <FavoritesSection />
        </div>

        {!expanded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-neutral-950 via-neutral-950/90 to-transparent" />
        )}
      </div>

      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="inline-flex w-full items-center justify-center rounded-full border border-neutral-800 bg-neutral-950/80 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:border-cyan-500/40 hover:bg-cyan-500/10 sm:w-auto"
      >
        {expanded ? "Show less" : "View full saved library"}
      </button>
    </div>
  )
}

function SnapshotLibrarySkeleton() {
  return (
    <section
      className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5 text-white"
      aria-label="Loading snapshot library"
    >
      <div className="animate-pulse">
        <div className="h-3 w-28 rounded bg-neutral-800" />
        <div className="mt-3 h-6 w-48 rounded bg-neutral-800" />
        <div className="mt-2 h-4 w-72 max-w-full rounded bg-neutral-900" />

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="overflow-hidden rounded-2xl border border-neutral-800 bg-black/30"
            >
              <div className="aspect-square bg-neutral-900" />

              <div className="space-y-3 p-4">
                <div className="h-4 w-2/3 rounded bg-neutral-800" />
                <div className="h-3 w-1/2 rounded bg-neutral-900" />
                <div className="h-10 rounded-xl bg-neutral-900" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function SnapshotLibraryError({
  message,
}: {
  message: string
}) {
  return (
    <section className="rounded-2xl border border-red-900/50 bg-red-950/20 p-5 text-white">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-red-400">
        Flow snapshots
      </p>

      <h2 className="mt-2 text-xl font-semibold text-white">
        Snapshot library unavailable
      </h2>

      <p className="mt-2 text-sm leading-6 text-red-300">
        {message}
      </p>
    </section>
  )
}

function ProfilePanel({
  eyebrow,
  title,
  description,
  children,
  sticky = false,
}: {
  eyebrow: string
  title: string
  description?: string
  children: React.ReactNode
  sticky?: boolean
}) {
  return (
    <section
      className={[
        "rounded-[1.75rem] border border-neutral-800/90 bg-neutral-950/70 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-5",
        sticky ? "lg:sticky lg:top-24" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-500">
            {eyebrow}
          </p>

          <h2 className="mt-1 text-lg font-semibold text-white">
            {title}
          </h2>

          {description ? (
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              {description}
            </p>
          ) : null}
        </div>
      </div>

      {children}
    </section>
  )
}

function normalizeSnapshot(
  snapshot: SnapshotRow
): ProfileSnapshot {
  return {
    id: snapshot.id,
    title: snapshot.title,
    city: snapshot.city,
    cover_image_url: snapshot.cover_image_url,
    route_summary: snapshot.route_summary,
    checked_in_count:
      typeof snapshot.checked_in_count === "number"
        ? snapshot.checked_in_count
        : 0,
    total_stops:
      typeof snapshot.total_stops === "number"
        ? snapshot.total_stops
        : 0,
    visibility:
      snapshot.visibility === "private"
        ? "private"
        : "public",
    source_type: snapshot.source_type,
    source_id: snapshot.source_id,
    created_at: snapshot.created_at,
    updated_at: snapshot.updated_at,
  }
}