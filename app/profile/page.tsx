"use client"

import {
  useEffect,
  useState,
  type ReactNode,
} from "react"
import Link from "next/link"

import ProfileForm from "./form"
import UserCrawls from "./UserCrawls"
import SavedProperties from "./SavedProperties"
import RoamPassport from "./RoamPassport"
import FavoritesSection from "./FavoritesSection"

import VisitHistorySection from "@/components/profile/VisitHistorySection"
import ProfileSnapshotLibrary, {
  type ProfileSnapshot,
} from "@/components/profile/ProfileSnapshotLibrary"

import {
  CREATOR_ROUTES,
} from "@/lib/creator/constants"

import type {
  PublicCreatorReputationSnapshot,
} from "@/lib/reputation/publicTypes"

import {
  supabaseBrowser,
} from "@/lib/supabase/client"

import {
  logEvent,
} from "@/lib/logEvent"

/* =========================================================
 * Data contracts
 * ======================================================= */

type SnapshotRow = {
  id: string
  title: string | null
  city: string | null
  cover_image_url: string | null
  route_summary: string | null
  checked_in_count: number | null
  total_stops: number | null
  visibility: string | null
  source_type: string | null
  source_id: string | null
  created_at: string
  updated_at: string | null
}

type ProfileCreatorRow = {
  username: string | null
  creator_mode_enabled: boolean | null
  creator_headline: string | null
}

type OwnerReputationDetail = {
  categoryId: string
  scope:
    | "global"
    | "city"
  cityKey: string | null

  reputationLevel:
    | "unranked"
    | "emerging"
    | "established"
    | "expert"
    | "elite"

  reputationScore: number
  verifiedVenueCount: number
  weightedVenueCount: number
  publicCollectionCount: number
  curatedVenueCount: number
  publicSnapshotCount: number
  completedFlowCount: number
  cityCount: number
  rank: number | null
  eligibleCreatorCount: number
  topPercent: number | null
  rankLabel: string | null
  policyVersion: number
  calculatedAt: string | null
  rankingCalculatedAt: string | null
}

type OwnerReputationResponse = {
  reputation:
    PublicCreatorReputationSnapshot

  found:
    boolean

  details:
    OwnerReputationDetail[]

  policyVersion:
    number

  warning?:
    string
}

type ProfileSectionId =
  | "passport"
  | "activity"
  | "saved"
  | "creator"
  | "settings"

type ProfileNavigationItem = {
  id: ProfileSectionId
  label: string
}

type ReputationStandingCard = {
  key: string
  categoryId: string
  categoryLabel: string
  scope:
    | "global"
    | "city"
  cityKey: string | null
  reputationLevel:
    OwnerReputationDetail["reputationLevel"]
  verifiedVenueCount: number
  rank: number | null
  eligibleCreatorCount: number
  topPercent: number | null
  rankLabel: string | null
}

/* =========================================================
 * Event safety
 * ======================================================= */

function safeLogEvent(
  eventName: string,
  metadata:
    Record<
      string,
      unknown
    > = {}
) {
  try {
    void Promise.resolve(
      logEvent(
        eventName,
        {
          metadata,
        }
      )
    )
  } catch (error) {
    console.warn(
      "logEvent failed:",
      eventName,
      error
    )
  }
}

/* =========================================================
 * Page
 * ======================================================= */

