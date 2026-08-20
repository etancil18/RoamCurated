import TasteDuelEntryCard, {
  type TasteDuelEntryCardProps,
} from '@/components/competitions/TasteDuelEntryCard'

type TwoEntryMatchup = [
  TasteDuelEntryCardProps,
  TasteDuelEntryCardProps,
]

type ThreeEntryMatchup = [
  TasteDuelEntryCardProps,
  TasteDuelEntryCardProps,
  TasteDuelEntryCardProps,
]

type FourEntryMatchup = [
  TasteDuelEntryCardProps,
  TasteDuelEntryCardProps,
  TasteDuelEntryCardProps,
  TasteDuelEntryCardProps,
]

export type TasteDuelMatchupEntries =
  | TwoEntryMatchup
  | ThreeEntryMatchup
  | FourEntryMatchup

type TasteDuelMatchupProps = {
  entries: TasteDuelMatchupEntries

  title?: string | null
  eyebrow?: string | null
  description?: string | null

  className?: string
}

export default function TasteDuelMatchup({
  entries,
  title = null,
  eyebrow = null,
  description = null,
  className = '',
}: TasteDuelMatchupProps) {
  const orderedEntries =
    [...entries].sort(
      (
        left,
        right
      ) =>
        left.contenderSlot -
        right.contenderSlot
    )

  assertValidMatchup(
    orderedEntries
  )

  return (
    <section
      className={
        className
      }
    >
      {eyebrow ||
      title ||
      description ? (
        <header className="mb-6 border-b border-white/[0.08] pb-5">
          {eyebrow ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/30">
              {eyebrow}
            </p>
          ) : null}

          {title ? (
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">
              {title}
            </h2>
          ) : null}

          {description ? (
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/45">
              {description}
            </p>
          ) : null}
        </header>
      ) : null}

      <div
        className={getMatchupGridClassName(
          orderedEntries.length
        )}
      >
        {orderedEntries.map(
          (
            entry,
            index
          ) => (
            <div
              key={
                entry.entryId
              }
              className={getEntryWrapperClassName(
                orderedEntries.length,
                index
              )}
            >
              <TasteDuelEntryCard
                {...entry}
              />
            </div>
          )
        )}
      </div>
    </section>
  )
}

function getMatchupGridClassName(
  entryCount: number
): string {
  switch (entryCount) {
    case 2:
      return [
        'grid',
        'grid-cols-1',
        'gap-5',
        'lg:grid-cols-2',
      ].join(' ')

    case 3:
      return [
        'grid',
        'grid-cols-1',
        'gap-5',
        'md:grid-cols-2',
        'xl:grid-cols-3',
      ].join(' ')

    case 4:
      return [
        'grid',
        'grid-cols-1',
        'gap-5',
        'md:grid-cols-2',
      ].join(' ')

    default:
      return 'grid grid-cols-1 gap-5'
  }
}

function getEntryWrapperClassName(
  entryCount: number,
  index: number
): string {
  /**
   * Three-entry tablet layout:
   *
   *   A | B
   *   C | C
   *
   * At xl it becomes:
   *
   *   A | B | C
   *
   * This prevents the third contender from being visually treated
   * as a smaller or secondary entry at medium widths.
   */
  if (
    entryCount === 3 &&
    index === 2
  ) {
    return 'md:col-span-2 xl:col-span-1'
  }

  return ''
}

function assertValidMatchup(
  entries: TasteDuelEntryCardProps[]
): void {
  if (
    entries.length < 2 ||
    entries.length > 4
  ) {
    throw new Error(
      `TasteDuelMatchup requires 2, 3, or 4 entries. Received ${entries.length}.`
    )
  }

  const entryIds =
    new Set<string>()

  const contenderSlots =
    new Set<number>()

  for (
    const entry
    of entries
  ) {
    if (
      !entry.entryId ||
      entry.entryId
        .trim()
        .length === 0
    ) {
      throw new Error(
        'TasteDuelMatchup received an entry without a valid entryId.'
      )
    }

    if (
      entryIds.has(
        entry.entryId
      )
    ) {
      throw new Error(
        `TasteDuelMatchup received duplicate entryId "${entry.entryId}".`
      )
    }

    entryIds.add(
      entry.entryId
    )

    if (
      contenderSlots.has(
        entry.contenderSlot
      )
    ) {
      throw new Error(
        `TasteDuelMatchup received duplicate contender slot ${entry.contenderSlot}.`
      )
    }

    contenderSlots.add(
      entry.contenderSlot
    )
  }

  const expectedSlots =
    Array.from(
      {
        length:
          entries.length,
      },
      (
        _,
        index
      ) =>
        index +
        1
    )

  for (
    const expectedSlot
    of expectedSlots
  ) {
    if (
      !contenderSlots.has(
        expectedSlot
      )
    ) {
      throw new Error(
        `TasteDuelMatchup expected contender slots 1-${entries.length}. Missing slot ${expectedSlot}.`
      )
    }
  }
}