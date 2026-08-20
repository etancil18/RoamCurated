"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"

import {
  useRouter,
} from "next/navigation"

import {
  inviteRelayTeamMember,
} from "@/lib/relay/actions"

import {
  supabaseBrowser,
} from "@/lib/supabase/client"


/* ============================================================
 * CONTRACTS
 * ============================================================
 */

type RelayTeamInviteUserProps = {
  teamId:
    string

  currentUserId:
    string

  existingUserIds?:
    string[]

  disabled?:
    boolean

  className?:
    string
}


type ProfileSearchRow = {
  id:
    string

  username:
    string | null

  full_name:
    string | null

  avatar_url:
    string | null

  deleted_at:
    string | null
}


type ProfileSearchResult = {
  id:
    string

  username:
    string | null

  fullName:
    string | null

  avatarUrl:
    string | null
}


/* ============================================================
 * CONSTANTS
 * ============================================================
 */

const SEARCH_DEBOUNCE_MS =
  300


const MIN_SEARCH_LENGTH =
  2


const MAX_SEARCH_RESULTS =
  8


/* ============================================================
 * COMPONENT
 * ============================================================
 */

export default function RelayTeamInviteUser({
  teamId,
  currentUserId,
  existingUserIds = [],
  disabled = false,
  className,
}: RelayTeamInviteUserProps) {
  const router =
    useRouter()


  const [
    query,
    setQuery,
  ] =
    useState(
      ""
    )


  const [
    results,
    setResults,
  ] =
    useState<
      ProfileSearchResult[]
    >([])


  const [
    searching,
    setSearching,
  ] =
    useState(
      false
    )


  const [
    searchError,
    setSearchError,
  ] =
    useState<
      string | null
    >(
      null
    )


  const [
    mutationError,
    setMutationError,
  ] =
    useState<
      string | null
    >(
      null
    )


  const [
    successUserId,
    setSuccessUserId,
  ] =
    useState<
      string | null
    >(
      null
    )


  const [
    invitingUserId,
    setInvitingUserId,
  ] =
    useState<
      string | null
    >(
      null
    )


  const [
    isPending,
    startTransition,
  ] =
    useTransition()


  const requestSequenceRef =
    useRef(
      0
    )


  const excludedUserIds =
    useMemo(
      () =>
        new Set([
          currentUserId,
          ...existingUserIds,
        ]),
      [
        currentUserId,
        existingUserIds,
      ]
    )


  const normalizedQuery =
    normalizeSearchQuery(
      query
    )


  const searchReady =
    normalizedQuery.length >=
    MIN_SEARCH_LENGTH


  /* ==========================================================
   * PROFILE SEARCH
   * ========================================================== */

  useEffect(() => {
    if (
      !searchReady ||
      disabled
    ) {
      requestSequenceRef.current +=
        1

      setResults(
        []
      )

      setSearching(
        false
      )

      setSearchError(
        null
      )

      return
    }


    const requestSequence =
      requestSequenceRef.current +
      1


    requestSequenceRef.current =
      requestSequence


    const timeout =
      window.setTimeout(
        () => {
          void searchProfiles({
            query:
              normalizedQuery,

            excludedUserIds,
          })
            .then(
              (
                nextResults
              ) => {
                if (
                  requestSequenceRef.current !==
                  requestSequence
                ) {
                  return
                }


                setResults(
                  nextResults
                )

                setSearchError(
                  null
                )
              }
            )
            .catch(
              (
                error
              ) => {
                if (
                  requestSequenceRef.current !==
                  requestSequence
                ) {
                  return
                }


                console.error(
                  "[RelayTeamInviteUser] Profile search failed:",
                  error
                )

                setResults(
                  []
                )

                setSearchError(
                  "We could not search Roam users. Please try again."
                )
              }
            )
            .finally(
              () => {
                if (
                  requestSequenceRef.current ===
                  requestSequence
                ) {
                  setSearching(
                    false
                  )
                }
              }
            )
        },
        SEARCH_DEBOUNCE_MS
      )


    setSearching(
      true
    )

    setSearchError(
      null
    )


    return () => {
      window.clearTimeout(
        timeout
      )
    }
  }, [
    disabled,
    excludedUserIds,
    normalizedQuery,
    searchReady,
  ])


  /* ==========================================================
   * INVITE
   * ========================================================== */

  function handleInvite(
    profile:
      ProfileSearchResult
  ) {
    if (
      disabled ||
      isPending ||
      invitingUserId
    ) {
      return
    }


    setMutationError(
      null
    )

    setSuccessUserId(
      null
    )

    setInvitingUserId(
      profile.id
    )


    startTransition(
      () => {
        void (
          async () => {
            try {
              await inviteRelayTeamMember(
                teamId,
                profile.id
              )


              setSuccessUserId(
                profile.id
              )


              setResults(
                (
                  currentResults
                ) =>
                  currentResults.filter(
                    (
                      result
                    ) =>
                      result.id !==
                      profile.id
                  )
              )


              router.refresh()
            } catch (
              error
            ) {
              console.error(
                "[RelayTeamInviteUser] Relay invitation failed:",
                error
              )

              setMutationError(
                getMutationErrorMessage(
                  error
                )
              )
            } finally {
              setInvitingUserId(
                null
              )
            }
          }
        )()
      }
    )
  }


  /* ==========================================================
   * RENDER
   * ========================================================== */

  return (
    <div
      className={[
        "w-full min-w-0",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="rounded-[1.5rem] border border-white/[0.07] bg-black/20 p-4 sm:p-5">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/28">
            Add teammate
          </p>

          <h3 className="text-base font-semibold tracking-[-0.02em] text-white/82">
            Invite someone on Roam
          </h3>

          <p className="max-w-2xl text-xs leading-5 text-white/36">
            Search by username or full name.
            They will receive the Relay
            invitation on their profile.
          </p>
        </div>


        <div className="relative mt-4">
          <label
            htmlFor="relay-team-user-search"
            className="sr-only"
          >
            Search Roam users by username
            or full name
          </label>

          <div className="relative">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-white/25"
            >
              @
            </span>

            <input
              id="relay-team-user-search"
              type="search"
              value={
                query
              }
              onChange={
                (
                  event
                ) => {
                  setQuery(
                    event.target.value
                  )

                  setMutationError(
                    null
                  )

                  setSuccessUserId(
                    null
                  )
                }
              }
              disabled={
                disabled
              }
              autoComplete="off"
              autoCorrect="off"
              spellCheck={
                false
              }
              placeholder="Username or full name"
              className="min-h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] py-3 pl-9 pr-12 text-sm text-white outline-none transition placeholder:text-white/25 hover:border-white/[0.13] focus:border-violet-300/30 focus:bg-white/[0.05] focus:ring-2 focus:ring-violet-300/10 disabled:cursor-not-allowed disabled:opacity-50"
            />

            {searching ? (
              <span
                role="status"
                aria-label="Searching"
                className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-white/15 border-t-white/60"
              />
            ) : null}
          </div>


          {query.length >
            0 &&
          !searchReady ? (
            <p className="mt-2 text-[11px] leading-4 text-white/28">
              Enter at least{" "}
              {MIN_SEARCH_LENGTH} characters
              to search.
            </p>
          ) : null}


          {searchError ? (
            <p
              role="alert"
              className="mt-3 rounded-xl border border-red-300/12 bg-red-300/[0.035] px-3 py-2.5 text-xs leading-5 text-red-200/75"
            >
              {searchError}
            </p>
          ) : null}


          {mutationError ? (
            <p
              role="alert"
              className="mt-3 rounded-xl border border-red-300/12 bg-red-300/[0.035] px-3 py-2.5 text-xs leading-5 text-red-200/75"
            >
              {mutationError}
            </p>
          ) : null}


          {successUserId ? (
            <p
              role="status"
              className="mt-3 rounded-xl border border-emerald-300/12 bg-emerald-300/[0.035] px-3 py-2.5 text-xs leading-5 text-emerald-100/70"
            >
              Relay invitation sent.
            </p>
          ) : null}


          {searchReady &&
          !searching &&
          !searchError &&
          results.length ===
            0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-white/[0.07] px-4 py-5 text-center">
              <p className="text-xs font-medium text-white/38">
                No available Roam users
                matched that search.
              </p>
            </div>
          ) : null}


          {results.length >
          0 ? (
            <div
              role="listbox"
              aria-label="Roam user search results"
              className="mt-3 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0b0b0c]"
            >
              {results.map(
                (
                  profile,
                  index
                ) => {
                  const inviting =
                    invitingUserId ===
                    profile.id


                  return (
                    <div
                      key={
                        profile.id
                      }
                      role="option"
                      aria-selected={
                        false
                      }
                      className={[
                        "flex min-w-0 items-center gap-3 p-3 sm:p-4",

                        index >
                        0
                          ? "border-t border-white/[0.06]"
                          : "",
                      ].join(
                        " "
                      )}
                    >
                      <ProfileAvatar
                        profile={
                          profile
                        }
                      />


                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white/78">
                          {getProfilePrimaryLabel(
                            profile
                          )}
                        </p>

                        {profile.username ? (
                          <p className="mt-0.5 truncate text-xs text-white/35">
                            @
                            {
                              profile.username
                            }
                          </p>
                        ) : profile.fullName ? (
                          <p className="mt-0.5 truncate text-xs text-white/30">
                            Roam member
                          </p>
                        ) : null}
                      </div>


                      <button
                        type="button"
                        onClick={() =>
                          handleInvite(
                            profile
                          )
                        }
                        disabled={
                          disabled ||
                          Boolean(
                            invitingUserId
                          )
                        }
                        className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-black transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {inviting
                          ? "Inviting…"
                          : "Invite"}
                      </button>
                    </div>
                  )
                }
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}


/* ============================================================
 * SEARCH
 * ============================================================
 */

async function searchProfiles({
  query,
  excludedUserIds,
}: {
  query:
    string

  excludedUserIds:
    Set<string>
}): Promise<
  ProfileSearchResult[]
> {
  const supabase =
    supabaseBrowser()


  const searchPattern =
    `%${escapeLikePattern(
      query
    )}%`


  /*
   * Username and full-name queries are intentionally separate.
   * This avoids constructing a PostgREST `.or()` expression from
   * user-controlled text and keeps search input out of filter syntax.
   */

  const [
    usernameResult,
    fullNameResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "profiles"
        )
        .select(`
          id,
          username,
          full_name,
          avatar_url,
          deleted_at
        `)
        .is(
          "deleted_at",
          null
        )
        .ilike(
          "username",
          searchPattern
        )
        .limit(
          MAX_SEARCH_RESULTS
        ),

      supabase
        .from(
          "profiles"
        )
        .select(`
          id,
          username,
          full_name,
          avatar_url,
          deleted_at
        `)
        .is(
          "deleted_at",
          null
        )
        .ilike(
          "full_name",
          searchPattern
        )
        .limit(
          MAX_SEARCH_RESULTS
        ),
    ])


  if (
    usernameResult.error
  ) {
    throw usernameResult.error
  }


  if (
    fullNameResult.error
  ) {
    throw fullNameResult.error
  }


  const usernameRows =
    (
      usernameResult.data ??
      []
    ) as ProfileSearchRow[]


  const fullNameRows =
    (
      fullNameResult.data ??
      []
    ) as ProfileSearchRow[]


  const normalizedQuery =
    query.toLocaleLowerCase(
      "en-US"
    )


  const deduplicated =
    new Map<
      string,
      ProfileSearchRow
    >()


  for (
    const row of [
      ...usernameRows,
      ...fullNameRows,
    ]
  ) {
    if (
      excludedUserIds.has(
        row.id
      )
    ) {
      continue
    }


    if (
      row.deleted_at
    ) {
      continue
    }


    if (
      !normalizeNullableText(
        row.username
      ) &&
      !normalizeNullableText(
        row.full_name
      )
    ) {
      continue
    }


    if (
      !deduplicated.has(
        row.id
      )
    ) {
      deduplicated.set(
        row.id,
        row
      )
    }
  }


  return Array
    .from(
      deduplicated.values()
    )
    .sort(
      (
        first,
        second
      ) =>
        compareProfileSearchRows(
          first,
          second,
          normalizedQuery
        )
    )
    .slice(
      0,
      MAX_SEARCH_RESULTS
    )
    .map(
      (
        row
      ): ProfileSearchResult => ({
        id:
          row.id,

        username:
          normalizeNullableText(
            row.username
          ),

        fullName:
          normalizeNullableText(
            row.full_name
          ),

        avatarUrl:
          normalizeNullableText(
            row.avatar_url
          ),
      })
    )
}


/* ============================================================
 * SEARCH RANKING
 * ============================================================
 */

function compareProfileSearchRows(
  first:
    ProfileSearchRow,
  second:
    ProfileSearchRow,
  normalizedQuery:
    string
): number {
  const firstScore =
    getProfileSearchScore(
      first,
      normalizedQuery
    )


  const secondScore =
    getProfileSearchScore(
      second,
      normalizedQuery
    )


  if (
    firstScore !==
    secondScore
  ) {
    return (
      secondScore -
      firstScore
    )
  }


  return getProfilePrimaryLabel({
    username:
      first.username,

    fullName:
      first.full_name,
  }).localeCompare(
    getProfilePrimaryLabel({
      username:
        second.username,

      fullName:
        second.full_name,
    }),
    "en-US",
    {
      sensitivity:
        "base",
    }
  )
}


function getProfileSearchScore(
  row:
    ProfileSearchRow,
  normalizedQuery:
    string
): number {
  const username =
    normalizeNullableText(
      row.username
    )
      ?.toLocaleLowerCase(
        "en-US"
      ) ??
    ""


  const fullName =
    normalizeNullableText(
      row.full_name
    )
      ?.toLocaleLowerCase(
        "en-US"
      ) ??
    ""


  if (
    username ===
    normalizedQuery
  ) {
    return 100
  }


  if (
    username.startsWith(
      normalizedQuery
    )
  ) {
    return 90
  }


  if (
    fullName ===
    normalizedQuery
  ) {
    return 80
  }


  if (
    fullName.startsWith(
      normalizedQuery
    )
  ) {
    return 70
  }


  if (
    username.includes(
      normalizedQuery
    )
  ) {
    return 60
  }


  if (
    fullName.includes(
      normalizedQuery
    )
  ) {
    return 50
  }


  return 0
}


/* ============================================================
 * AVATAR
 * ============================================================
 */

function ProfileAvatar({
  profile,
}: {
  profile:
    ProfileSearchResult
}) {
  if (
    profile.avatarUrl
  ) {
    return (
      <img
        src={
          profile.avatarUrl
        }
        alt=""
        referrerPolicy="no-referrer"
        className="h-10 w-10 shrink-0 rounded-full bg-white/[0.05] object-cover ring-1 ring-white/[0.08]"
      />
    )
  }


  return (
    <div
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-300/20 to-cyan-300/10 text-xs font-bold text-white/65 ring-1 ring-white/[0.08]"
    >
      {getProfileInitials(
        profile
      )}
    </div>
  )
}


/* ============================================================
 * HELPERS
 * ============================================================
 */

function normalizeSearchQuery(
  value:
    string
): string {
  return value
    .trim()
    .replace(
      /^@+/,
      ""
    )
    .replace(
      /\s+/g,
      " "
    )
    .slice(
      0,
      80
    )
}


function escapeLikePattern(
  value:
    string
): string {
  return value
    .replace(
      /\\/g,
      "\\\\"
    )
    .replace(
      /%/g,
      "\\%"
    )
    .replace(
      /_/g,
      "\\_"
    )
}


function normalizeNullableText(
  value:
    string | null | undefined
): string | null {
  if (
    typeof value !==
    "string"
  ) {
    return null
  }


  const normalized =
    value
      .trim()
      .replace(
        /\s+/g,
        " "
      )


  return normalized.length >
    0
    ? normalized
    : null
}


function getProfilePrimaryLabel(
  profile: {
    username:
      string | null

    fullName:
      string | null
  }
): string {
  return (
    normalizeNullableText(
      profile.fullName
    ) ??
    (
      normalizeNullableText(
        profile.username
      )
        ? `@${normalizeNullableText(
            profile.username
          )}`
        : "Roam member"
    )
  )
}


function getProfileInitials(
  profile:
    ProfileSearchResult
): string {
  const source =
    normalizeNullableText(
      profile.fullName
    ) ??
    normalizeNullableText(
      profile.username
    ) ??
    "R"


  const parts =
    source
      .split(
        /\s+/
      )
      .filter(Boolean)


  if (
    parts.length ===
    1
  ) {
    return parts[0]
      .slice(
        0,
        2
      )
      .toUpperCase()
  }


  return `${parts[0]?.[0] ?? ""}${parts[
    parts.length -
      1
  ]?.[0] ?? ""}`
    .toUpperCase()
}


function getMutationErrorMessage(
  error:
    unknown
): string {
  if (
    error instanceof
      Error
  ) {
    const message =
      error.message.trim()


    if (
      message.length >
      0
    ) {
      return message
    }
  }


  return "We could not send this Relay invitation. Please try again."
}