export default function UserProfilePage() {
  const [
    username,
    setUsername,
  ] =
    useState<
      string | null
    >(null)

  const [
    creatorModeEnabled,
    setCreatorModeEnabled,
  ] =
    useState(false)

  const [
    creatorHeadline,
    setCreatorHeadline,
  ] =
    useState<
      string | null
    >(null)

  const [
    snapshots,
    setSnapshots,
  ] =
    useState<
      ProfileSnapshot[]
    >([])

  const [
    snapshotsLoading,
    setSnapshotsLoading,
  ] =
    useState(true)

  const [
    snapshotsError,
    setSnapshotsError,
  ] =
    useState<
      string | null
    >(null)

  const [
    reputation,
    setReputation,
  ] =
    useState<
      PublicCreatorReputationSnapshot | null
    >(null)

  const [
    reputationDetails,
    setReputationDetails,
  ] =
    useState<
      OwnerReputationDetail[]
    >([])

  const [
    reputationLoading,
    setReputationLoading,
  ] =
    useState(true)

  const [
    reputationError,
    setReputationError,
  ] =
    useState<
      string | null
    >(null)

  useEffect(() => {
    let cancelled =
      false

    safeLogEvent(
      "profile_page_viewed"
    )

    async function loadProfilePageData() {
      const supabase =
        supabaseBrowser()

      const {
        data: {
          user,
        },
        error:
          authError,
      } =
        await supabase
          .auth
          .getUser()

      if (cancelled) {
        return
      }

      if (
        authError ||
        !user
      ) {
        if (authError) {
          console.error(
            "[profile/page] Failed to load authenticated user:",
            authError
          )
        }

        setSnapshotsLoading(
          false
        )

        setReputationLoading(
          false
        )

        return
      }

      const [
        profileResult,
        snapshotsResult,
        reputationResult,
      ] =
        await Promise.all([
          supabase
            .from(
              "profiles"
            )
            .select(`
              username,
              creator_mode_enabled,
              creator_headline
            `)
            .eq(
              "id",
              user.id
            )
            .maybeSingle(),

          supabase
            .from(
              "flow_snapshots"
            )
            .select(`
              id,
              title,
              city,
              cover_image_url,
              route_summary,
              checked_in_count,
              total_stops,
              visibility,
              source_type,
              source_id,
              created_at,
              updated_at
            `)
            .eq(
              "user_id",
              user.id
            )
            .order(
              "created_at",
              {
                ascending:
                  false,
              }
            ),

          fetch(
            "/api/profile/reputation",
            {
              method:
                "GET",

              credentials:
                "same-origin",

              cache:
                "no-store",

              headers: {
                Accept:
                  "application/json",
              },
            }
          ),
        ])

      if (cancelled) {
        return
      }

      if (
        profileResult.error
      ) {
        console.error(
          "[profile/page] Failed to load username and Creator Mode status:",
          profileResult.error
        )
      }

      const profile =
        (
          profileResult.data as
            ProfileCreatorRow | null
        ) ??
        null

      setUsername(
        profile?.username ??
        null
      )

      setCreatorModeEnabled(
        profile
          ?.creator_mode_enabled ===
          true
      )

      setCreatorHeadline(
        normalizeNullableText(
          profile
            ?.creator_headline
        )
      )

      if (
        !reputationResult.ok
      ) {
        console.error(
          "[profile/page] Failed to load owner reputation:",
          {
            status:
              reputationResult.status,

            statusText:
              reputationResult.statusText,
          }
        )

        setReputation(
          null
        )

        setReputationDetails(
          []
        )

        setReputationError(
          "Your reputation details could not be loaded."
        )

        setReputationLoading(
          false
        )
      } else {
        try {
          const reputationPayload =
            (
              await reputationResult
                .json()
            ) as OwnerReputationResponse

          if (cancelled) {
            return
          }

          setReputation(
            reputationPayload
              .reputation ??
            null
          )

          setReputationDetails(
            Array.isArray(
              reputationPayload
                .details
            )
              ? reputationPayload
                  .details
              : []
          )

          setReputationError(
            normalizeNullableText(
              reputationPayload
                .warning
            )
          )

          setReputationLoading(
            false
          )

          safeLogEvent(
            "profile_reputation_loaded",
            {
              reputation_found:
                reputationPayload
                  .found ===
                true,

              reputation_policy_version:
                reputationPayload
                  .policyVersion,

              reputation_category_count:
                reputationPayload
                  .reputation
                  ?.categories
                  ?.length ??
                0,

              reputation_detail_count:
                reputationPayload
                  .details
                  ?.length ??
                0,
            }
          )
        } catch (error) {
          console.error(
            "[profile/page] Failed to parse owner reputation response:",
            error
          )

          setReputation(
            null
          )

          setReputationDetails(
            []
          )

          setReputationError(
            "Your reputation details could not be loaded."
          )

          setReputationLoading(
            false
          )
        }
      }

      if (
        snapshotsResult.error
      ) {
        console.error(
          "[profile/page] Failed to load snapshot library:",
          snapshotsResult.error
        )

        setSnapshots(
          []
        )

        setSnapshotsError(
          "Failed to load your snapshot library."
        )

        setSnapshotsLoading(
          false
        )

        return
      }

      const normalizedSnapshots =
        (
          (
            snapshotsResult.data ??
            []
          ) as SnapshotRow[]
        ).map(
          normalizeSnapshot
        )

      setSnapshots(
        normalizedSnapshots
      )

      setSnapshotsError(
        null
      )

      setSnapshotsLoading(
        false
      )

      safeLogEvent(
        "profile_snapshot_library_loaded",
        {
          snapshot_count:
            normalizedSnapshots
              .length,

          public_snapshot_count:
            normalizedSnapshots
              .filter(
                (
                  snapshot
                ) =>
                  snapshot.visibility ===
                  "public"
              )
              .length,
        }
      )
    }

    void loadProfilePageData()

    return () => {
      cancelled =
        true
    }
  }, [])

  const navigationItems:
    ProfileNavigationItem[] = [
      {
        id:
          "passport",

        label:
          "Passport",
      },
      {
        id:
          "activity",

        label:
          "Activity",
      },
      {
        id:
          "saved",

        label:
          "Saved",
      },
      {
        id:
          "creator",

        label:
          "Creator",
      },
      {
        id:
          "settings",

        label:
          "Settings",
      },
    ]

  return (
    <div className="min-h-screen w-full overflow-x-clip bg-black text-white">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute left-[-20%] top-[-8%] h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl sm:left-[-12%]" />

        <div className="absolute right-[-25%] top-[18%] h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl sm:right-[-15%]" />
      </div>

      <div className="relative z-10 mx-auto w-full min-w-0 max-w-6xl px-4 pb-16 pt-[calc(4rem+env(safe-area-inset-top)+1rem)] sm:px-6">
        <ProfileHeader
          username={
            username
          }
        />

        <div className="mt-5">
          <ProfileNavigation
            items={
              navigationItems
            }
          />
        </div>

        <div className="mt-8 space-y-12 sm:space-y-16">
          <section
            id="passport"
            aria-labelledby="profile-passport-title"
            className="scroll-mt-28"
          >
            <ProfileSectionHeading
              id="profile-passport-title"
              eyebrow="Your Roam identity"
              title="Passport and reputation"
              description="See your activity, progress, earned category standing, and what your verified Roam footprint supports."
            />

            <div className="mt-5 w-full min-w-0 space-y-5">
              <RoamPassport />

              {reputationLoading ? (
                <ReputationSkeleton />
              ) : reputationError &&
                !reputation &&
                reputationDetails.length ===
                  0 ? (
                <ReputationError
                  message={
                    reputationError
                  }
                />
              ) : (
                <OwnerReputationPanel
                  reputation={
                    reputation
                  }
                  details={
                    reputationDetails
                  }
                  warning={
                    reputationError
                  }
                />
              )}
            </div>
          </section>

          <section
            id="activity"
            aria-labelledby="profile-activity-title"
            className="scroll-mt-28"
          >
            <ProfileSectionHeading
              id="profile-activity-title"
              eyebrow="Your Roams"
              title="Activity and memories"
              description="Revisit the places you explored, the flows you completed, and the moments you saved."
            />

            <div className="mt-5 space-y-5">
              <ProfilePanel
                eyebrow="Places"
                title="Visit history"
                description="A record of your verified venue activity."
              >
                <VisitHistorySection />
              </ProfilePanel>

              <ProfileDisclosure
                eyebrow="Moments"
                title="Flow snapshots"
                description="Photos and highlights saved from completed Roams."
                defaultOpen={
                  snapshots.length >
                  0
                }
              >
                {snapshotsLoading ? (
                  <SnapshotLibrarySkeleton />
                ) : snapshotsError ? (
                  <SnapshotLibraryError
                    message={
                      snapshotsError
                    }
                  />
                ) : (
                  <ProfileSnapshotLibrary
                    initialSnapshots={
                      snapshots
                    }
                  />
                )}
              </ProfileDisclosure>

              <ProfileDisclosure
                eyebrow="Flows"
                title="Hosted, upcoming, and past"
                description="Manage the Roams you created, joined, or completed."
              >
                <UserCrawls />
              </ProfileDisclosure>
            </div>
          </section>

          <section
            id="saved"
            aria-labelledby="profile-saved-title"
            className="scroll-mt-28"
          >
            <ProfileSectionHeading
              id="profile-saved-title"
              eyebrow="For later"
              title="Saved places and guides"
              description="Keep your favorite neighborhoods, venues, and routes easy to find."
            />

            <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-2 lg:items-start">
              <ProfilePanel
                eyebrow="Guides"
                title="Property guides"
                description="Neighborhood and destination guides you saved."
              >
                <SavedProperties />
              </ProfilePanel>

              <ProfilePanel
                eyebrow="Library"
                title="Saved venues and flows"
                description="Places and routes you may want to revisit."
              >
                <SavedLibraryShell />
              </ProfilePanel>
            </div>
          </section>

          <section
            id="creator"
            aria-labelledby="profile-creator-title"
            className="scroll-mt-28"
          >
            <ProfileSectionHeading
              id="profile-creator-title"
              eyebrow="Creator tools"
              title="Build your creator profile"
              description="Share your taste, collaborations, collections, and city perspective with the people discovering you."
            />

            <div className="mt-5">
              <ProfilePanel
                eyebrow="Creator Mode"
                title={
                  creatorModeEnabled
                    ? "Your creator profile"
                    : "Become a Roam creator"
                }
                description={
                  creatorModeEnabled
                    ? "Manage what people see when they visit your public creator profile."
                    : "Turn your Passport into a polished public profile when you are ready."
                }
              >
                <CreatorModeEntryCard
                  enabled={
                    creatorModeEnabled
                  }
                  headline={
                    creatorHeadline
                  }
                  username={
                    username
                  }
                />
              </ProfilePanel>
            </div>
          </section>

          <section
            id="settings"
            aria-labelledby="profile-settings-title"
            className="scroll-mt-28"
          >
            <ProfileSectionHeading
              id="profile-settings-title"
              eyebrow="Preferences"
              title="Profile settings"
              description="Update your identity, privacy, taste preferences, and social details."
            />

            <div className="mt-5">
              <ProfileDisclosure
                eyebrow="Account"
                title="Edit profile and preferences"
                description="Open this section when you need to make changes."
              >
                <ProfileForm />
              </ProfileDisclosure>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

/* =========================================================
 * Page structure
 * ======================================================= */

function ProfileHeader({
  username,
}: {
  username:
    string | null
}) {
  return (
    <header className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-400 sm:text-xs">
          My Roam
        </p>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Your city life,
          all together
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
          Track where you have been,
          save what you love, and shape
          what people see when they find
          you on Roam.
        </p>
      </div>

      {username ? (
        <Link
          href={`/u/${username}`}
          onClick={() =>
            safeLogEvent(
              "profile_public_profile_clicked",
              {
                username,
              }
            )
          }
          className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-5 py-2.5 text-sm font-semibold text-cyan-200 transition hover:border-cyan-400/60 hover:bg-cyan-500/20 hover:text-white sm:w-auto"
        >
          View public profile

          <span
            aria-hidden="true"
            className="ml-2"
          >
            →
          </span>
        </Link>
      ) : (
        <div className="w-full rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-xs leading-5 text-amber-200/80 sm:max-w-xs">
          Add a username in Settings
          before your public profile can
          be shared.
        </div>
      )}
    </header>
  )
}

function ProfileNavigation({
  items,
}: {
  items:
    ProfileNavigationItem[]
}) {
  return (
    <nav
      aria-label="Profile sections"
      className="sticky top-[calc(4rem+env(safe-area-inset-top)+0.5rem)] z-30 -mx-4 border-y border-neutral-800/80 bg-black/85 px-4 py-3 backdrop-blur-xl sm:mx-0 sm:rounded-2xl sm:border"
    >
      <div className="flex min-w-0 gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map(
          (
            item
          ) => (
            <a
              key={
                item.id
              }
              href={`#${item.id}`}
              className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full border border-neutral-800 bg-neutral-950 px-4 py-2 text-xs font-semibold text-neutral-400 transition hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              {item.label}
            </a>
          )
        )}
      </div>
    </nav>
  )
}

