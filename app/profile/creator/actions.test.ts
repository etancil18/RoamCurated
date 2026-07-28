import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {
  saveCreatorSettingsAction,
} from './actions'

import {
  createServerClient,
} from '@/lib/supabase/server'

import {
  validateCreatorSocialUrl,
} from '@/lib/creator/validateSocialUrl'

import {
  revalidatePath,
} from 'next/cache'

vi.mock(
  '@/lib/supabase/server',
  () => ({
    createServerClient:
      vi.fn(),
  })
)

vi.mock(
  '@/lib/creator/validateSocialUrl',
  () => ({
    validateCreatorSocialUrl:
      vi.fn(),
  })
)

vi.mock(
  'next/cache',
  () => ({
    revalidatePath:
      vi.fn(),
  })
)

const USER_ID =
  '11111111-1111-4111-8111-111111111111'

const SOCIAL_LINK_ID =
  '22222222-2222-4222-8222-222222222222'

const NOW =
  '2026-07-28T12:00:00.000Z'

type QueryResult = {
  data: unknown
  error: unknown
}

type SupabaseMockOptions = {
  previousCreatorModeEnabled?: boolean
  previousShowPublicExplorationMap?: boolean
  failOperation?: string | null
}

type RecordedMutation = {
  table: string
  operation:
    | 'update'
    | 'upsert'
    | 'insert'
    | 'delete'
  payload?: unknown
}

function createValidInput({
  creatorModeEnabled,
  showPublicExplorationMap,
}: {
  creatorModeEnabled: boolean
  showPublicExplorationMap: boolean
}) {
  return {
    creatorModeEnabled,
    showPublicExplorationMap,

    creatorHeadline:
      creatorModeEnabled
        ? 'Atlanta food creator'
        : null,

    creatorBio:
      'Local food and hospitality creator.',

    primaryCity:
      'Atlanta',

    availableForTravel:
      false,

    acceptingCollaborations:
      true,

    publicEmail:
      'creator@example.com',

    socialLinks:
      creatorModeEnabled
        ? [
            {
              id:
                SOCIAL_LINK_ID,

              platform:
                'instagram' as const,

              url:
                'https://www.instagram.com/roamcreator',

              handle:
                'roamcreator',

              sort_order:
                0,

              is_public:
                true,
            },
          ]
        : [],

    collaborationTagIds:
      creatorModeEnabled
        ? [1]
        : [],
  }
}

