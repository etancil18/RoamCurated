// components/venue-profile/VenuePartnerBadge.tsx

type Props = {
  partnership: {
    badge_label: string | null
    offer_title?: string | null
    offer_description?: string | null
    terms?: string | null
    partner_since?: string | null
  }
}

export default function VenuePartnerBadge({ partnership }: Props) {
  const hasOffer =
    Boolean(partnership.offer_title?.trim()) ||
    Boolean(partnership.offer_description?.trim()) ||
    Boolean(partnership.terms?.trim())

  return (
    <div className="inline-flex max-w-full flex-col rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-950 shadow-sm dark:text-cyan-50">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex rounded-full bg-cyan-300 px-3 py-1 text-xs font-bold uppercase tracking-wide text-neutral-950">
          {partnership.badge_label || 'Roam Partner'}
        </span>

        {partnership.partner_since && (
          <span className="text-xs font-medium text-cyan-900/70 dark:text-cyan-100/70">
            Since {partnership.partner_since}
          </span>
        )}
      </div>

      {hasOffer && (
        <details className="group mt-2">
          <summary className="cursor-pointer list-none text-xs font-semibold text-cyan-900 underline underline-offset-4 hover:text-cyan-700 dark:text-cyan-100 dark:hover:text-cyan-200">
            <span className="group-open:hidden">View partner perk</span>
            <span className="hidden group-open:inline">Hide partner perk</span>
          </summary>

          <div className="mt-2 max-w-xl rounded-xl border border-cyan-400/20 bg-white/70 p-3 text-sm leading-6 dark:bg-neutral-950/60">
            {partnership.offer_title && (
              <p className="font-semibold text-cyan-950 dark:text-cyan-50">
                {partnership.offer_title}
              </p>
            )}

            {partnership.offer_description && (
              <p className="mt-1 text-cyan-900/80 dark:text-cyan-100/80">
                {partnership.offer_description}
              </p>
            )}

            {partnership.terms && (
              <p className="mt-2 text-xs leading-5 text-cyan-900/60 dark:text-cyan-100/60">
                {partnership.terms}
              </p>
            )}
          </div>
        </details>
      )}
    </div>
  )
}