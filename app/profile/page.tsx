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

import RelayInvitationsPanel, {
  type RelayInvitation,
} from "@/components/profile/RelayInvitationsPanel"
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

type RelayInvitationMembershipRow = {
  id: string
  team_id: string
  created_at: string
}

type RelayInvitationTeamRow = {
  id: string
  relay_id: string
  status: string
}

type RelayInvitationRelayRow = {
  id: string
  title: string
  city: string | null
  theme: string | null
  min_team_size: number
  max_team_size: number
}

type RelayInvitationJoinedMemberRow = {
  team_id: string
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
    relayInvitations,
    setRelayInvitations,
  ] =
    useState<
      RelayInvitation[]
    >([])

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
        relayInvitationMembershipsResult,
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

          supabase
            .from(
              "roam_relay_team_members"
            )
            .select(`
              id,
              team_id,
              created_at
            `)
            .eq(
              "user_id",
              user.id
            )
            .eq(
              "member_status",
              "invited"
            )
            .order(
              "created_at",
              {
                ascending:
                  false,
              }
            ),
        ])

      if (cancelled) {
        return
      }

      if (
        relayInvitationMembershipsResult.error
      ) {
        console.error(
          "[profile/page] Failed to load Relay invitations:",
          relayInvitationMembershipsResult.error
        )

        setRelayInvitations(
          []
        )
      } else {
        const invitationMemberships =
          (
            relayInvitationMembershipsResult.data ??
            []
          ) as RelayInvitationMembershipRow[]


        if (
          invitationMemberships.length ===
          0
        ) {
          setRelayInvitations(
            []
          )
        } else {
          const teamIds =
            Array.from(
              new Set(
                invitationMemberships.map(
                  (
                    membership
                  ) =>
                    membership.team_id
                )
              )
            )


          const [
            teamsResult,
            joinedMembersResult,
          ] =
            await Promise.all([
              supabase
                .from(
                  "roam_relay_teams"
                )
                .select(`
                  id,
                  relay_id,
                  status
                `)
                .in(
                  "id",
                  teamIds
                )
                .in(
                  "status",
                  [
                    "forming",
                    "ready",
                    "active",
                  ]
                ),

              supabase
                .from(
                  "roam_relay_team_members"
                )
                .select(`
                  team_id
                `)
                .in(
                  "team_id",
                  teamIds
                )
                .eq(
                  "member_status",
                  "joined"
                ),
            ])


          if (cancelled) {
            return
          }


          if (
            teamsResult.error
          ) {
            console.error(
              "[profile/page] Failed to load Relay invitation teams:",
              teamsResult.error
            )

            setRelayInvitations(
              []
            )
          } else {
            const invitationTeams =
              (
                teamsResult.data ??
                []
              ) as RelayInvitationTeamRow[]


            const relayIds =
              Array.from(
                new Set(
                  invitationTeams.map(
                    (
                      team
                    ) =>
                      team.relay_id
                  )
                )
              )


            if (
              relayIds.length ===
              0
            ) {
              setRelayInvitations(
                []
              )
            } else {
              const relaysResult =
                await supabase
                  .from(
                    "roam_relays"
                  )
                  .select(`
                    id,
                    title,
                    city,
                    theme,
                    min_team_size,
                    max_team_size
                  `)
                  .in(
                    "id",
                    relayIds
                  )


              if (cancelled) {
                return
              }


              if (
                relaysResult.error
              ) {
                console.error(
                  "[profile/page] Failed to load Relay invitation definitions:",
                  relaysResult.error
                )

                setRelayInvitations(
                  []
                )
              } else {
                if (
                  joinedMembersResult.error
                ) {
                  console.error(
                    "[profile/page] Failed to load Relay invitation joined-member counts:",
                    joinedMembersResult.error
                  )
                }


                const invitationRelays =
                  (
                    relaysResult.data ??
                    []
                  ) as RelayInvitationRelayRow[]


                const joinedMembers =
                  (
                    joinedMembersResult.data ??
                    []
                  ) as RelayInvitationJoinedMemberRow[]


                const teamById =
                  new Map(
                    invitationTeams.map(
                      (
                        team
                      ) => [
                        team.id,
                        team,
                      ]
                    )
                  )


                const relayById =
                  new Map(
                    invitationRelays.map(
                      (
                        relay
                      ) => [
                        relay.id,
                        relay,
                      ]
                    )
                  )


                const joinedCountByTeamId =
                  new Map<
                    string,
                    number
                  >()


                joinedMembers.forEach(
                  (
                    member
                  ) => {
                    joinedCountByTeamId.set(
                      member.team_id,
                      (
                        joinedCountByTeamId.get(
                          member.team_id
                        ) ??
                        0
                      ) +
                        1
                    )
                  }
                )


                const normalizedRelayInvitations =
                  invitationMemberships.flatMap(
                    (
                      membership
                    ): RelayInvitation[] => {
                      const team =
                        teamById.get(
                          membership.team_id
                        )


                      if (
                        !team
                      ) {
                        return []
                      }


                      const relay =
                        relayById.get(
                          team.relay_id
                        )


                      if (
                        !relay
                      ) {
                        return []
                      }


                      return [
                        {
                          membershipId:
                            membership.id,

                          teamId:
                            team.id,

                          relayId:
                            relay.id,

                          relayTitle:
                            relay.title,

                          relayCity:
                            relay.city,

                          relayTheme:
                            relay.theme,

                          teamStatus:
                            team.status,

                          minimumTeamSize:
                            relay.min_team_size,

                          maximumTeamSize:
                            relay.max_team_size,

                          joinedMemberCount:
                            joinedCountByTeamId.get(
                              team.id
                            ) ??
                            0,

                          invitedAt:
                            membership.created_at,
                        },
                      ]
                    }
                  )


                setRelayInvitations(
                  normalizedRelayInvitations
                )


                if (
                  normalizedRelayInvitations.length >
                  0
                ) {
                  safeLogEvent(
                    "profile_relay_invitations_loaded",
                    {
                      invitation_count:
                        normalizedRelayInvitations.length,
                    }
                  )
                }
              }
            }
          }
        }
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


  async function acceptRelayInvitation(
    teamId:
      string
  ) {
    const supabase =
      supabaseBrowser()


    const result =
      await (
        supabase.rpc as any
      )(
        "join_roam_relay_team",
        {
          p_team_id:
            teamId,
        }
      )


    if (
      result.error
    ) {
      const details =
        [
          result.error.message,
          result.error.code
            ? `code=${result.error.code}`
            : null,
          result.error.details
            ? `details=${result.error.details}`
            : null,
        ]
          .filter(Boolean)
          .join(" | ")


      throw new Error(
        `[profile/page] join_roam_relay_team failed: ${details}`
      )
    }


    setRelayInvitations(
      (
        currentInvitations
      ) =>
        currentInvitations.filter(
          (
            invitation
          ) =>
            invitation.teamId !==
            teamId
        )
    )


    safeLogEvent(
      "profile_relay_invitation_accepted",
      {
        team_id:
          teamId,
      }
    )


    return {
      teamId,
    }
  }


  async function declineRelayInvitation(
    teamId:
      string
  ) {
    const supabase =
      supabaseBrowser()


    const result =
      await (
        supabase.rpc as any
      )(
        "decline_roam_relay_team_invitation",
        {
          p_team_id:
            teamId,
        }
      )


    if (
      result.error
    ) {
      const details =
        [
          result.error.message,
          result.error.code
            ? `code=${result.error.code}`
            : null,
          result.error.details
            ? `details=${result.error.details}`
            : null,
        ]
          .filter(Boolean)
          .join(" | ")


      throw new Error(
        `[profile/page] decline_roam_relay_team_invitation failed: ${details}`
      )
    }


    setRelayInvitations(
      (
        currentInvitations
      ) =>
        currentInvitations.filter(
          (
            invitation
          ) =>
            invitation.teamId !==
            teamId
        )
    )


    safeLogEvent(
      "profile_relay_invitation_declined",
      {
        team_id:
          teamId,
      }
    )


    return {
      teamId,
    }
  }


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
          "History",
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
    <div className="min-h-screen w-full overflow-x-clip bg-[#070809] text-white">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute left-[-24%] top-[-12%] h-[28rem] w-[28rem] rounded-full bg-cyan-400/[0.08] blur-[120px] sm:left-[-10%]" />

        <div className="absolute right-[-28%] top-[14%] h-[34rem] w-[34rem] rounded-full bg-indigo-500/[0.09] blur-[140px] sm:right-[-12%]" />

        <div className="absolute bottom-[-22%] left-[22%] h-[30rem] w-[30rem] rounded-full bg-fuchsia-500/[0.04] blur-[140px]" />

        <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-white/[0.025] to-transparent" />
      </div>

      <div className="relative z-10 mx-auto w-full min-w-0 max-w-6xl px-4 pb-24 pt-[calc(4rem+env(safe-area-inset-top)+1.25rem)] sm:px-6 sm:pb-28">
        <ProfileHeader
          username={
            username
          }
        />

        {relayInvitations.length >
        0 ? (
          <div className="mt-5">
            <RelayInvitationsPanel
              invitations={
                relayInvitations
              }
              onAccept={
                acceptRelayInvitation
              }
              onDecline={
                declineRelayInvitation
              }
            />
          </div>
        ) : null}

        <div className="mt-7">
          <ProfileNavigation
            items={
              navigationItems
            }
          />
        </div>

        <div className="mt-10 space-y-20 sm:mt-14 sm:space-y-24">
          <section
            id="passport"
            aria-labelledby="profile-passport-title"
            className="scroll-mt-32"
          >
            <ProfileSectionHeading
              id="profile-passport-title"
              eyebrow="Your city identity"
              title="Your Passport"
              description="A living record of where you go, what you gravitate toward, and the local knowledge you are building over time."
            />

            <div className="mt-7 w-full min-w-0 space-y-6">
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
            className="scroll-mt-32"
          >
            <ProfileSectionHeading
              id="profile-activity-title"
              eyebrow="Where you have been"
              title="Your city history"
              description="Places you discovered, nights you built, and moments worth remembering."
            />

            <div className="mt-7 space-y-5">
              <ProfilePanel
                eyebrow="Visited"
                title="Places you know"
                description="Your verified venue history, built one real-world visit at a time."
              >
                <VisitHistorySection />
              </ProfilePanel>

              <ProfileDisclosure
                eyebrow="Memories"
                title="Flow snapshots"
                description="The routes, places, and moments you decided were worth keeping."
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
                title="Your nights and routes"
                description="Revisit the Flows you created, joined, hosted, or completed."
              >
                <UserCrawls />
              </ProfileDisclosure>
            </div>
          </section>

          <section
            id="saved"
            aria-labelledby="profile-saved-title"
            className="scroll-mt-32"
          >
            <ProfileSectionHeading
              id="profile-saved-title"
              eyebrow="Your city shelf"
              title="Saved for later"
              description="The places, routes, and guides you do not want to lose when the next plan comes together."
            />

            <div className="mt-7 grid min-w-0 gap-5 lg:grid-cols-2 lg:items-start">
              <ProfilePanel
                eyebrow="Guides"
                title="Places worth coming back to"
                description="Neighborhood and destination guides you have kept close."
              >
                <SavedProperties />
              </ProfilePanel>

              <ProfilePanel
                eyebrow="Library"
                title="Your saved picks"
                description="Venues and Flows waiting for the right day, night, or person."
              >
                <SavedLibraryShell />
              </ProfilePanel>
            </div>
          </section>

          <section
            id="creator"
            aria-labelledby="profile-creator-title"
            className="scroll-mt-32"
          >
            <ProfileSectionHeading
              id="profile-creator-title"
              eyebrow="Your point of view"
              title="Curate what you know"
              description="Turn the places and experiences you genuinely understand into a public perspective people can follow."
            />

            <div className="mt-7">
              <ProfilePanel
                eyebrow="Creator"
                title={
                  creatorModeEnabled
                    ? "Your perspective is live"
                    : "Build your public point of view"
                }
                description={
                  creatorModeEnabled
                    ? "Shape the version of your city knowledge that other people discover."
                    : "When you are ready, turn your existing Roam activity into collections, recommendations, and a public creator identity."
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
            className="scroll-mt-32"
          >
            <ProfileSectionHeading
              id="profile-settings-title"
              eyebrow="Your account"
              title="Make Roam yours"
              description="Update the profile, preferences, privacy, and taste signals that shape your experience."
            />

            <div className="mt-7">
              <ProfileDisclosure
                eyebrow="Profile"
                title="Edit your details"
                description="Update your identity, preferences, and the information connected to your Roam account."
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
    <header className="relative min-w-0 overflow-hidden rounded-[2rem] bg-gradient-to-br from-white/[0.075] via-white/[0.035] to-transparent px-5 py-7 shadow-[0_30px_100px_rgba(0,0,0,0.28)] ring-1 ring-white/[0.07] sm:px-8 sm:py-9">
      <div className="pointer-events-none absolute right-[-4rem] top-[-6rem] h-56 w-56 rounded-full bg-cyan-400/[0.09] blur-3xl" />

      <div className="pointer-events-none absolute bottom-[-7rem] left-[28%] h-64 w-64 rounded-full bg-indigo-500/[0.08] blur-3xl" />

      <div className="relative z-10 flex min-w-0 flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.055] px-3 py-1.5 ring-1 ring-white/[0.07]">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.8)]" />

            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200">
              My Roam
            </p>
          </div>

          <h1 className="mt-5 max-w-3xl text-[2.35rem] font-black leading-[0.96] tracking-[-0.045em] text-white sm:text-5xl">
            Your city,
            according to you.
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-[15px] sm:leading-7">
            Every place you save, visit,
            revisit, and recommend builds
            a clearer picture of your taste.
          </p>

          {username ? (
            <p className="mt-5 text-xs font-semibold text-zinc-500">
              @{username}
            </p>
          ) : null}
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
            className="group inline-flex min-h-12 w-full shrink-0 items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-black text-black transition hover:bg-cyan-200 sm:w-auto"
          >
            View public profile

            <span
              aria-hidden="true"
              className="ml-2 transition-transform group-hover:translate-x-0.5"
            >
              ↗
            </span>
          </Link>
        ) : (
          <div className="w-full rounded-2xl bg-amber-400/[0.07] px-4 py-3 text-xs leading-5 text-amber-100/75 ring-1 ring-amber-300/15 sm:max-w-xs">
            Add a username in Settings
            to make your Roam identity
            shareable.
          </div>
        )}
      </div>
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
      className="sticky top-[calc(4rem+env(safe-area-inset-top)+0.5rem)] z-30 -mx-4 bg-[#070809]/90 px-4 py-2.5 backdrop-blur-2xl sm:mx-0 sm:rounded-full sm:bg-black/55 sm:px-2 sm:ring-1 sm:ring-white/[0.07]"
    >
      <div className="flex min-w-0 gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map(
          (
            item
          ) => (
            <a
              key={
                item.id
              }
              href={`#${item.id}`}
              className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full px-4 py-2 text-xs font-bold text-zinc-500 transition hover:bg-white/[0.07] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
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
      <div className="flex items-center gap-2">
        <span className="h-px w-5 bg-cyan-300/70" />

        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
          {eyebrow}
        </p>
      </div>

      <h2
        id={id}
        className="mt-3 max-w-3xl text-2xl font-black tracking-[-0.03em] text-white sm:text-[2rem]"
      >
        {title}
      </h2>

      <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500 sm:text-[15px] sm:leading-7">
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
      className="relative w-full min-w-0 overflow-hidden rounded-[2rem] bg-gradient-to-br from-white/[0.065] via-white/[0.03] to-transparent p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)] ring-1 ring-white/[0.07] sm:p-6"
    >
      <div className="pointer-events-none absolute right-[-5rem] top-[-5rem] h-44 w-44 rounded-full bg-cyan-400/[0.07] blur-3xl" />

      <div className="relative z-10 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
            Your strongest lanes
          </p>

          <h3
            id="category-standing-title"
            className="mt-2 text-xl font-black tracking-tight text-white"
          >
            What your city history
            says you know
          </h3>

          <p className="mt-2 max-w-2xl text-xs leading-5 text-zinc-500 sm:text-sm sm:leading-6">
            Your standing grows from real
            Roam activity, verified places,
            and the categories where your
            experience keeps showing up.
          </p>
        </div>

        {reputation
          ?.highestLevel ? (
          <span className="inline-flex w-fit shrink-0 items-center rounded-full bg-cyan-300 px-3 py-1.5 text-[11px] font-black text-black">
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
          <div className="relative z-10 mt-6 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                    className="min-w-0 rounded-[1.5rem] bg-black/30 p-4 ring-1 ring-white/[0.065]"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-bold text-white">
                          {
                            standing
                              .categoryLabel
                          }
                        </p>

                        <p className="mt-1 text-[11px] text-zinc-600">
                          {buildStandingScopeLabel(
                            standing
                          )}
                        </p>
                      </div>

                      <span className="shrink-0 rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-bold text-zinc-400 ring-1 ring-white/[0.07]">
                        {formatDisplayLabel(
                          standing
                            .reputationLevel
                        )}
                      </span>
                    </div>

                    <div
                      className={[
                        "mt-5 rounded-[1.25rem] px-4 py-4",

                        display.tone ===
                        "active"
                          ? "bg-cyan-300/[0.08] ring-1 ring-cyan-300/15"
                          : "bg-white/[0.025] ring-1 ring-white/[0.055]",
                      ].join(
                        " "
                      )}
                    >
                      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">
                        Your standing
                      </p>

                      <p
                        className={[
                          "mt-1 break-words text-2xl font-black tracking-[-0.035em]",

                          display.tone ===
                          "active"
                            ? "text-cyan-200"
                            : "text-zinc-300",
                        ].join(
                          " "
                        )}
                      >
                        {
                          display.primary
                        }
                      </p>

                      <p className="mt-1.5 text-xs leading-5 text-zinc-500">
                        {
                          display.secondary
                        }
                      </p>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-zinc-600">
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
                          ? "place"
                          : "places"}
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
            <p className="relative z-10 mt-4 text-xs leading-5 text-zinc-600">
              Showing your strongest{" "}
              {visibleStandings.length.toLocaleString(
                "en-US"
              )}{" "}
              category standings.{" "}
              {hiddenStandingCount.toLocaleString(
                "en-US"
              )}{" "}
              more are still taking shape.
            </p>
          ) : null}
        </>
      ) : (
        <div className="relative z-10 mt-6 rounded-[1.5rem] bg-black/30 p-4 ring-1 ring-white/[0.06]">
          <p className="text-sm font-bold text-white">
            Your city identity is still
            taking shape
          </p>

          <p className="mt-1.5 text-xs leading-5 text-zinc-500">
            Keep exploring verified places
            and completing genuine Roam
            activity. Your strongest
            categories will surface as your
            history grows.
          </p>
        </div>
      )}

      {warning ? (
        <p className="relative z-10 mt-4 rounded-xl bg-amber-400/[0.06] px-3 py-2.5 text-xs leading-5 text-amber-100/70 ring-1 ring-amber-300/15">
          {warning}
        </p>
      ) : null}
    </section>
  )
}

