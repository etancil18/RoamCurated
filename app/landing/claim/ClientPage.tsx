'use client';

import { useState } from 'react';
import { VenueClaimForm } from '@/components/landing/VenueClaimForm';
import { Sparkles, MapPin, BarChart3 } from 'lucide-react';

export default function ClientPage() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black text-white px-4 py-12">
      <div className="max-w-2xl w-full space-y-10">
        {!submitted ? (
          <div className="space-y-8">
            <div className="text-center">
              <h1 className="text-4xl sm:text-5xl font-bold text-white">
                You’re Throwing Events — But No One’s Finding Them
              </h1>
              <p className="mt-4 text-lg text-gray-300">
                Roam puts your venue on the map — literally. Get discovered by locals in real time, see who’s coming, and own your presence.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                <MapPin className="mx-auto h-6 w-6 text-teal-400" />
                <p className="mt-2 text-sm">Be Discoverable<br />in Curated City Crawls</p>
              </div>
              <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                <BarChart3 className="mx-auto h-6 w-6 text-indigo-400" />
                <p className="mt-2 text-sm">Track Engagement<br />with Real-Time Data</p>
              </div>
              <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                <Sparkles className="mx-auto h-6 w-6 text-yellow-400" />
                <p className="mt-2 text-sm">Own Your Presence<br />& Event Visibility</p>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-lg border border-gray-700">
              <VenueClaimForm onSuccess={() => setSubmitted(true)} />
            </div>

            <div className="text-center text-xs text-gray-500">
              Join 150+ venues already claiming their space on Roam.
            </div>
          </div>
        ) : (
          <div className="text-center" aria-live="polite">
            <h2 className="text-2xl font-semibold text-green-400">Request Received ✅</h2>
            <p className="mt-2 text-gray-300">
              We’ll review your request and get back to you within 24 hours.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
