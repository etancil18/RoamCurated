"use client"

import { useState } from "react"

export default function SubscribePage() {
  const [loading, setLoading] = useState(false)

  async function handleSubscribe() {
    try {
      setLoading(true)

      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || "Failed to start checkout")
        setLoading(false)
        return
      }

      window.location.href = data.url
    } catch (err) {
      console.error("Checkout error:", err)
      alert("Something went wrong.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">

        <h1 className="text-3xl font-bold">
          Upgrade to Roam Pro
        </h1>

        <p className="text-neutral-400">
          Unlock premium crawl planning tools, events, and favorites.
        </p>

        <div className="border rounded-lg p-6 bg-neutral-900">
          <h2 className="text-xl font-semibold mb-2">
            Roam Pro
          </h2>

          <p className="text-3xl font-bold mb-4">
            $1.99<span className="text-sm font-normal"> / month</span>
          </p>

          <ul className="text-sm text-neutral-300 mb-6 space-y-1">
            <li>✔ Unlimited crawls</li>
            <li>✔ Save favorite venues</li>
            <li>✔ Access events</li>
            <li>✔ Advanced route planning</li>
          </ul>

          <button
            onClick={handleSubscribe}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded font-semibold"
          >
            {loading ? "Redirecting..." : "Upgrade Now"}
          </button>
        </div>

      </div>
    </div>
  )
}