function ProfileSectionHeading({
  id,
  eyebrow,
  title,
  description,
}: {
  id:
    string

  eyebrow:
    string

  title:
    string

  description:
    string
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-400">
        {eyebrow}
      </p>

      <h2
        id={id}
        className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl"
      >
        {title}
      </h2>

      <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
        {description}
      </p>
    </div>
  )
}

/* =========================================================
 * Reputation
 * ======================================================= */

function OwnerReputationPanel({
  reputation,
  details,
  warning,
}: {
  reputation:
    PublicCreatorReputationSnapshot | null

  details:
    OwnerReputationDetail[]

  warning:
    string | null
}) {
  const standings =
    buildReputationStandings(
      details
    )

  const earnedStandings =
    standings.filter(
      (
        standing
      ) =>
        standing
          .reputationLevel !==
        "unranked"
    )

  const visibleStandings =
    (
      earnedStandings.length >
      0
        ? earnedStandings
        : standings
    ).slice(
      0,
      3
    )

  const hiddenStandingCount =
    Math.max(
      0,
      (
        earnedStandings.length >
        0
          ? earnedStandings
          : standings
      ).length -
        visibleStandings.length
    )

  const hasReputation =
    Boolean(
      reputation
        ?.headline
    ) ||
    details.length >
      0

  if (
    !hasReputation &&
    !warning
  ) {
    return null
  }

  return (
    <section
      aria-labelledby="category-standing-title"
      className="relative w-full min-w-0 overflow-hidden rounded-[1.75rem] border border-neutral-800 bg-neutral-950/70 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-5"
    >
      <div className="relative z-10 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-500">
            Category standing
          </p>

          <h3
            id="category-standing-title"
            className="mt-2 text-lg font-semibold text-white"
          >
            How you compare in your
            strongest categories
          </h3>

          <p className="mt-1 max-w-2xl text-xs leading-5 text-neutral-500 sm:text-sm sm:leading-6">
            Percentiles compare your
            qualifying activity with other
            eligible Roam creators. Smaller
            populations remain private
            until the comparison is
            meaningful.
          </p>
        </div>

        {reputation
          ?.highestLevel ? (
          <span className="inline-flex w-fit shrink-0 items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200">
            {formatDisplayLabel(
              reputation
                .highestLevel
            )}
          </span>
        ) : null}
      </div>

      {visibleStandings.length >
      0 ? (
        <>
          <div className="relative z-10 mt-5 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleStandings.map(
              (
                standing
              ) => {
                const display =
                  buildStandingDisplay(
                    standing
                  )

                return (
                  <article
                    key={
                      standing.key
                    }
                    className="min-w-0 rounded-2xl border border-neutral-800 bg-black/25 p-4"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-white">
                          {
                            standing
                              .categoryLabel
                          }
                        </p>

                        <p className="mt-1 text-[11px] text-neutral-500">
                          {buildStandingScopeLabel(
                            standing
                          )}
                        </p>
                      </div>

                      <span className="shrink-0 rounded-full border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-[10px] font-semibold text-neutral-300">
                        {formatDisplayLabel(
                          standing
                            .reputationLevel
                        )}
                      </span>
                    </div>

                    <div
                      className={[
                        "mt-4 rounded-2xl border px-4 py-4",

                        display.tone ===
                        "active"
                          ? "border-cyan-500/20 bg-cyan-500/[0.07]"
                          : "border-neutral-800 bg-neutral-950/70",
                      ].join(
                        " "
                      )}
                    >
                      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                        Your standing
                      </p>

                      <p
                        className={[
                          "mt-1 break-words text-2xl font-semibold tracking-tight",

                          display.tone ===
                          "active"
                            ? "text-cyan-200"
                            : "text-neutral-300",
                        ].join(
                          " "
                        )}
                      >
                        {
                          display.primary
                        }
                      </p>

                      <p className="mt-1 text-xs leading-5 text-neutral-500">
                        {
                          display.secondary
                        }
                      </p>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-neutral-500">
                      <span>
                        {standing
                          .verifiedVenueCount
                          .toLocaleString(
                            "en-US"
                          )}{" "}
                        verified{" "}
                        {standing
                          .verifiedVenueCount ===
                        1
                          ? "venue"
                          : "venues"}
                      </span>

                      {standing.rank !==
                        null &&
                      standing
                        .eligibleCreatorCount >
                        0 ? (
                        <span className="shrink-0">
                          #
                          {standing.rank.toLocaleString(
                            "en-US"
                          )}{" "}
                          of{" "}
                          {standing
                            .eligibleCreatorCount
                            .toLocaleString(
                              "en-US"
                            )}
                        </span>
                      ) : null}
                    </div>
                  </article>
                )
              }
            )}
          </div>

          {hiddenStandingCount >
          0 ? (
            <p className="relative z-10 mt-4 text-xs leading-5 text-neutral-500">
              Showing your strongest{" "}
              {visibleStandings.length.toLocaleString(
                "en-US"
              )}{" "}
              category standings.{" "}
              {hiddenStandingCount.toLocaleString(
                "en-US"
              )}{" "}
              more are still being
              tracked.
            </p>
          ) : null}
        </>
      ) : (
        <div className="relative z-10 mt-5 rounded-2xl border border-neutral-800 bg-black/25 p-4">
          <p className="text-sm font-semibold text-white">
            Category comparisons are
            still building
          </p>

          <p className="mt-1 text-xs leading-5 text-neutral-500">
            Keep visiting verified venues
            and completing genuine Roam
            activity. Percentile standings
            appear once enough eligible
            creators can be compared
            fairly.
          </p>
        </div>
      )}

      {warning ? (
        <p className="relative z-10 mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2.5 text-xs leading-5 text-amber-200/80">
          {warning}
        </p>
      ) : null}
    </section>
  )
}

