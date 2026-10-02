import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  projectActiveFlowRuntimeRoute,
  type ActiveFlowRuntimeStopRow,
} from './runtimeRoute'

const sessionId = 'session-1'

function stop(
  overrides: Partial<ActiveFlowRuntimeStopRow> &
    Pick<
      ActiveFlowRuntimeStopRow,
      'id' | 'venue_id' | 'position'
    >
): ActiveFlowRuntimeStopRow {
  return {
    session_id: sessionId,
    status: 'planned',
    origin: 'original',
    original_stop_id: null,
    ...overrides,
  }
}

describe(
  'projectActiveFlowRuntimeRoute',
  () => {
    it(
      'preserves the existing base route when no Detour exists',
      () => {
        const route =
          projectActiveFlowRuntimeRoute({
            sessionId,

            stops: [
              stop({
                id: 'a',
                venue_id: 'venue-a',
                position: 0,
              }),
              stop({
                id: 'b',
                venue_id: 'venue-b',
                position: 1,
              }),
              stop({
                id: 'c',
                venue_id: 'venue-c',
                position: 2,
              }),
            ],

            detours: [],

            progress: [],
          })

        expect(
          route.map((item) => ({
            id: item.id,
            position: item.position,
            executionIndex:
              item.executionIndex,
            kind: item.kind,
          }))
        ).toEqual([
          {
            id: 'a',
            position: 0,
            executionIndex: 0,
            kind: 'base',
          },
          {
            id: 'b',
            position: 1,
            executionIndex: 1,
            kind: 'base',
          },
          {
            id: 'c',
            position: 2,
            executionIndex: 2,
            kind: 'base',
          },
        ])
      }
    )

    it(
      'projects a NULL-position Detour immediately before its anchor without renumbering base positions',
      () => {
        const route =
          projectActiveFlowRuntimeRoute({
            sessionId,

            stops: [
              stop({
                id: 'a',
                venue_id: 'venue-a',
                position: 0,
              }),
              stop({
                id: 'b',
                venue_id: 'venue-b',
                position: 1,
              }),
              stop({
                id: 'x',
                venue_id: 'venue-x',
                position: null,
                origin:
                  'community_signal',
              }),
              stop({
                id: 'c',
                venue_id: 'venue-c',
                position: 2,
              }),
            ],

            detours: [
              {
                id: 'detour-1',
                session_id:
                  sessionId,
                flow_stop_id: 'x',
                before_flow_stop_id:
                  'c',
                status: 'active',
              },
            ],

            progress: [],
          })

        expect(
          route.map((item) => ({
            id: item.id,
            position: item.position,
            executionIndex:
              item.executionIndex,
            kind: item.kind,
          }))
        ).toEqual([
          {
            id: 'a',
            position: 0,
            executionIndex: 0,
            kind: 'base',
          },
          {
            id: 'b',
            position: 1,
            executionIndex: 1,
            kind: 'base',
          },
          {
            id: 'x',
            position: null,
            executionIndex: 2,
            kind: 'detour',
          },
          {
            id: 'c',
            position: 2,
            executionIndex: 3,
            kind: 'base',
          },
        ])
      }
    )

    it(
      'preserves legacy stop_index fallback for base stops',
      () => {
        const route =
          projectActiveFlowRuntimeRoute({
            sessionId,

            stops: [
              stop({
                id: 'a',
                venue_id: 'venue-a',
                position: 0,
              }),
              stop({
                id: 'b',
                venue_id: 'venue-b',
                position: 1,
              }),
            ],

            detours: [],

            progress: [
              {
                stop_index: 0,
                flow_stop_id: null,
              },
            ],
          })

        expect(
          route.find(
            (item) =>
              item.id === 'a'
          )?.completed
        ).toBe(true)
      }
    )

    it(
      'never completes a Detour through legacy stop_index fallback',
      () => {
        const route =
          projectActiveFlowRuntimeRoute({
            sessionId,

            stops: [
              stop({
                id: 'a',
                venue_id: 'venue-a',
                position: 0,
              }),
              stop({
                id: 'x',
                venue_id: 'venue-x',
                position: null,
              }),
              stop({
                id: 'b',
                venue_id: 'venue-b',
                position: 1,
              }),
            ],

            detours: [
              {
                id: 'detour-1',
                session_id:
                  sessionId,
                flow_stop_id: 'x',
                before_flow_stop_id:
                  'b',
                status: 'active',
              },
            ],

            progress: [
              {
                stop_index: 1,
                flow_stop_id: null,
              },
            ],
          })

        expect(
          route.find(
            (item) =>
              item.id === 'x'
          )?.completed
        ).toBe(false)

        expect(
          route.find(
            (item) =>
              item.id === 'b'
          )?.completed
        ).toBe(true)
      }
    )

    it(
      'completes a Detour only through flow_stop_id identity',
      () => {
        const route =
          projectActiveFlowRuntimeRoute({
            sessionId,

            stops: [
              stop({
                id: 'x',
                venue_id: 'venue-x',
                position: null,
              }),
              stop({
                id: 'b',
                venue_id: 'venue-b',
                position: 1,
              }),
            ],

            detours: [
              {
                id: 'detour-1',
                session_id:
                  sessionId,
                flow_stop_id: 'x',
                before_flow_stop_id:
                  'b',
                status: 'active',
              },
            ],

            progress: [
              {
                stop_index: null,
                flow_stop_id: 'x',
              },
            ],
          })

        expect(
          route.find(
            (item) =>
              item.id === 'x'
          )?.completed
        ).toBe(true)
      }
    )

    it(
      'fails closed on an executable NULL-position stop without an active Detour relation',
      () => {
        expect(() =>
          projectActiveFlowRuntimeRoute({
            sessionId,

            stops: [
              stop({
                id: 'x',
                venue_id: 'venue-x',
                position: null,
              }),
            ],

            detours: [],

            progress: [],
          })
        ).toThrow(
          /has no active Detour relation/
        )
      }
    )

    it(
      'fails closed when a Detour anchor is not executable',
      () => {
        expect(() =>
          projectActiveFlowRuntimeRoute({
            sessionId,

            stops: [
              stop({
                id: 'x',
                venue_id: 'venue-x',
                position: null,
              }),
              stop({
                id: 'b',
                venue_id: 'venue-b',
                position: 1,
                status: 'replaced',
              }),
            ],

            detours: [
              {
                id: 'detour-1',
                session_id:
                  sessionId,
                flow_stop_id: 'x',
                before_flow_stop_id:
                  'b',
                status: 'active',
              },
            ],

            progress: [],
          })
        ).toThrow(
          /non-executable anchor/
        )
      }
    )
  }
)