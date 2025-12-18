'use client';

import { useState } from 'react';

type Props = {
  onSuccess: () => void;
};

export function VenueClaimForm({ onSuccess }: Props) {
  const [venueName, setVenueName] = useState('');
  const [email, setEmail] = useState('');
  const [instagram, setInstagram] = useState('');
  const [eventSubmission, setEventSubmission] = useState('Connect IG');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/landing/claim/submit', {
        method: 'POST',
        body: JSON.stringify({
          venue_name: venueName,
          email,
          instagram_handle: instagram,
          event_submission: eventSubmission,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Submission failed');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-gray-950 p-6 rounded-xl shadow-lg">
      <div>
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Venue Name</label>
        <input
          type="text"
          required
          value={venueName}
          onChange={(e) => setVenueName(e.target.value)}
          placeholder="E.g. The Electric Cactus"
          className="mt-1 block w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-black dark:text-white rounded-md p-3 shadow-sm focus:ring-black dark:focus:ring-white focus:border-black dark:focus:border-white"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-black dark:text-white rounded-md p-3 shadow-sm focus:ring-black dark:focus:ring-white focus:border-black dark:focus:border-white"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Instagram Handle</label>
        <input
          type="text"
          required
          value={instagram}
          onChange={(e) => setInstagram(e.target.value)}
          placeholder="@yourvenue"
          className="mt-1 block w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-black dark:text-white rounded-md p-3 shadow-sm focus:ring-black dark:focus:ring-white focus:border-black dark:focus:border-white"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
          How do you prefer to share events?
        </label>
        <div className="mt-2 space-y-2">
          {['Connect IG', 'Form', 'Manual'].map((option) => (
            <label key={option} className="flex items-center space-x-2 text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="event_submission"
                value={option}
                checked={eventSubmission === option}
                onChange={(e) => setEventSubmission(e.target.value)}
                className="h-4 w-4 text-black dark:text-white"
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-black dark:bg-white text-white dark:text-black py-3 text-md font-semibold rounded-md hover:bg-gray-900 dark:hover:bg-gray-100 transition"
      >
        {loading ? 'Submitting...' : 'Claim My Venue'}
      </button>
    </form>
  );
}
