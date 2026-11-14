
'use client'

import {
  useEffect,
  useState,
  useTransition,
  type FormEvent,
} from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronDown,
  Loader2,
  MapPin,
  Plus,
} from 'lucide-react'

import {
  SUPPORTED_CITIES,
} from '@/lib/cities/normalizeCity'

import type {
  SuggestCreatorVenueResult,
} from '@/app/profile/creator/collections/suggestVenueAction'

type SuggestMissingPlaceInput = {
  collectionId: string | null
  venueName: string
  city: string
  address: string | null
  category: string | null
  websiteUrl: string | null
  instagramUrl: string | null
  creatorNote: string | null
}

type Props = {
  collectionId: string | null
  city: string
  searchQuery?: string
  disabled?: boolean

  suggestPlaceAction: (
    input: SuggestMissingPlaceInput
  ) => Promise<SuggestCreatorVenueResult>
}

function optionalValue(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export default function SuggestMissingPlaceForm({
  collectionId,
  city,
  searchQuery = '',
  disabled = false,
  suggestPlaceAction,
}: Props) {
  const router = useRouter()

  // A null collection ID represents a standalone
  // creator suggestion, not a collection entry.
  const standalone = collectionId === null

  const [isOpen, setIsOpen] = useState(standalone)
  const [isPending, startTransition] = useTransition()

  const [selectedCity, setSelectedCity] = useState(city)

  const resolvedCity = standalone
    ? selectedCity
    : city

  const [venueName, setVenueName] = useState('')
  const [address, setAddress] = useState('')
  const [category, setCategory] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [instagramUrl, setInstagramUrl] = useState('')
  const [creatorNote, setCreatorNote] = useState('')

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  // Only prefill the name when the disclosure is opened.
  // Later picker searches must not overwrite user edits.
  useEffect(() => {
    if (isOpen) {
      return
    }

    setVenueName(searchQuery.trim().slice(0, 160))
  }, [searchQuery, isOpen])

  const isBusy = disabled || isPending

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isBusy) {
      return
    }

    const name = venueName.trim()
    const normalizedCity = resolvedCity.trim()

    if (!name || !normalizedCity) {
      setFeedback({
        type: 'error',
        message: 'Place name and city are required.',
      })
      return
    }

    setFeedback(null)

    startTransition(() => {
      void suggestPlaceAction({
        collectionId,
        venueName: name,
        city: normalizedCity,
        address: optionalValue(address),
        category: optionalValue(category),
        websiteUrl: optionalValue(websiteUrl),
        instagramUrl: optionalValue(instagramUrl),
        creatorNote: optionalValue(creatorNote),
      })
        .then((result) => {
          if (!result.success) {
            setFeedback({
              type: 'error',
              message: result.error,
            })
            return
          }

          setFeedback({
            type: 'success',
            message: standalone
              ? result.data.reused
                ? 'This place has already been suggested.'
                : 'Your place suggestion has been submitted.'
              : result.data.reused
                ? 'This place was already suggested. Its collection entry is available.'
                : 'Place added to your collection.',
          })

          // Clear submitted details, but retain the
          // disclosure and success confirmation.
          setVenueName('')
          setAddress('')
          setCategory('')
          setWebsiteUrl('')
          setInstagramUrl('')
          setCreatorNote('')

          // Reload the server-rendered editorial sequence.
          // The new card uses its presentation-item UUID
          // when submitted in the collection context.
          router.refresh()
        })
        .catch((error: unknown) => {
          console.error(
            '[SuggestMissingPlaceForm] Submission failed:',
            error
          )

          setFeedback({
            type: 'error',
            message:
              'The place could not be submitted. Please try again.',
          })
        })
    })
  }

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.04]">
      <button
        type="button"
        disabled={disabled}
        aria-expanded={isOpen}
        onClick={() => {
          if (isBusy) return
          setIsOpen((current) => !current)
          setFeedback(null)
        }}
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-cyan-500/[0.06] disabled:cursor-not-allowed disabled:opacity-50 sm:px-5"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
            <Plus aria-hidden="true" className="h-5 w-5" />
          </span>

          <span className="min-w-0">
            <span className="block text-sm font-semibold text-white">
              Suggest a missing place
            </span>
            <span className="mt-1 block text-xs leading-5 text-neutral-400">
              {standalone
                ? "Know a place Roam is missing? Suggest it for consideration."
                : "Can't find it in Roam? Add it to this collection."}
            </span>
          </span>
        </span>

        <ChevronDown
          aria-hidden="true"
          className={[
            'h-4 w-4 shrink-0 text-cyan-300 transition-transform',
            isOpen ? 'rotate-180' : '',
          ].join(' ')}
        />
      </button>

      {isOpen ? (
        <div className="border-t border-cyan-500/15 px-4 py-5 sm:px-5">
          <p className="mb-5 text-xs leading-5 text-neutral-400">
            {standalone
              ? 'Your suggestion is submitted for consideration. It is not automatically added to a collection or published as an official Roam venue.'
              : 'Suggested places appear in your collection as editorial recommendations. They are not official Roam venues and do not receive venue profiles or Flow eligibility.'}
          </p>

          {feedback ? (
            <div
              role={feedback.type === 'error' ? 'alert' : 'status'}
              className={[
                'mb-5 rounded-xl border px-4 py-3 text-sm',
                feedback.type === 'error'
                  ? 'border-red-500/30 bg-red-500/10 text-red-200'
                  : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
              ].join(' ')}
            >
              {feedback.message}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="suggest-place-name"
                className="mb-2 block text-sm font-medium text-neutral-200"
              >
                Place name <span className="text-cyan-400">*</span>
              </label>

              <input
                id="suggest-place-name"
                type="text"
                required
                maxLength={160}
                autoComplete="off"
                disabled={isBusy}
                value={venueName}
                onChange={(event) => setVenueName(event.target.value)}
                placeholder="Name of the missing place"
                className={inputClassName}
              />
            </div>

            <div>
              <label
                htmlFor="suggest-place-city"
                className="mb-2 block text-sm font-medium text-neutral-200"
              >
                City
                {standalone ? (
                  <span className="text-cyan-400"> *</span>
                ) : null}
              </label>

              {standalone ? (
                <select
                  id="suggest-place-city"
                  required
                  disabled={isBusy}
                  value={selectedCity}
                  onChange={(event) =>
                    setSelectedCity(event.target.value)
                  }
                  className={inputClassName}
                >
                  <option value="">
                    Select a city
                  </option>

                  {SUPPORTED_CITIES.map((cityOption) => (
                    <option
                      key={cityOption.value}
                      value={cityOption.value}
                    >
                      {cityOption.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900/60 px-3 py-3 text-sm text-neutral-300">
                  <MapPin
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-cyan-300"
                  />
                  <span>{city}</span>
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="suggest-place-address"
                  className="mb-2 block text-sm font-medium text-neutral-200"
                >
                  Address
                </label>

                <input
                  id="suggest-place-address"
                  type="text"
                  maxLength={300}
                  disabled={isBusy}
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="Street address (optional)"
                  className={inputClassName}
                />
              </div>

              <div>
                <label
                  htmlFor="suggest-place-category"
                  className="mb-2 block text-sm font-medium text-neutral-200"
                >
                  Category
                </label>

                <input
                  id="suggest-place-category"
                  type="text"
                  maxLength={120}
                  disabled={isBusy}
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  placeholder="Cafe, gallery, restaurant..."
                  className={inputClassName}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="suggest-place-website"
                  className="mb-2 block text-sm font-medium text-neutral-200"
                >
                  Website
                </label>

                <input
                  id="suggest-place-website"
                  type="url"
                  maxLength={2048}
                  disabled={isBusy}
                  value={websiteUrl}
                  onChange={(event) => setWebsiteUrl(event.target.value)}
                  placeholder="https://example.com"
                  className={inputClassName}
                />
              </div>

              <div>
                <label
                  htmlFor="suggest-place-instagram"
                  className="mb-2 block text-sm font-medium text-neutral-200"
                >
                  Instagram URL
                </label>

                <input
                  id="suggest-place-instagram"
                  type="url"
                  maxLength={2048}
                  disabled={isBusy}
                  value={instagramUrl}
                  onChange={(event) => setInstagramUrl(event.target.value)}
                  placeholder="https://instagram.com/..."
                  className={inputClassName}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="suggest-place-note"
                className="mb-2 block text-sm font-medium text-neutral-200"
              >
                Why are you recommending it?
              </label>

              <textarea
                id="suggest-place-note"
                rows={4}
                maxLength={600}
                disabled={isBusy}
                value={creatorNote}
                onChange={(event) => setCreatorNote(event.target.value)}
                placeholder="Share what makes this place special."
                className={`${inputClassName} resize-y`}
              />

              <p className="mt-1 text-right text-xs text-neutral-600">
                {creatorNote.length}/600
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-neutral-700 px-4 py-2.5 text-sm font-medium text-neutral-300 transition hover:border-neutral-500 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  isBusy ||
                  !venueName.trim() ||
                  !resolvedCity.trim()
                }
                className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? (
                  <Loader2
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin"
                  />
                ) : (
                  <Plus
                    aria-hidden="true"
                    className="h-4 w-4"
                  />
                )}

                {isPending
                  ? 'Submitting...'
                  : standalone
                    ? 'Submit Place Suggestion'
                    : 'Add Suggested Place'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}

const inputClassName = [
  'w-full min-w-0 rounded-xl border border-neutral-800 bg-black px-3 py-2.5 text-sm text-white outline-none transition',
  'placeholder:text-neutral-700',
  'focus:border-cyan-500 focus-visible:ring-2 focus-visible:ring-cyan-400/40',
  'disabled:cursor-not-allowed disabled:opacity-50',
].join(' ')
