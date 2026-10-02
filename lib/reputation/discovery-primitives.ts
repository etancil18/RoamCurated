import {
  type ReputationLevel,
} from '@/lib/reputation/types'

export const REPUTATION_LEVEL_RANK = {
  unranked: 0,
  emerging: 1,
  established: 2,
  expert: 3,
  elite: 4,
} as const satisfies Record<
  ReputationLevel,
  number
>