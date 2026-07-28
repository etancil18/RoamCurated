import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {
  CreatorSettingsLoadError,
  getCreatorSettings,
} from './getCreatorSettings'

import {
  createServerClient,
} from '@/lib/supabase/server'

vi.mock(
  '@/lib/supabase/server',
  () => ({
    createServerClient:
      vi.fn(),
  })
)

const USER_ID =
  '11111111-1111-4111-8111-111111111111'

const CREATOR_PROFILE_ROW = {
  user_id: USER_ID,
  creator_bio: null,
  primary_city: 'Atlanta',
  available_for_travel: false,
  accepting_collaborations: true,
  public_email: null,
  created_at:
    '2026-07-01T00:00:00.000Z',
  updated_at:
    '2026-07-01T00:00:00.000Z',
}

const SOCIAL_LINK_ROW = {
  id:
    '22222222-2222-4222-8222-222222222222',
  user_id: USER_ID,
  platform: 'instagram',
  url:
    'https://www.instagram.com/roamcreator',
  handle: 'roamcreator',
  sort_order: 0,
  is_public: true,
  created_at:
    '2026-07-01T00:00:00.000Z',
  updated_at:
    '2026-07-01T00:00:00.000Z',
}

const COLLABORATION_TAG_ROW = {
  id: 1,
  slug: 'brand-campaigns',
  label: 'Brand Campaigns',
  category: 'campaign',
  active: true,
  sort_order: 0,
  created_at:
    '2026-07-01T00:00:00.000Z',
}

function createQueryBuilder(
  result: {
    data: unknown
    error: unknown
  }
) {
  const builder: Record<
    string,
    unknown
  > = {}

  const chain = () => builder

  builder.select = vi.fn(chain)
  builder.eq = vi.fn(chain)
  builder.order = vi.fn(chain)
  builder.maybeSingle =
    vi.fn(async () => result)

  builder.then = (
    resolve: (
      value: typeof result
    ) => unknown
  ) =>
    Promise.resolve(result).then(
      resolve
    )

  return builder
}

function createSupabaseMock({
  profileValue,
  profileError = null,
  user = {
    id: USER_ID,
  },
}: {
  profileValue: unknown
  profileError?: unknown
  user?: {
    id: string
  } | null
}) {
  const tableResults: Record<
    string,
    {
      data: unknown
      error: unknown
    }
  > = {
    profiles: {
      data: profileValue,
      error: profileError,
    },

    creator_profiles: {
      data:
        CREATOR_PROFILE_ROW,
      error: null,
    },

    creator_social_links: {
      data: [
        SOCIAL_LINK_ROW,
      ],
      error: null,
    },

    creator_collaboration_tags: {
      data: [
        {
          tag_id: 1,
        },
      ],
      error: null,
    },

    collaboration_tags: {
      data: [
        COLLABORATION_TAG_ROW,
      ],
      error: null,
    },
  }

  return {
    auth: {
      getUser: vi.fn(
        async () => ({
          data: {
            user,
          },
          error: null,
        })
      ),
    },

    from: vi.fn(
      (table: string) =>
        createQueryBuilder(
          tableResults[
            table
          ] ?? {
            data: null,
            error: null,
          }
        )
    ),
  }
}

function createProfileRow(
  showPublicExplorationMap:
    unknown
) {
  return {
    id: USER_ID,
    username:
      'roamcreator',
    creator_mode_enabled:
      true,
    creator_headline:
      'Atlanta creator',
    show_public_exploration_map:
      showPublicExplorationMap,
  }
}

