'use client'

import { useMemo, useState } from 'react'
import type { SocialGroupDashboardGroup } from '@/types/social-group-dashboard'

type SocialGroupSelectorProps = {
  groups: SocialGroupDashboardGroup[]
  selectedGroupId: string | null
  onChange: (groupId: string | null) => void

  loading?: boolean
  disabled?: boolean

  /**
   * When true, exposes the collective portfolio-level option.
   *
   * null = All Social Groups
   * string = selected individual Social Group
   */
  includeAllGroups?: boolean

  /**
   * Optional custom label for the portfolio-level selection.
   */
  allGroupsLabel?: string
}

export default function SocialGroupSelector({
  groups,
  selectedGroupId,
  onChange,
  loading = false,
  disabled = false,
  includeAllGroups = true,
  allGroupsLabel = 'All Social Groups',
}: SocialGroupSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const normalizedSearch = searchQuery.trim().toLowerCase()

  const sortedGroups = useMemo(() => {
    return [...groups].sort((a, b) => {
      return a.name.localeCompare(b.name)
    })
  }, [groups])

  const filteredGroups = useMemo(() => {
    if (!normalizedSearch) {
      return sortedGroups
    }

    return sortedGroups.filter((group) => {
      const searchable = [
        group.name,
        group.slug,
        group.description ?? '',
      ]
        .join(' ')
        .toLowerCase()

      return searchable.includes(normalizedSearch)
    })
  }, [normalizedSearch, sortedGroups])

  const selectedGroup = useMemo(() => {
    if (!selectedGroupId) {
      return null
    }

    return groups.find((group) => group.id === selectedGroupId) ?? null
  }, [groups, selectedGroupId])

  const isDisabled = loading || disabled

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.045] shadow-2xl backdrop-blur-xl">
      <div className="border-b border-white/10 p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">
              Dashboard Scope
            </p>

            <h2 className="mt-2 text-xl font-black tracking-tight text-white sm:text-2xl">
              {selectedGroup
                ? selectedGroup.name
                : allGroupsLabel}
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
              {selectedGroup
                ? 'Viewing analytics for this Social Group only.'
                : 'Viewing the collective Social Group portfolio. Select a group to isolate its events and activity.'}
            </p>
          </div>

          <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs font-bold text-neutral-400">
            {groups.length.toLocaleString()}{' '}
            {groups.length === 1 ? 'group' : 'groups'}
          </div>
        </div>

        {groups.length > 6 && (
          <div className="mt-5">
            <label
              htmlFor="social-group-search"
              className="sr-only"
            >
              Search Social Groups
            </label>

            <div className="relative">
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500"
              >
                <path
                  d="m14.5 14.5 3 3M16 9a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>

              <input
                id="social-group-search"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                disabled={isDisabled}
                placeholder="Search Social Groups..."
                className="h-11 w-full rounded-xl border border-white/10 bg-black/35 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-cyan-400/50 focus:bg-black/50 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>
        )}
      </div>

      <div className="p-3 sm:p-4">
        {loading ? (
          <LoadingState />
        ) : groups.length === 0 ? (
          <EmptyState />
        ) : (
          <div
            role="listbox"
            aria-label="Social Group dashboard scope"
            className="grid gap-2"
          >
            {includeAllGroups && !normalizedSearch && (
              <button
                type="button"
                role="option"
                aria-selected={selectedGroupId === null}
                disabled={isDisabled}
                onClick={() => onChange(null)}
                className={`group flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                  selectedGroupId === null
                    ? 'border-cyan-400/40 bg-cyan-400/10 shadow-lg shadow-cyan-950/20'
                    : 'border-transparent bg-black/20 hover:border-white/10 hover:bg-white/[0.06]'
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-lg ${
                    selectedGroupId === null
                      ? 'border-cyan-400/30 bg-cyan-400/15'
                      : 'border-white/10 bg-white/[0.05]'
                  }`}
                >
                  ◫
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p
                      className={`truncate text-sm font-black ${
                        selectedGroupId === null
                          ? 'text-white'
                          : 'text-neutral-200'
                      }`}
                    >
                      {allGroupsLabel}
                    </p>

                    {selectedGroupId === null && (
                      <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-cyan-300">
                        Active
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-xs text-neutral-500">
                    Collective performance across all available groups
                  </p>
                </div>

                <SelectionIndicator
                  active={selectedGroupId === null}
                />
              </button>
            )}

            {filteredGroups.map((group) => {
              const active = selectedGroupId === group.id

              return (
                <button
                  key={group.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  disabled={isDisabled}
                  onClick={() => onChange(group.id)}
                  className={`group flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                    active
                      ? 'border-cyan-400/40 bg-cyan-400/10 shadow-lg shadow-cyan-950/20'
                      : 'border-transparent bg-black/20 hover:border-white/10 hover:bg-white/[0.06]'
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <GroupLogo
                    name={group.name}
                    logoUrl={group.logo_url}
                    active={active}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <p
                        className={`truncate text-sm font-black ${
                          active
                            ? 'text-white'
                            : 'text-neutral-200'
                        }`}
                      >
                        {group.name}
                      </p>

                      {active && (
                        <span className="shrink-0 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-cyan-300">
                          Active
                        </span>
                      )}
                    </div>

                    <p className="mt-0.5 truncate text-xs text-neutral-500">
                      /{group.slug}
                    </p>

                    {group.description && (
                      <p className="mt-1 line-clamp-1 text-xs text-neutral-500">
                        {group.description}
                      </p>
                    )}
                  </div>

                  <SelectionIndicator active={active} />
                </button>
              )
            })}

            {filteredGroups.length === 0 && normalizedSearch && (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-5 py-8 text-center">
                <p className="text-sm font-bold text-neutral-300">
                  No Social Groups found
                </p>

                <p className="mt-1 text-xs text-neutral-500">
                  Try another group name or slug.
                </p>

                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="mt-4 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-bold text-neutral-300 transition hover:border-cyan-400/30 hover:text-white"
                >
                  Clear Search
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function GroupLogo({
  name,
  logoUrl,
  active,
}: {
  name: string
  logoUrl: string | null
  active: boolean
}) {
  const initials = getInitials(name)

  if (logoUrl) {
    return (
      <div
        className={`flex h-11 w-11 shrink-0 overflow-hidden rounded-xl border bg-black ${
          active
            ? 'border-cyan-400/40'
            : 'border-white/10'
        }`}
      >
        <img
          src={logoUrl}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </div>
    )
  }

  return (
    <div
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-xs font-black ${
        active
          ? 'border-cyan-400/30 bg-cyan-400/15 text-cyan-200'
          : 'border-white/10 bg-white/[0.05] text-neutral-300'
      }`}
      aria-hidden="true"
    >
      {initials}
    </div>
  )
}

function SelectionIndicator({
  active,
}: {
  active: boolean
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
        active
          ? 'border-cyan-300 bg-cyan-300 text-black'
          : 'border-white/10 text-transparent group-hover:border-white/25'
      }`}
    >
      <svg
        viewBox="0 0 20 20"
        fill="none"
        className="h-3.5 w-3.5"
      >
        <path
          d="m5 10 3 3 7-7"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

function LoadingState() {
  return (
    <div
      className="space-y-2"
      aria-live="polite"
      aria-label="Loading Social Groups"
    >
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="flex animate-pulse items-center gap-3 rounded-2xl border border-transparent bg-black/20 p-3"
        >
          <div className="h-11 w-11 shrink-0 rounded-xl bg-white/[0.07]" />

          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 rounded-full bg-white/[0.08]" />
            <div className="h-2.5 w-1/5 rounded-full bg-white/[0.05]" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-5 py-8 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-lg">
        ◫
      </div>

      <p className="mt-3 text-sm font-bold text-neutral-300">
        No Social Groups available
      </p>

      <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-neutral-500">
        Social Groups available to this dashboard will appear here.
      </p>
    </div>
  )
}

function getInitials(value: string): string {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) {
    return 'SG'
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}