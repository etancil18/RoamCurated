"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import ProfileForm from "./form"
import UserCrawls from "./UserCrawls"
import SavedProperties from "./SavedProperties"
import RoamPassport from "./RoamPassport"
import { supabaseBrowser } from "@/lib/supabase/client"
import { logEvent } from "@/lib/logEvent"

function safeLogEvent(eventName: string, metadata: Record<string, unknown> = {}) {
  try {
    void Promise.resolve(
      logEvent(eventName, {
        metadata,
      })
    )
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
      <div className="mx-auto max-w-4xl space-y-10 px-6 pb-10 pt-[calc(4rem+env(safe-area-inset-top)+1rem)]">
        
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              Your Passport
            </h1>

            <p className="text-sm text-neutral-400">
              Track your movement, hosted crawls, saved guides, badges, and city progress.
            </p>
          </div>

          {username ? (
            <Link
              href={`/u/${username}`}
              onClick={() =>
                safeLogEvent("profile_public_profile_clicked", {
                  username,
                })
              }
              className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:border-cyan-400 hover:bg-cyan-500/20"
            >
              View Public Profile →
            </Link>
          ) : (
            <div className="rounded-full border border-neutral-800 bg-neutral-950 px-4 py-2 text-sm text-neutral-500">
              Add a username to view public profile
            </div>
          )}
        </div>

        <section>
          <RoamPassport />
        </section>

        <section className="rounded-xl border border-neutral-800 bg-neutral-950 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Saved Property Guides
          </h2>

          <SavedProperties />
        </section>

        <section className="rounded-xl border border-neutral-800 bg-neutral-950 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Your Crawls
          </h2>

          <UserCrawls />
        </section>

        <section className="rounded-xl border border-neutral-800 bg-neutral-950 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Account Settings
          </h2>

          <ProfileForm />
        </section>
      </div>
    </div>
  )
}