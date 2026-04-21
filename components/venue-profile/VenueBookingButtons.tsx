// components/venue-profile/VenueBookingButtons.tsx

type VenueBookingOption = {
  provider: string
  url: string
}

type Props = {
  bookingOptions?: VenueBookingOption[] | null
}

function getProviderLabel(provider: string): string {
  const normalized = provider.trim().toLowerCase()

  switch (normalized) {
    case 'resy':
      return 'Resy'
    case 'opentable':
      return 'OpenTable'
    case 'tock':
      return 'Tock'
    case 'manual':
      return 'Reserve'
    default:
      return provider
  }
}

function getButtonText(provider: string): string {
  const normalized = provider.trim().toLowerCase()

  switch (normalized) {
    case 'manual':
      return 'Make Reservation'
    default:
      return `Reserve on ${getProviderLabel(normalized)}`
  }
}

export default function VenueBookingButtons({
  bookingOptions,
}: Props) {
  const normalizedOptions =
    (bookingOptions ?? [])
      .filter(
        (option): option is VenueBookingOption =>
          !!option &&
          typeof option.provider === 'string' &&
          option.provider.trim().length > 0 &&
          typeof option.url === 'string' &&
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

  if (normalizedOptions.length === 0) return null

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
          Reservations
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Opens in the provider app if installed, otherwise in your browser.
        </p>
      </div>

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
    </section>
  )
}