function ReputationSkeleton() {
  return (
    <section
      className="w-full min-w-0 rounded-[2rem] bg-white/[0.035] p-5 ring-1 ring-white/[0.07]"
      aria-label="Loading category standings"
    >
      <div className="animate-pulse">
        <div className="h-3 w-32 rounded bg-white/[0.08]" />

        <div className="mt-3 h-6 w-72 max-w-full rounded bg-white/[0.08]" />

        <div className="mt-2 h-4 w-96 max-w-full rounded bg-white/[0.045]" />

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
                className="h-44 rounded-[1.5rem] bg-black/25 ring-1 ring-white/[0.055]"
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
    <section className="w-full min-w-0 rounded-[2rem] bg-red-950/15 p-5 text-white ring-1 ring-red-500/20">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
        Category standing
      </p>

      <h3 className="mt-2 text-xl font-black text-white">
        Reputation unavailable
      </h3>

      <p className="mt-2 break-words text-sm leading-6 text-red-300/80">
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
          "relative w-full min-w-0 overflow-hidden rounded-[1.5rem] p-5 ring-1",

          enabled
            ? "bg-emerald-400/[0.055] ring-emerald-300/15"
            : "bg-black/25 ring-white/[0.06]",
        ].join(
          " "
        )}
      >
        {enabled ? (
          <div className="pointer-events-none absolute right-[-4rem] top-[-5rem] h-40 w-40 rounded-full bg-emerald-400/[0.08] blur-3xl" />
        ) : null}

        <div className="relative z-10 flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <div
              className={[
                "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ring-1",

                enabled
                  ? "bg-emerald-400/10 text-emerald-300 ring-emerald-300/20"
                  : "bg-white/[0.04] text-zinc-500 ring-white/[0.07]",
              ].join(
                " "
              )}
            >
              <span
                aria-hidden="true"
                className={[
                  "h-2 w-2 rounded-full",

                  enabled
                    ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.75)]"
                    : "bg-zinc-700",
                ].join(
                  " "
                )}
              />

              {enabled
                ? "Live"
                : "Not active"}
            </div>

            <p className="mt-4 break-words text-lg font-black tracking-tight text-white">
              {headline ??
                (
                  enabled
                    ? "Your point of view is out in the world"
                    : "Turn your city knowledge into something people can follow"
                )}
            </p>

            <p className="mt-2 text-sm leading-6 text-zinc-500">
              {enabled
                ? "Your public creator profile brings together your city history, collections, recommendations, collaborations, and reputation."
                : "Creator Mode turns what you already know into a polished public perspective. Nothing becomes public until you decide it should."}
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
          className="inline-flex min-h-12 min-w-0 items-center justify-center rounded-full bg-white px-4 py-3 text-center text-sm font-black text-black transition hover:bg-cyan-200"
        >
          {enabled
            ? "Manage creator profile"
            : "Build creator profile"}
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
          className="inline-flex min-h-12 min-w-0 items-center justify-center rounded-full bg-indigo-400/10 px-4 py-3 text-center text-sm font-bold text-indigo-200 ring-1 ring-indigo-300/15 transition hover:bg-indigo-400/15 hover:text-white"
        >
          Your collections
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
          className="group inline-flex min-h-11 w-full min-w-0 items-center justify-center rounded-full bg-white/[0.035] px-4 py-2.5 text-center text-sm font-semibold text-zinc-400 ring-1 ring-white/[0.07] transition hover:bg-white/[0.065] hover:text-white"
        >
          See what people see

          <span
            aria-hidden="true"
            className="ml-2 transition-transform group-hover:translate-x-0.5"
          >
            →
          </span>
        </Link>
      ) : null}

      {!username ? (
        <p className="rounded-xl bg-amber-400/[0.06] px-3 py-2.5 text-xs leading-5 text-amber-100/70 ring-1 ring-amber-300/15">
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
          "relative w-full min-w-0 overflow-hidden rounded-[1.5rem] bg-black/20 ring-1 ring-white/[0.055]",

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

            "[&_h2]:mb-2 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-white",

            "[&_ul]:min-w-0 [&_ul]:gap-3 [&_ul]:space-y-3",

            "[&_li]:!min-w-0 [&_li]:!rounded-[1.25rem] [&_li]:!border-transparent [&_li]:!bg-white/[0.04] [&_li]:!p-3 [&_li]:!shadow-none [&_li]:!ring-1 [&_li]:!ring-white/[0.055]",

            "[&_h3]:!text-sm [&_h3]:!font-bold [&_h3]:!text-white",

            "[&_p]:!text-xs [&_p]:!text-zinc-500",

            "[&_span]:!text-zinc-300",

            "[&_a]:!text-cyan-300 [&_a:hover]:!text-cyan-100",

            "[&_button]:!text-cyan-300 [&_button:hover]:!text-cyan-100",

            "[&_.text-red-600]:!text-red-300",

            "[&_.text-blue-600]:!text-cyan-300",

            "[&_.text-gray-500]:!text-zinc-500",

            "[&_.bg-white]:!bg-white/[0.04]",

            "[&_.border-gray-200]:!border-transparent",
          ].join(
            " "
          )}
        >
          <FavoritesSection />
        </div>

        {!expanded ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#0b0c0e] via-[#0b0c0e]/95 to-transparent" />
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
        className="inline-flex min-h-10 w-full items-center justify-center rounded-full bg-white/[0.04] px-4 py-2 text-sm font-bold text-cyan-300 ring-1 ring-white/[0.07] transition hover:bg-cyan-300/10 hover:text-cyan-100 sm:w-auto"
      >
        {expanded
          ? "Show less"
          : "See everything saved"}
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
      className="w-full min-w-0 rounded-[1.5rem] bg-black/25 p-4 text-white ring-1 ring-white/[0.055] sm:p-5"
      aria-label="Loading snapshot library"
    >
      <div className="min-w-0 animate-pulse">
        <div className="h-3 w-28 max-w-full rounded bg-white/[0.07]" />

        <div className="mt-3 h-6 w-48 max-w-full rounded bg-white/[0.07]" />

        <div className="mt-2 h-4 w-72 max-w-full rounded bg-white/[0.04]" />

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
                className="min-w-0 overflow-hidden rounded-[1.5rem] bg-black/30 ring-1 ring-white/[0.055]"
              >
                <div className="aspect-square bg-white/[0.04]" />

                <div className="space-y-3 p-4">
                  <div className="h-4 w-2/3 rounded bg-white/[0.07]" />

                  <div className="h-3 w-1/2 rounded bg-white/[0.04]" />

                  <div className="h-10 rounded-xl bg-white/[0.04]" />
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
    <section className="w-full min-w-0 rounded-[1.5rem] bg-red-950/15 p-5 text-white ring-1 ring-red-500/20">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
        Flow snapshots
      </p>

      <h3 className="mt-2 text-xl font-black text-white">
        Snapshot library unavailable
      </h3>

      <p className="mt-2 break-words text-sm leading-6 text-red-300/80">
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
    <section className="w-full min-w-0 overflow-hidden rounded-[2rem] bg-gradient-to-b from-white/[0.05] to-white/[0.025] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.2)] ring-1 ring-white/[0.065] sm:p-5">
      <div className="mb-5 min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
          {eyebrow}
        </p>

        <h3 className="mt-1.5 break-words text-lg font-black tracking-tight text-white">
          {title}
        </h3>

        {description ? (
          <p className="mt-1.5 break-words text-xs leading-5 text-zinc-500">
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
      className="group w-full min-w-0 overflow-hidden rounded-[2rem] bg-gradient-to-b from-white/[0.05] to-white/[0.025] shadow-[0_24px_80px_rgba(0,0,0,0.2)] ring-1 ring-white/[0.065]"
    >
      <summary className="flex min-h-[92px] cursor-pointer list-none items-center justify-between gap-4 p-4 outline-none transition hover:bg-white/[0.025] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400 sm:p-5 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
            {eyebrow}
          </p>

          <h3 className="mt-1.5 break-words text-lg font-black tracking-tight text-white">
            {title}
          </h3>

          {description ? (
            <p className="mt-1.5 break-words text-xs leading-5 text-zinc-500">
              {description}
            </p>
          ) : null}
        </div>

        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.04] text-lg font-light text-zinc-500 ring-1 ring-white/[0.07] transition group-open:rotate-45 group-open:bg-cyan-300 group-open:text-black group-open:ring-cyan-300"
        >
          +
        </span>
      </summary>

      <div className="border-t border-white/[0.055] p-3 sm:p-5">
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