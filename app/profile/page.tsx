"use client"

import ProfileForm from "./form"
import UserCrawls from "./UserCrawls"
import SavedProperties from "./SavedProperties"
import RoamPassport from "./RoamPassport"

export default function UserProfilePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-4xl space-y-10 px-6 pb-10 pt-[calc(4rem+env(safe-area-inset-top)+1rem)]">
        
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Your Passport
          </h1>

          <p className="text-sm text-neutral-400">
            Track your movement, hosted crawls, saved guides, badges, and city progress.
          </p>
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