
"use client"

import { logEvent } from "@/lib/logEvent"

type VenueBookingOption = {
  provider: string
  url: string
}

type Props = {
  bookingOptions?: VenueBookingOption[] | null
  reservationRecommended?: boolean
  recommendedReservationAt?: string | null
  compact?: boolean
}

function safeLogEvent(eventName: string, metadata: Record<string, unknown> = {}) {
  try {
    void Promise.resolve(logEvent(eventName, metadata))
  } catch (error) {
    console.warn("logEvent failed:", eventName, error)
  }
}

function getProviderLabel(provider: string): string {
  const normalized = provider.trim().toLowerCase()

  switch (normalized) {
    case "resy":
      return "Resy"
    case "opentable":
      return "OpenTable"
    case "tock":
      return "Tock"
    case "sevenrooms":
      return "SevenRooms"
    case "manual":
      return "Reserve"
    default:
      return provider
  }
}

function getButtonText(provider: string, compact = false): string {
  const normalized = provider.trim().toLowerCase()

  if (compact) {
    switch (normalized) {
      case "manual":
        return "Reserve"
      default:
        return getProviderLabel(normalized)
    }
  }

  switch (normalized) {
    case "manual":
      return "Make Reservation"
    default:
      return `Reserve on ${getProviderLabel(normalized)}`
  }
}

// =====================================================
// VENUE PROFILE — BOOKING ARROW ICON
//
// Matches the arrow used by VenueBuildFlowButton.
// =====================================================

function BookingArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

export default function VenueBookingButtons({
  bookingOptions,
  reservationRecommended = false,
  recommendedReservationAt = null,
  compact = false,
}: Props) {
  const normalizedOptions =
    (bookingOptions ?? [])
      .filter(
        (option): option is VenueBookingOption =>
          !!option &&
          typeof option.provider === "string" &&
          option.provider.trim().length > 0 &&
          typeof option.url === "string" &&
          option.url.trim().length > 0
      )
      .map((option) => ({
        provider: option.provider.trim().toLowerCase(),
        url: option.url.trim(),
      }))
      .filter(
        (option, index, arr) =>
          arr.findIndex(
            (entry) =>
              entry.provider === option.provider && entry.url === option.url
          ) === index
      )

  if (normalizedOptions.length === 0 && !reservationRecommended) return null

  const suggestedTimeLabel = recommendedReservationAt
    ? new Date(recommendedReservationAt).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : null

  const handleBookingClick = (option: VenueBookingOption) => {
    safeLogEvent("venue_booking_click", {
      provider: option.provider,
      url: option.url,
      compact,
      reservation_recommended: reservationRecommended,
      recommended_reservation_at: recommendedReservationAt,
      suggested_time_label: suggestedTimeLabel,
    })
  }

  if (compact) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {reservationRecommended ? (
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-emerald-300">
              Reservation recommended
            </span>
          ) : null}

          {suggestedTimeLabel ? (
            <span className="rounded-full bg-neutral-900 px-2.5 py-1 text-[11px] text-neutral-300">
              Suggested time {suggestedTimeLabel}
            </span>
          ) : null}
        </div>

        {normalizedOptions.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {normalizedOptions.map((option) => (
              <a
                key={`${option.provider}-${option.url}`}
                href={option.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleBookingClick(option)}
                className="inline-flex items-center justify-center rounded-lg border border-cyan-700 bg-cyan-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-neutral-950"
              >
                {getButtonText(option.provider, true)}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  // =====================================================
  // VENUE PROFILE — RESERVATION BUTTON SPACING
  //
  // Do not render an empty heading/details container
  // when no reservation guidance has been supplied.
  //
  // This removes the unnecessary vertical space above
  // the gradient button and aligns it with Build a Flow.
  //
  // Existing reservation guidance remains unchanged
  // whenever it is present.
  // =====================================================

  const hasReservationGuidance =
    reservationRecommended || Boolean(suggestedTimeLabel)

  return (
    <section className={hasReservationGuidance ? "space-y-4" : ""}>
      {hasReservationGuidance ? (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Reservations
          </h2>

          {reservationRecommended || suggestedTimeLabel ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {reservationRecommended ? (
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-emerald-300">
                  Reservation recommended
                </span>
              ) : null}

              {suggestedTimeLabel ? (
                <span className="rounded-full bg-neutral-900 px-2.5 py-1 text-[11px] text-neutral-300 dark:bg-neutral-900">
                  Suggested time {suggestedTimeLabel}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {normalizedOptions.length > 0 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {normalizedOptions.map((option) => (
            <a
              key={`${option.provider}-${option.url}`}
              href={option.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleBookingClick(option)}
              className={[
                "flex min-h-11 w-full items-center justify-center gap-2",
                "rounded-xl bg-gradient-to-r",
                "from-indigo-500 via-violet-500 to-cyan-500",
                "px-4 py-3 text-center text-sm font-black text-white",
                "shadow-[0_12px_30px_rgba(34,211,238,0.12)]",
                "transition hover:brightness-110",
                "focus-visible:outline focus-visible:outline-2",
                "focus-visible:outline-offset-2",
                "focus-visible:outline-cyan-300",
              ].join(" ")}
            >
              {getButtonText(option.provider)}
              <BookingArrowIcon />
            </a>
          ))}
        </div>
      ) : null}
    </section>
  )
}