function ReputationSkeleton() {
  return (
    <section
      className="w-full min-w-0 rounded-[1.75rem] border border-neutral-800 bg-neutral-950/70 p-5"
      aria-label="Loading category standings"
    >
      <div className="animate-pulse">
        <div className="h-3 w-32 rounded bg-neutral-800" />

        <div className="mt-3 h-6 w-72 max-w-full rounded bg-neutral-800" />

        <div className="mt-2 h-4 w-96 max-w-full rounded bg-neutral-900" />

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            0,
            1,
            2,
          ].map(
            (
              item
            ) => (
              <div
                key={
                  item
                }
                className="h-44 rounded-2xl border border-neutral-800 bg-black/25"
              />
            )
          )}
        </div>
      </div>
    </section>
  )
}

function ReputationError({
  message,
}: {
  message:
    string
}) {
  return (
    <section className="w-full min-w-0 rounded-[1.75rem] border border-red-900/50 bg-red-950/20 p-5 text-white">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-red-400">
        Category standing
      </p>

      <h3 className="mt-2 text-xl font-semibold text-white">
        Reputation unavailable
      </h3>

      <p className="mt-2 break-words text-sm leading-6 text-red-300">
        {message}
      </p>
    </section>
  )
}

/* =========================================================
 * Reputation derivation
 * ======================================================= */

