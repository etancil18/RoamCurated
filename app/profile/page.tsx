"use client"

import ProfileForm from "./form"
import UserCrawls from "./UserCrawls"
import SavedProperties from "./SavedProperties"

export default function UserProfilePage() {
  return (

    <div className="min-h-screen bg-black text-white">

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-10">

        {/* Header */}

        <div className="space-y-2">

          <h1 className="text-3xl font-semibold tracking-tight">
            Your Profile
          </h1>

          <p className="text-sm text-neutral-400">
            Manage your saved places, crawls, and account details.
          </p>

        </div>

        {/* Saved Properties */}

        <section className="rounded-xl border border-neutral-800 bg-neutral-950 p-6">

          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400 mb-4">
            Saved Property Guides
          </h2>

          <SavedProperties />

        </section>

        {/* User Crawls */}

        <section className="rounded-xl border border-neutral-800 bg-neutral-950 p-6">

          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400 mb-4">
            Your Crawls
          </h2>

          <UserCrawls />

        </section>

        {/* Profile Settings */}

        <section className="rounded-xl border border-neutral-800 bg-neutral-950 p-6">

          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400 mb-4">
            Account Settings
          </h2>

          <ProfileForm />

        </section>

      </div>

    </div>

  )
}