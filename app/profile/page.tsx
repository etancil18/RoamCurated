"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import ProfileForm from "./form"
import UserCrawls from "./UserCrawls"
import SavedProperties from "./SavedProperties"
import RoamPassport from "./RoamPassport"
import FavoritesSection from "./FavoritesSection"
import { supabaseBrowser } from "@/lib/supabase/client"
import { logEvent } from "@/lib/logEvent"

function safeLogEvent(eventName: string, metadata: Record<string, unknown> = {}) {
  try {
    void Promise.resolve(logEvent(eventName, { metadata }))
  } catch (error) {
    console.warn("logEvent failed:", eventName, error)
  }
}

export default function UserProfilePage() {
  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    safeLogEvent("profile_page_viewed")

    async function loadUsername() {
      const supabase = supabaseBrowser()

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { data } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle()

      setUsername(data?.username ?? null)
    }

    loadUsername()
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
              Track your movement, hosted flows, saved guides, badges, and city progress.
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

          <h2 className="mt-1 text-lg font-semibold text-white">{title}</h2>

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