function createSupabaseMock({
  previousCreatorModeEnabled = true,
  previousShowPublicExplorationMap = false,
  failOperation = null,
}: SupabaseMockOptions = {}) {
  const mutations:
    RecordedMutation[] = []

  const failedOperations =
    new Set<string>()

  const profileSnapshot = {
    id:
      USER_ID,

    username:
      'roam',

    creator_mode_enabled:
      previousCreatorModeEnabled,

    creator_headline:
      'Existing headline',

    show_public_exploration_map:
      previousShowPublicExplorationMap,
  }

  const creatorProfileSnapshot = {
    user_id:
      USER_ID,

    creator_bio:
      'Existing creator bio',

    primary_city:
      'Atlanta',

    available_for_travel:
      false,

    accepting_collaborations:
      true,

    public_email:
      'creator@example.com',

    created_at:
      '2026-07-01T00:00:00.000Z',

    updated_at:
      '2026-07-01T00:00:00.000Z',
  }

  const socialLinkSnapshot = {
    id:
      SOCIAL_LINK_ID,

    user_id:
      USER_ID,

    platform:
      'instagram',

    url:
      'https://www.instagram.com/roamcreator',

    handle:
      'roamcreator',

    sort_order:
      0,

    is_public:
      true,

    created_at:
      '2026-07-01T00:00:00.000Z',

    updated_at:
      '2026-07-01T00:00:00.000Z',
  }

  function shouldFail(
    operation: string
  ): boolean {
    if (
      failOperation !== operation ||
      failedOperations.has(operation)
    ) {
      return false
    }

    failedOperations.add(operation)

    return true
  }

  function createBuilder({
    table,
    initialResult,
  }: {
    table: string
    initialResult: QueryResult
  }) {
    let result =
      initialResult

    const builder: Record<
      string,
      any
    > = {}

    builder.select =
      vi.fn(
        () =>
          builder
      )

    builder.eq =
      vi.fn(
        () =>
          builder
      )

    builder.in =
      vi.fn(
        () =>
          builder
      )

    builder.order =
      vi.fn(
        () =>
          builder
      )

    builder.maybeSingle =
      vi.fn(
        async () =>
          result
      )

    builder.single =
      vi.fn(
        async () =>
          result
      )

    builder.update =
      vi.fn(
        (
          payload:
            unknown
        ) => {
          mutations.push({
            table,
            operation:
              'update',
            payload,
          })

          result = {
            data:
              null,

            error:
              shouldFail(
                `${table}.update`
              )
                ? {
                    code:
                      'TEST_UPDATE_ERROR',

                    message:
                      `${table} update failed`,
                  }
                : null,
          }

          return builder
        }
      )

    builder.upsert =
      vi.fn(
        (
          payload:
            unknown
        ) => {
          mutations.push({
            table,
            operation:
              'upsert',
            payload,
          })

          result = {
            data:
              null,

            error:
              shouldFail(
                `${table}.upsert`
              )
                ? {
                    code:
                      'TEST_UPSERT_ERROR',

                    message:
                      `${table} upsert failed`,
                  }
                : null,
          }

          return builder
        }
      )

    builder.insert =
      vi.fn(
        (
          payload:
            unknown
        ) => {
          mutations.push({
            table,
            operation:
              'insert',
            payload,
          })

          result = {
            data:
              null,

            error:
              shouldFail(
                `${table}.insert`
              )
                ? {
                    code:
                      'TEST_INSERT_ERROR',

                    message:
                      `${table} insert failed`,
                  }
                : null,
          }

          return builder
        }
      )

    builder.delete =
      vi.fn(
        () => {
          mutations.push({
            table,
            operation:
              'delete',
          })

          result = {
            data:
              null,

            error:
              shouldFail(
                `${table}.delete`
              )
                ? {
                    code:
                      'TEST_DELETE_ERROR',

                    message:
                      `${table} delete failed`,
                  }
                : null,
          }

          return builder
        }
      )

    builder.then =
      (
        resolve:
          (
            value:
              QueryResult
          ) => unknown,
        reject?: (
          reason:
            unknown
        ) => unknown
      ) =>
        Promise.resolve(
          result
        ).then(
          resolve,
          reject
        )

    return builder
  }

  const tableResults:
    Record<
      string,
      QueryResult
    > = {
    profiles: {
      data:
        profileSnapshot,
      error:
        null,
    },

    creator_profiles: {
      data:
        creatorProfileSnapshot,
      error:
        null,
    },

    creator_social_links: {
      data: [
        socialLinkSnapshot,
      ],
      error:
        null,
    },

    creator_collaboration_tags: {
      data: [
        {
          tag_id:
            1,
        },
      ],
      error:
        null,
    },

    collaboration_tags: {
      data: [
        {
          id:
            1,
        },
      ],
      error:
        null,
    },
  }

  const supabase = {
    auth: {
      getUser:
        vi.fn(
          async () => ({
            data: {
              user: {
                id:
                  USER_ID,
              },
            },

            error:
              null,
          })
        ),
    },

    from:
      vi.fn(
        (
          table:
            string
        ) =>
          createBuilder({
            table,

            initialResult:
              tableResults[
                table
              ] ?? {
                data:
                  null,

                error:
                  null,
              },
          })
      ),
  }

  return {
    supabase,
    mutations,
  }
}

function getProfileUpdates(
  mutations:
    RecordedMutation[]
): RecordedMutation[] {
  return mutations.filter(
    (
      mutation
    ) =>
      mutation.table ===
        'profiles' &&
      mutation.operation ===
        'update'
  )
}

