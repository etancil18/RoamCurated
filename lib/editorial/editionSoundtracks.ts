
import 'server-only'

export type EditionSoundtrack = {
  title: string
  spotifyPlaylistId: string
}

const EDITION_SOUNDTRACKS: Record<
  string,
  EditionSoundtrack
> = {
  '3ef964ce-1cdc-419a-a7bd-31ec5decdff9': {
    title: 'The Edition Soundtrack',
    spotifyPlaylistId:
      '1D2Sxycb15r2bAhfdPLxiq',
  },
}

export function getEditionSoundtrack(
  editionId: string,
): EditionSoundtrack | null {
  return EDITION_SOUNDTRACKS[editionId] ?? null
}