function buildReputationStandings(
  details:
    OwnerReputationDetail[]
): ReputationStandingCard[] {
  const latestPolicyVersion =
    details.reduce<
      number | null
    >(
      (
        latest,
        detail
      ) => {
        if (
          latest ===
            null ||
          detail
            .policyVersion >
            latest
        ) {
          return detail
            .policyVersion
        }

        return latest
      },
      null
    )

  const source =
    latestPolicyVersion ===
    null
      ? details
      : details.filter(
          (
            detail
          ) =>
            detail
              .policyVersion ===
            latestPolicyVersion
        )

  const standings =
    source.map(
      (
        detail
      ): ReputationStandingCard => ({
        key: [
          detail
            .categoryId,
          detail.scope,
          detail.cityKey ??
            "global",
        ].join(
          ":"
        ),

        categoryId:
          detail
            .categoryId,

        categoryLabel:
          formatCategoryLabel(
            detail
              .categoryId
          ),

        scope:
          detail.scope,

        cityKey:
          detail
            .cityKey,

        reputationLevel:
          detail
            .reputationLevel,

        verifiedVenueCount:
          normalizeNonNegativeInteger(
            detail
              .verifiedVenueCount
          ),

        rank:
          normalizePositiveInteger(
            detail.rank
          ),

        eligibleCreatorCount:
          normalizeNonNegativeInteger(
            detail
              .eligibleCreatorCount
          ),

        topPercent:
          normalizePercentage(
            detail
              .topPercent
          ),

        rankLabel:
          normalizeNullableText(
            detail
              .rankLabel
          ),
      })
    )

  return standings.sort(
    compareReputationStandings
  )
}

function compareReputationStandings(
  first:
    ReputationStandingCard,
  second:
    ReputationStandingCard
): number {
  const firstHasPercentile =
    first.topPercent !==
    null

  const secondHasPercentile =
    second.topPercent !==
    null

  if (
    firstHasPercentile !==
    secondHasPercentile
  ) {
    return firstHasPercentile
      ? -1
      : 1
  }

  if (
    first.topPercent !==
      null &&
    second.topPercent !==
      null &&
    first.topPercent !==
      second.topPercent
  ) {
    return (
      first.topPercent -
      second.topPercent
    )
  }

  const firstHasRank =
    first.rank !==
      null &&
    first.eligibleCreatorCount >
      0

  const secondHasRank =
    second.rank !==
      null &&
    second.eligibleCreatorCount >
      0

  if (
    firstHasRank !==
    secondHasRank
  ) {
    return firstHasRank
      ? -1
      : 1
  }

  const levelDifference =
    getReputationLevelRank(
      second
        .reputationLevel
    ) -
    getReputationLevelRank(
      first
        .reputationLevel
    )

  if (
    levelDifference !==
    0
  ) {
    return levelDifference
  }

  if (
    first
      .verifiedVenueCount !==
    second
      .verifiedVenueCount
  ) {
    return (
      second
        .verifiedVenueCount -
      first
        .verifiedVenueCount
    )
  }

  if (
    first.scope !==
    second.scope
  ) {
    return first.scope ===
      "city"
      ? -1
      : 1
  }

  return first
    .categoryLabel
    .localeCompare(
      second
        .categoryLabel,
      "en-US",
      {
        sensitivity:
          "base",
      }
    )
}

