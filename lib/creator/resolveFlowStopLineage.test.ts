
import { describe, expect, it } from 'vitest'

import {
  resolveFlowStopLineage,
  type AttributedFlowStop,
  type FlowContribution,
} from './resolveFlowStopLineage'

const aliceA: FlowContribution = {
  id: 'contribution-a',
  venueId: 'venue-a',
  creatorUserId: 'alice',
  origin: 'collection',
  collectionId: 'alice-collection',
}

const aliceB: FlowContribution = {
  id: 'contribution-b',
  venueId: 'venue-b',
  creatorUserId: 'alice',
  origin: 'collection',
  collectionId: 'alice-collection',
}

const aliceC: FlowContribution = {
  id: 'contribution-c',
  venueId: 'venue-c',
  creatorUserId: 'alice',
  origin: 'collection',
  collectionId: 'alice-collection',
}

const aliceStops: AttributedFlowStop[] = [
  { flowStopId: 'alice-stop-a', venueId: 'venue-a', contribution: aliceA },
  { flowStopId: 'alice-stop-b', venueId: 'venue-b', contribution: aliceB },
  { flowStopId: 'alice-stop-c', venueId: 'venue-c', contribution: aliceC },
]

describe('resolveFlowStopLineage', () => {
  it('preserves Alice attribution when Bob inherits A, B and C', () => {
    const result = resolveFlowStopLineage({
      parentStops: aliceStops,
      nextStops: [
        {
          kind: 'inherited',
          flowStopId: 'bob-stop-a',
          venueId: 'venue-a',
          parentFlowStopId: 'alice-stop-a',
        },
        {
          kind: 'inherited',
          flowStopId: 'bob-stop-b',
          venueId: 'venue-b',
          parentFlowStopId: 'alice-stop-b',
        },
        {
          kind: 'inherited',
          flowStopId: 'bob-stop-c',
          venueId: 'venue-c',
          parentFlowStopId: 'alice-stop-c',
        },
      ],
    })

    expect(result.map((stop) => stop.contribution.id)).toEqual([
      'contribution-a',
      'contribution-b',
      'contribution-c',
    ])

    expect(result.every(
      (stop) => stop.contribution.creatorUserId === 'alice'
    )).toBe(true)
  })

  it('attributes only Bob newly contributed stop D to Bob', () => {
    const result = resolveFlowStopLineage({
      parentStops: aliceStops,
      nextStops: [
        ...aliceStops.map((stop) => ({
          kind: 'inherited' as const,
          flowStopId: `bob-${stop.flowStopId}`,
          venueId: stop.venueId,
          parentFlowStopId: stop.flowStopId,
        })),
        {
          kind: 'new',
          flowStopId: 'bob-stop-d',
          venueId: 'venue-d',
          contribution: {
            id: 'contribution-d',
            venueId: 'venue-d',
            creatorUserId: 'bob',
            origin: 'manual',
            collectionId: null,
          },
        },
      ],
    })

    expect(result.map((stop) => stop.contribution.creatorUserId)).toEqual([
      'alice',
      'alice',
      'alice',
      'bob',
    ])
  })

  it('preserves both Alice and Bob when Carol inherits their stops', () => {
    const bobStops = resolveFlowStopLineage({
      parentStops: aliceStops,
      nextStops: [
        ...aliceStops.map((stop) => ({
          kind: 'inherited' as const,
          flowStopId: `bob-${stop.flowStopId}`,
          venueId: stop.venueId,
          parentFlowStopId: stop.flowStopId,
        })),
        {
          kind: 'new',
          flowStopId: 'bob-stop-d',
          venueId: 'venue-d',
          contribution: {
            id: 'contribution-d',
            venueId: 'venue-d',
            creatorUserId: 'bob',
            origin: 'manual',
            collectionId: null,
          },
        },
      ],
    })

    const carolStops = resolveFlowStopLineage({
      parentStops: bobStops,
      nextStops: [
        ...bobStops.map((stop) => ({
          kind: 'inherited' as const,
          flowStopId: `carol-${stop.flowStopId}`,
          venueId: stop.venueId,
          parentFlowStopId: stop.flowStopId,
        })),
        {
          kind: 'new',
          flowStopId: 'carol-stop-e',
          venueId: 'venue-e',
          contribution: {
            id: 'contribution-e',
            venueId: 'venue-e',
            creatorUserId: 'carol',
            origin: 'manual',
            collectionId: null,
          },
        },
      ],
    })

    expect(
      carolStops.map((stop) => stop.contribution.creatorUserId)
    ).toEqual(['alice', 'alice', 'alice', 'bob', 'carol'])
  })

  it('does not assign platform-generated stops to an explorer', () => {
    const result = resolveFlowStopLineage({
      parentStops: [],
      nextStops: [
        {
          kind: 'new',
          flowStopId: 'platform-stop',
          venueId: 'venue-f',
          contribution: {
            id: 'contribution-f',
            venueId: 'venue-f',
            creatorUserId: null,
            origin: 'platform',
            collectionId: null,
          },
        },
      ],
    })

    expect(result[0].contribution.creatorUserId).toBeNull()
  })

  it('rejects venue substitution under inherited attribution', () => {
    expect(() =>
      resolveFlowStopLineage({
        parentStops: aliceStops,
        nextStops: [
          {
            kind: 'inherited',
            flowStopId: 'bob-substituted-stop',
            venueId: 'venue-d',
            parentFlowStopId: 'alice-stop-a',
          },
        ],
      })
    ).toThrow('Inherited venue differs')
  })

  it('rejects duplicate contribution identities in one Flow version', () => {
    expect(() =>
      resolveFlowStopLineage({
        parentStops: aliceStops,
        nextStops: [
          {
            kind: 'inherited',
            flowStopId: 'copy-one',
            venueId: 'venue-a',
            parentFlowStopId: 'alice-stop-a',
          },
          {
            kind: 'inherited',
            flowStopId: 'copy-two',
            venueId: 'venue-a',
            parentFlowStopId: 'alice-stop-a',
          },
        ],
      })
    ).toThrow('A contribution cannot appear twice')
  })
})
