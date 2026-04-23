// components/venue-profile/VenueBookingButtons.tsx

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

function getProviderLabel(provider: string): string {
  const normalized = provider.trim().toLowerCase()

  switch (normalized) {
    case "resy":
      return "Resy"
    case "opentable":
      return "OpenTable"
    case "tock":
      return "Tock"
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

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
          Reservations
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Opens in the provider app if installed, otherwise in your browser.
        </p>

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

      {normalizedOptions.length > 0 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {normalizedOptions.map((option) => (
            <a
              key={`${option.provider}-${option.url}`}
              href={option.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-950"
            >
              {getButtonText(option.provider)}
            </a>
          ))}
        </div>
      ) : null}
    </section>
  )
}