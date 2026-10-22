
export type ContributionOrigin =
  | 'collection'
  | 'manual'
  | 'platform'

export type FlowContribution = {
  id: string
  venueId: string
  creatorUserId: string | null
  origin: ContributionOrigin
  collectionId: string | null
}

export type AttributedFlowStop = {
  flowStopId: string
  venueId: string
  contribution: FlowContribution
}

export type TrustedStopInput =
  | {
      kind: 'inherited'
      flowStopId: string
      venueId: string
      parentFlowStopId: string
    }
  | {
      kind: 'new'
      flowStopId: string
      venueId: string
      contribution: FlowContribution
    }

function requiredId(value: string, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing ${field}`)
  }

  return value.trim()
}

/**
 * Pure lineage resolver.
 *
 * IMPORTANT:
 * This function does not authenticate users or certify
 * new contributions. Its inputs must be established by
 * trusted server-side validation before invocation.
 *
 * Inherited contributions retain their original identity.
 * New contributions must arrive with independently
 * verified, server-issued contribution records.
 */
export function resolveFlowStopLineage({
  parentStops,
  nextStops,
}: {
  parentStops: AttributedFlowStop[]
  nextStops: TrustedStopInput[]
}): AttributedFlowStop[] {
  const parentByStopId = new Map<string, AttributedFlowStop>()

  for (const stop of parentStops) {
    const id = requiredId(stop.flowStopId, 'parent flowStopId')

    if (parentByStopId.has(id)) {
      throw new Error('Duplicate parent stop identity')
    }

    parentByStopId.set(id, stop)
  }

  const seenNextStopIds = new Set<string>()
  const seenContributionIds = new Set<string>()

  return nextStops.map((input) => {
    const flowStopId = requiredId(
      input.flowStopId,
      'flowStopId'
    )

    const venueId = requiredId(input.venueId, 'venueId')

    if (seenNextStopIds.has(flowStopId)) {
      throw new Error('Duplicate next-version stop identity')
    }

    seenNextStopIds.add(flowStopId)

    let contribution: FlowContribution

    if (input.kind === 'inherited') {
      const parent = parentByStopId.get(
        requiredId(input.parentFlowStopId, 'parentFlowStopId')
      )

      if (!parent) {
        throw new Error('Inherited stop does not exist in parent')
      }

      if (parent.venueId !== venueId) {
        throw new Error(
          'Inherited venue differs from its parent contribution'
        )
      }

      contribution = { ...parent.contribution }
    } else {
      contribution = { ...input.contribution }

      if (contribution.venueId !== venueId) {
        throw new Error('New contribution venue mismatch')
      }

      requiredId(contribution.id, 'contribution.id')

      if (contribution.origin === 'platform') {
        if (
          contribution.creatorUserId !== null ||
          contribution.collectionId !== null
        ) {
          throw new Error(
            'Platform contribution cannot claim creator ownership'
          )
        }
      } else {
        requiredId(
          contribution.creatorUserId ?? '',
          'contribution.creatorUserId'
        )

        if (contribution.origin === 'collection') {
          requiredId(
            contribution.collectionId ?? '',
            'contribution.collectionId'
          )
        } else if (contribution.collectionId !== null) {
          throw new Error(
            'Manual contribution cannot claim a collection source'
          )
        }
      }
    }

    if (seenContributionIds.has(contribution.id)) {
      throw new Error(
        'A contribution cannot appear twice in one Flow version'
      )
    }

    seenContributionIds.add(contribution.id)

    return {
      flowStopId,
      venueId,
      contribution,
    }
  })
}