function buildStandingDisplay(
  standing:
    ReputationStandingCard
): {
  primary:
    string

  secondary:
    string

  tone:
    "active" | "building"
} {
  if (
    standing.topPercent !==
    null
  ) {
    const formattedPercent =
      formatPercentage(
        standing
          .topPercent
      )

    return {
      primary:
        `Top ${formattedPercent}%`,

      secondary:
        standing.rankLabel ??
        "Compared with eligible creators in this category.",

      tone:
        "active",
    }
  }

  if (
    standing.rank !==
      null &&
    standing
      .eligibleCreatorCount >
      1
  ) {
    const calculatedTopPercent =
      Math.min(
        100,
        Math.max(
          0.1,
          (
            standing.rank /
            standing
              .eligibleCreatorCount
          ) *
            100
        )
      )

    return {
      primary:
        `Top ${formatPercentage(
          calculatedTopPercent
        )}%`,

      secondary:
        `Rank #${standing.rank.toLocaleString(
          "en-US"
        )} of ${standing.eligibleCreatorCount.toLocaleString(
          "en-US"
        )} eligible creators.`,

      tone:
        "active",
    }
  }

  if (
    standing.rankLabel
  ) {
    return {
      primary:
        standing.rankLabel,

      secondary:
        "Your comparison is available, but the wider percentile is still developing.",

      tone:
        "active",
    }
  }

  return {
    primary:
      "Percentile building",

    secondary:
      standing
        .eligibleCreatorCount >
      0
        ? `${standing.eligibleCreatorCount.toLocaleString(
            "en-US"
          )} eligible ${
            standing
              .eligibleCreatorCount ===
            1
              ? "creator is"
              : "creators are"
          } currently available for comparison.`
        : "More eligible creators are needed before a fair percentile can be shown.",

    tone:
      "building",
  }
}

function buildStandingScopeLabel(
  standing:
    ReputationStandingCard
): string {
  if (
    standing.scope ===
    "global"
  ) {
    return "Global standing"
  }

  return standing.cityKey
    ? `${formatDisplayLabel(
        standing
          .cityKey
      )} standing`
    : "City standing"
}

function getReputationLevelRank(
  level:
    OwnerReputationDetail["reputationLevel"]
): number {
  if (
    level ===
    "elite"
  ) {
    return 4
  }

  if (
    level ===
    "expert"
  ) {
    return 3
  }

  if (
    level ===
    "established"
  ) {
    return 2
  }

  if (
    level ===
    "emerging"
  ) {
    return 1
  }

  return 0
}

/* =========================================================
 * Creator Mode
 * ======================================================= */

function CreatorModeEntryCard({
  enabled,
  headline,
  username,
}: {
  enabled:
    boolean

  headline:
    string | null

  username:
    string | null
}) {
  const publicProfileHref =
    username
      ? CREATOR_ROUTES
          .publicProfile(
            username
          )
      : null

  return (
    <div className="w-full min-w-0 space-y-4">
      <div
        className={[
          "w-full min-w-0 rounded-2xl border p-4",

          enabled
            ? "border-emerald-500/25 bg-emerald-500/[0.07]"
            : "border-neutral-800 bg-black/25",
        ].join(
          " "
        )}
      >
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <div
              className={[
                "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",

                enabled
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-neutral-700 bg-neutral-900 text-neutral-500",
              ].join(
                " "
              )}
            >
              <span
                aria-hidden="true"
                className={[
                  "h-2 w-2 rounded-full",

                  enabled
                    ? "bg-emerald-400"
                    : "bg-neutral-600",
                ].join(
                  " "
                )}
              />

              {enabled
                ? "Live"
                : "Not active"}
            </div>

            <p className="mt-3 break-words text-base font-semibold text-white">
              {headline ??
                (
                  enabled
                    ? "Your creator profile is live"
                    : "Share your city taste with more people"
                )}
            </p>

            <p className="mt-1 text-sm leading-6 text-neutral-500">
              {enabled
                ? "Your public profile can feature your city activity, social links, collaboration interests, collections, and reputation."
                : "Creator Mode turns your existing Roam activity into a polished public profile. Nothing changes publicly until you enable and save it."}
            </p>
          </div>
        </div>
      </div>

      <div className="grid min-w-0 gap-2 sm:grid-cols-2">
        <Link
          href={
            CREATOR_ROUTES
              .settings
          }
          onClick={() =>
            safeLogEvent(
              "profile_creator_settings_clicked",
              {
                creator_mode_enabled:
                  enabled,
              }
            )
          }
          className="inline-flex min-h-11 min-w-0 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-center text-sm font-semibold text-cyan-300 transition hover:border-cyan-400/60 hover:bg-cyan-500/20 hover:text-cyan-100"
        >
          {enabled
            ? "Manage Creator Mode"
            : "Set up Creator Mode"}
        </Link>

        <Link
          href={
            CREATOR_ROUTES
              .collections
          }
          onClick={() =>
            safeLogEvent(
              "profile_creator_collections_clicked",
              {
                creator_mode_enabled:
                  enabled,
              }
            )
          }
          className="inline-flex min-h-11 min-w-0 items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-2.5 text-center text-sm font-semibold text-indigo-300 transition hover:border-indigo-400/60 hover:bg-indigo-500/20 hover:text-indigo-100"
        >
          Manage collections
        </Link>
      </div>

      {enabled &&
      publicProfileHref ? (
        <Link
          href={
            publicProfileHref
          }
          onClick={() =>
            safeLogEvent(
              "profile_creator_preview_clicked",
              {
                username,
              }
            )
          }
          className="inline-flex min-h-11 w-full min-w-0 items-center justify-center rounded-full border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-center text-sm font-medium text-neutral-300 transition hover:border-neutral-600 hover:bg-neutral-900 hover:text-white"
        >
          Preview creator profile

          <span
            aria-hidden="true"
            className="ml-2"
          >
            →
          </span>
        </Link>
      ) : null}

      {!username ? (
        <p className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2.5 text-xs leading-5 text-amber-200/80">
          Add a username in Profile
          Settings before your creator
          profile can have a public link.
        </p>
      ) : null}
    </div>
  )
}