describe(
  'saveCreatorSettingsAction',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()

      vi.useFakeTimers()

      vi.setSystemTime(
        new Date(NOW)
      )

      vi.mocked(
        validateCreatorSocialUrl
      ).mockImplementation(
        ({
          value,
        }) => ({
          valid:
            true,

          normalizedUrl:
            value,

          error:
            '',
        }) as never
      )
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it(
      'writes show_public_exploration_map false when disabling Creator Mode',
      async () => {
        const {
          supabase,
          mutations,
        } =
          createSupabaseMock({
            previousCreatorModeEnabled:
              true,

            previousShowPublicExplorationMap:
              true,
          })

        vi.mocked(
          createServerClient
        ).mockResolvedValue(
          supabase as never
        )

        const result =
          await saveCreatorSettingsAction(
            createValidInput({
              creatorModeEnabled:
                false,

              showPublicExplorationMap:
                false,
            })
          )

        expect(
          result.success
        ).toBe(true)

        const profileUpdates =
          getProfileUpdates(
            mutations
          )

        expect(
          profileUpdates
        ).toHaveLength(2)

        expect(
          profileUpdates[0]
            ?.payload
        ).toMatchObject({
          creator_mode_enabled:
            false,

          show_public_exploration_map:
            false,
        })

        expect(
          profileUpdates[1]
            ?.payload
        ).toMatchObject({
          creator_mode_enabled:
            false,

          show_public_exploration_map:
            false,
        })
      }
    )

    it(
      'writes show_public_exploration_map true when Creator Mode and map opt-in are enabled',
      async () => {
        const {
          supabase,
          mutations,
        } =
          createSupabaseMock({
            previousCreatorModeEnabled:
              true,

            previousShowPublicExplorationMap:
              false,
          })

        vi.mocked(
          createServerClient
        ).mockResolvedValue(
          supabase as never
        )

        const result =
          await saveCreatorSettingsAction(
            createValidInput({
              creatorModeEnabled:
                true,

              showPublicExplorationMap:
                true,
            })
          )

        expect(
          result
        ).toMatchObject({
          success:
            true,

          data: {
            creatorModeEnabled:
              true,

            showPublicExplorationMap:
              true,
          },
        })

        const profileUpdates =
          getProfileUpdates(
            mutations
          )

        expect(
          profileUpdates
        ).toHaveLength(1)

        expect(
          profileUpdates[0]
            ?.payload
        ).toMatchObject({
          creator_mode_enabled:
            true,

          show_public_exploration_map:
            true,
        })
      }
    )

    it(
      'writes show_public_exploration_map false when Creator Mode is enabled without map opt-in',
      async () => {
        const {
          supabase,
          mutations,
        } =
          createSupabaseMock({
            previousCreatorModeEnabled:
              true,

            previousShowPublicExplorationMap:
              true,
          })

        vi.mocked(
          createServerClient
        ).mockResolvedValue(
          supabase as never
        )

        const result =
          await saveCreatorSettingsAction(
            createValidInput({
              creatorModeEnabled:
                true,

              showPublicExplorationMap:
                false,
            })
          )

        expect(
          result
        ).toMatchObject({
          success:
            true,

          data: {
            creatorModeEnabled:
              true,

            showPublicExplorationMap:
              false,
          },
        })

        const profileUpdates =
          getProfileUpdates(
            mutations
          )

        expect(
          profileUpdates
        ).toHaveLength(1)

        expect(
          profileUpdates[0]
            ?.payload
        ).toMatchObject({
          creator_mode_enabled:
            true,

          show_public_exploration_map:
            false,
        })
      }
    )

    it(
      'restores the prior public exploration map value during rollback',
      async () => {
        const {
          supabase,
          mutations,
        } =
          createSupabaseMock({
            previousCreatorModeEnabled:
              true,

            previousShowPublicExplorationMap:
              true,

            failOperation:
              'creator_profiles.upsert',
          })

        vi.mocked(
          createServerClient
        ).mockResolvedValue(
          supabase as never
        )

        const result =
          await saveCreatorSettingsAction(
            createValidInput({
              creatorModeEnabled:
                false,

              showPublicExplorationMap:
                false,
            })
          )

        expect(
          result
        ).toMatchObject({
          success:
            false,

          error:
            'Creator Mode could not be saved. Your previous settings were restored.',
        })

        const profileUpdates =
          getProfileUpdates(
            mutations
          )

        expect(
          profileUpdates
        ).toHaveLength(2)

        expect(
          profileUpdates[0]
            ?.payload
        ).toMatchObject({
          creator_mode_enabled:
            false,

          show_public_exploration_map:
            false,
        })

        expect(
          profileUpdates[1]
            ?.payload
        ).toMatchObject({
          creator_mode_enabled:
            true,

          creator_headline:
            'Existing headline',

          show_public_exploration_map:
            true,
        })
      }
    )

    it(
      'fails schema validation when the map is enabled while Creator Mode is disabled',
      async () => {
        const {
          supabase,
          mutations,
        } =
          createSupabaseMock()

        vi.mocked(
          createServerClient
        ).mockResolvedValue(
          supabase as never
        )

        const result =
          await saveCreatorSettingsAction({
            ...createValidInput({
              creatorModeEnabled:
                false,

              showPublicExplorationMap:
                false,
            }),

            showPublicExplorationMap:
              true,
          })

        expect(
          result.success
        ).toBe(false)

        if (
          result.success
        ) {
          throw new Error(
            'Expected schema validation failure.'
          )
        }

        expect(
          result.fieldErrors
            ?.showPublicExplorationMap
        ).toEqual([
          'Enable Creator Mode before publishing your exploration map.',
        ])

        expect(
          mutations
        ).toHaveLength(0)
      }
    )

    it(
      'revalidates creator paths after a successful save',
      async () => {
        const {
          supabase,
        } =
          createSupabaseMock()

        vi.mocked(
          createServerClient
        ).mockResolvedValue(
          supabase as never
        )

        const result =
          await saveCreatorSettingsAction(
            createValidInput({
              creatorModeEnabled:
                true,

              showPublicExplorationMap:
                false,
            })
          )

        expect(
          result.success
        ).toBe(true)

        expect(
          vi.mocked(
            revalidatePath
          )
        ).toHaveBeenCalledWith(
          '/profile'
        )

        expect(
          vi.mocked(
            revalidatePath
          )
        ).toHaveBeenCalledWith(
          '/profile/creator'
        )

        expect(
          vi.mocked(
            revalidatePath
          )
        ).toHaveBeenCalledWith(
          '/profile/creator/collections'
        )

        expect(
          vi.mocked(
            revalidatePath
          )
        ).toHaveBeenCalledWith(
          '/u/roam'
        )
      }
    )
  }
)