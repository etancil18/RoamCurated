import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  isCommunityEventSignal,
} from './presentation'

describe(
  'isCommunityEventSignal',
  () => {
    it(
      'returns true for the exact community_signal discriminator',
      () => {
        expect(
          isCommunityEventSignal({
            source_type:
              'community_signal',
          })
        ).toBe(true)
      }
    )

    it(
      'returns false for an ordinary event source type',
      () => {
        expect(
          isCommunityEventSignal({
            source_type:
              'curated',
          })
        ).toBe(false)
      }
    )

    it(
      'fails closed when source_type is null',
      () => {
        expect(
          isCommunityEventSignal({
            source_type:
              null,
          })
        ).toBe(false)
      }
    )

    it(
      'fails closed when source_type is absent',
      () => {
        expect(
          isCommunityEventSignal({})
        ).toBe(false)
      }
    )

    it(
      'does not infer Community Signal identity from community',
      () => {
        expect(
          isCommunityEventSignal({
            source_type:
              'community',
          })
        ).toBe(false)
      }
    )

    it(
      'does not normalize discriminator casing',
      () => {
        expect(
          isCommunityEventSignal({
            source_type:
              'Community_Signal',
          })
        ).toBe(false)
      }
    )

    it(
      'does not use substring matching',
      () => {
        expect(
          isCommunityEventSignal({
            source_type:
              'trusted_community_signal',
          })
        ).toBe(false)
      }
    )
  }
)