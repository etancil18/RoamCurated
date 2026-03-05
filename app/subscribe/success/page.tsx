"use client"

import Link from "next/link"

export default function SubscribeSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">

      <div className="max-w-md w-full text-center space-y-6">

        <h1 className="text-3xl font-bold text-green-500">
          🎉 Subscription Active
        </h1>

        <p className="text-neutral-400">
          Your Roam Pro subscription is now active.
        </p>

        <p className="text-neutral-400">
          You now have access to premium features like events,
          favorites, and advanced crawl planning.
        </p>

        <Link
          href="/"
          className="inline-block bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded font-semibold"
        >
          Back to Map
        </Link>

      </div>

    </div>
  )
}