describe(
  'getCreatorSettings',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it(
      'loads public exploration map opt-in as true when the database value is true',
      async () => {
        vi.mocked(
          createServerClient
        ).mockResolvedValue(
          createSupabaseMock({
            profileValue:
              createProfileRow(
                true
              ),
          }) as never
        )

        const result =
          await getCreatorSettings()

        expect(result).not.toBeNull()

        expect(
          result?.baseProfile
            .show_public_exploration_map
        ).toBe(true)
      }
    )

    it(
      'loads public exploration map opt-in as false when the database value is false',
      async () => {
        vi.mocked(
          createServerClient
        ).mockResolvedValue(
          createSupabaseMock({
            profileValue:
              createProfileRow(
                false
              ),
          }) as never
        )

        const result =
          await getCreatorSettings()

        expect(
          result?.baseProfile
            .show_public_exploration_map
        ).toBe(false)
      }
    )

    it.each([
      null,
      undefined,
      'true',
      1,
      {},
      [],
    ])(
      'fails closed for malformed public map value %p',
      async (
        malformedValue
      ) => {
        vi.mocked(
          createServerClient
        ).mockResolvedValue(
          createSupabaseMock({
            profileValue:
              createProfileRow(
                malformedValue
              ),
          }) as never
        )

        const result =
          await getCreatorSettings()

        expect(
          result?.baseProfile
            .show_public_exploration_map
        ).toBe(false)
      }
    )

    it(
      'fails closed when the database field is missing',
      async () => {
        const profile = {
          id: USER_ID,
          username:
            'roamcreator',
          creator_mode_enabled:
            true,
          creator_headline:
            'Atlanta creator',
        }

        vi.mocked(
          createServerClient
        ).mockResolvedValue(
          createSupabaseMock({
            profileValue:
              profile,
          }) as never
        )

        const result =
          await getCreatorSettings()

        expect(
          result?.baseProfile
            .show_public_exploration_map
        ).toBe(false)
      }
    )

    it(
      'returns null when there is no authenticated user',
      async () => {
        vi.mocked(
          createServerClient
        ).mockResolvedValue(
          createSupabaseMock({
            profileValue:
              null,
            user: null,
          }) as never
        )

        await expect(
          getCreatorSettings()
        ).resolves.toBeNull()
      }
    )

    it(
      'throws PROFILE_NOT_FOUND when the authenticated user has no profile row',
      async () => {
        vi.mocked(
          createServerClient
        ).mockResolvedValue(
          createSupabaseMock({
            profileValue:
              null,
          }) as never
        )

        await expect(
          getCreatorSettings()
        ).rejects.toMatchObject({
          name:
            'CreatorSettingsLoadError',
          code:
            'PROFILE_NOT_FOUND',
        })
      }
    )

    it(
      'throws PROFILE_QUERY_FAILED when the profile query fails',
      async () => {
        vi.mocked(
          createServerClient
        ).mockResolvedValue(
          createSupabaseMock({
            profileValue:
              null,

            profileError: {
              code:
                'TEST_PROFILE_ERROR',

              message:
                'Profile query failed',
            },
          }) as never
        )

        await expect(
          getCreatorSettings()
        ).rejects.toMatchObject({
          name:
            'CreatorSettingsLoadError',
          code:
            'PROFILE_QUERY_FAILED',
        })
      }
    )

    it(
      'returns the complete settings bundle without changing unrelated fields',
      async () => {
        vi.mocked(
          createServerClient
        ).mockResolvedValue(
          createSupabaseMock({
            profileValue:
              createProfileRow(
                false
              ),
          }) as never
        )

        const result =
          await getCreatorSettings()

        expect(result).toEqual({
          userId: USER_ID,

          baseProfile: {
            id: USER_ID,
            username:
              'roamcreator',
            creator_mode_enabled:
              true,
            creator_headline:
              'Atlanta creator',
            show_public_exploration_map:
              false,
          },

          creatorProfile:
            CREATOR_PROFILE_ROW,

          socialLinks: [
            SOCIAL_LINK_ROW,
          ],

          selectedTagIds: [
            1,
          ],

          availableTags: [
            COLLABORATION_TAG_ROW,
          ],
        })
      }
    )
  }
)