/* =========================================================
 * Saved library
 * ======================================================= */

function SavedLibraryShell() {
  const [
    expanded,
    setExpanded,
  ] =
    useState(false)

  return (
    <div className="w-full min-w-0 space-y-3">
      <div
        className={[
          "relative w-full min-w-0 overflow-hidden rounded-2xl border border-neutral-800 bg-black/20",

          expanded
            ? "max-h-none"
            : "max-h-[420px]",
        ].join(
          " "
        )}
      >
        <div
          className={[
            "w-full min-w-0 space-y-4 p-3 sm:p-4",

            "[&_section]:min-w-0 [&_section]:space-y-3",

            "[&_h2]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-white",

            "[&_ul]:min-w-0 [&_ul]:gap-3 [&_ul]:space-y-3",

            "[&_li]:!min-w-0 [&_li]:!rounded-2xl [&_li]:!border-neutral-800 [&_li]:!bg-neutral-900/70 [&_li]:!p-3 [&_li]:!shadow-none",

            "[&_h3]:!text-sm [&_h3]:!font-semibold [&_h3]:!text-white",

            "[&_p]:!text-xs [&_p]:!text-neutral-400",

            "[&_span]:!text-neutral-300",

            "[&_a]:!text-cyan-300 [&_a:hover]:!text-cyan-100",

            "[&_button]:!text-cyan-300 [&_button:hover]:!text-cyan-100",

            "[&_.text-red-600]:!text-red-300",

            "[&_.text-blue-600]:!text-cyan-300",

            "[&_.text-gray-500]:!text-neutral-500",

            "[&_.bg-white]:!bg-neutral-900/70",

            "[&_.border-gray-200]:!border-neutral-800",
          ].join(
            " "
          )}
        >
          <FavoritesSection />
        </div>

        {!expanded ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-neutral-950 via-neutral-950/95 to-transparent" />
        ) : null}
      </div>

      <button
        type="button"
        onClick={() =>
          setExpanded(
            (
              value
            ) =>
              !value
          )
        }
        aria-expanded={
          expanded
        }
        className="inline-flex min-h-10 w-full items-center justify-center rounded-full border border-neutral-800 bg-neutral-950/80 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:border-cyan-500/40 hover:bg-cyan-500/10 sm:w-auto"
      >
        {expanded
          ? "Show less"
          : "View full saved library"}
      </button>
    </div>
  )
}

/* =========================================================
 * Snapshot states
 * ======================================================= */

function SnapshotLibrarySkeleton() {
  return (
    <section
      className="w-full min-w-0 rounded-2xl border border-neutral-800 bg-neutral-950 p-4 text-white sm:p-5"
      aria-label="Loading snapshot library"
    >
      <div className="min-w-0 animate-pulse">
        <div className="h-3 w-28 max-w-full rounded bg-neutral-800" />

        <div className="mt-3 h-6 w-48 max-w-full rounded bg-neutral-800" />

        <div className="mt-2 h-4 w-72 max-w-full rounded bg-neutral-900" />

        <div className="mt-5 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            0,
            1,
            2,
          ].map(
            (
              item
            ) => (
              <div
                key={
                  item
                }
                className="min-w-0 overflow-hidden rounded-2xl border border-neutral-800 bg-black/30"
              >
                <div className="aspect-square bg-neutral-900" />

                <div className="space-y-3 p-4">
                  <div className="h-4 w-2/3 rounded bg-neutral-800" />

                  <div className="h-3 w-1/2 rounded bg-neutral-900" />

                  <div className="h-10 rounded-xl bg-neutral-900" />
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </section>
  )
}

function SnapshotLibraryError({
  message,
}: {
  message:
    string
}) {
  return (
    <section className="w-full min-w-0 rounded-2xl border border-red-900/50 bg-red-950/20 p-5 text-white">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-red-400">
        Flow snapshots
      </p>

      <h3 className="mt-2 text-xl font-semibold text-white">
        Snapshot library unavailable
      </h3>

      <p className="mt-2 break-words text-sm leading-6 text-red-300">
        {message}
      </p>
    </section>
  )
}

/* =========================================================
 * Shared panels
 * ======================================================= */

function ProfilePanel({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow:
    string

  title:
    string

  description?:
    string

  children:
    ReactNode
}) {
  return (
    <section className="w-full min-w-0 overflow-hidden rounded-[1.75rem] border border-neutral-800/90 bg-neutral-950/70 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-5">
      <div className="mb-4 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-500">
          {eyebrow}
        </p>

        <h3 className="mt-1 break-words text-lg font-semibold text-white">
          {title}
        </h3>

        {description ? (
          <p className="mt-1 break-words text-xs leading-5 text-neutral-500">
            {description}
          </p>
        ) : null}
      </div>

      <div className="w-full min-w-0">
        {children}
      </div>
    </section>
  )
}

function ProfileDisclosure({
  eyebrow,
  title,
  description,
  children,
  defaultOpen = false,
}: {
  eyebrow:
    string

  title:
    string

  description?:
    string

  children:
    ReactNode

  defaultOpen?:
    boolean
}) {
  return (
    <details
      open={
        defaultOpen
      }
      className="group w-full min-w-0 overflow-hidden rounded-[1.75rem] border border-neutral-800/90 bg-neutral-950/70 shadow-2xl shadow-black/20 backdrop-blur-xl"
    >
      <summary className="flex min-h-[88px] cursor-pointer list-none items-center justify-between gap-4 p-4 outline-none transition hover:bg-white/[0.02] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400 sm:p-5 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-500">
            {eyebrow}
          </p>

          <h3 className="mt-1 break-words text-lg font-semibold text-white">
            {title}
          </h3>

          {description ? (
            <p className="mt-1 break-words text-xs leading-5 text-neutral-500">
              {description}
            </p>
          ) : null}
        </div>

        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-800 bg-black/30 text-lg text-neutral-400 transition group-open:rotate-45 group-open:border-cyan-500/30 group-open:text-cyan-300"
        >
          +
        </span>
      </summary>

      <div className="border-t border-neutral-800/80 p-3 sm:p-5">
        <div className="w-full min-w-0">
          {children}
        </div>
      </div>
    </details>
  )
}

/* =========================================================
 * Normalization
 * ======================================================= */

function normalizeSnapshot(
  snapshot:
    SnapshotRow
): ProfileSnapshot {
  return {
    id:
      snapshot.id,

    title:
      snapshot.title,

    city:
      snapshot.city,

    cover_image_url:
      snapshot
        .cover_image_url,

    route_summary:
      snapshot
        .route_summary,

    checked_in_count:
      typeof snapshot
        .checked_in_count ===
        "number"
        ? snapshot
            .checked_in_count
        : 0,

    total_stops:
      typeof snapshot
        .total_stops ===
        "number"
        ? snapshot
            .total_stops
        : 0,

    visibility:
      snapshot.visibility ===
      "private"
        ? "private"
        : "public",

    source_type:
      snapshot
        .source_type,

    source_id:
      snapshot
        .source_id,

    created_at:
      snapshot
        .created_at,

    updated_at:
      snapshot
        .updated_at,
  }
}

function normalizeNullableText(
  value:
    | string
    | null
    | undefined
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

function normalizeFiniteNumber(
  value:
    unknown
): number | null {
  if (
    typeof value ===
      "number" &&
    Number.isFinite(
      value
    )
  ) {
    return value
  }

  if (
    typeof value ===
      "string" &&
    value.trim().length >
      0
  ) {
    const parsed =
      Number(
        value
      )

    return Number.isFinite(
      parsed
    )
      ? parsed
      : null
  }

  return null
}

function normalizeNonNegativeInteger(
  value:
    unknown
): number {
  const normalized =
    normalizeFiniteNumber(
      value
    )

  if (
    normalized ===
      null ||
    normalized <=
      0
  ) {
    return 0
  }

  return Math.trunc(
    normalized
  )
}

function normalizePositiveInteger(
  value:
    unknown
): number | null {
  const normalized =
    normalizeFiniteNumber(
      value
    )

  if (
    normalized ===
      null ||
    normalized <=
      0
  ) {
    return null
  }

  return Math.trunc(
    normalized
  )
}

function normalizePercentage(
  value:
    unknown
): number | null {
  const normalized =
    normalizeFiniteNumber(
      value
    )

  if (
    normalized ===
      null ||
    normalized <
      0
  ) {
    return null
  }

  return Math.min(
    100,
    normalized
  )
}

function formatCategoryLabel(
  value:
    string
): string {
  const labels:
    Record<
      string,
      string
    > = {
      activities_entertainment:
        "Activities & Entertainment",

      arts_culture:
        "Arts & Culture",

      bakeries_desserts:
        "Bakeries & Desserts",

      bars_pubs:
        "Bars & Pubs",

      books:
        "Books & Libraries",

      cocktail_bars:
        "Cocktail Bars",

      coffee:
        "Coffee",

      markets_shopping:
        "Markets & Shopping",

      music_venues:
        "Live Music",

      nightlife:
        "Nightlife",

      outdoors:
        "Outdoors",

      restaurants:
        "Restaurants",

      wellness_fitness:
        "Wellness & Fitness",

      wine_bars:
        "Wine Bars",
    }

  return (
    labels[
      value
    ] ??
    formatDisplayLabel(
      value
    )
  )
}

function formatDisplayLabel(
  value:
    string
): string {
  return value
    .replace(
      /[_-]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim()
    .replace(
      /\b\w/g,
      (
        character
      ) =>
        character
          .toUpperCase()
    )
}

function formatPercentage(
  value:
    number
): string {
  return value.toLocaleString(
    "en-US",
    {
      maximumFractionDigits:
        value <
        1
          ? 1
          : 0,
    }
  )
}