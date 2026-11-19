
import 'server-only'

import {
  supabaseAdmin,
} from '@/lib/supabase/admin'

// ============================================================
// ROAM EDITIONS — PUBLIC SOUNDTRACK LOADER
//
// Soundtrack records are queried server-side only.
// Call this only after getPublicEdition() has confirmed
// that the Edition is approved and publicly accessible.
// ============================================================

export type PublicEditionSoundtrack = {
  title: string
  description: string | null
  spotifyPlaylistId: string
}

type SoundtrackRow = {
  title: string
  description: string | null
  spotify_playlist_id: string
}

const SPOTIFY_PLAYLIST_ID_PATTERN =
  /^[A-Za-z0-9]{22}$/

export async function getPublicEditionSoundtrack(
  editionId: string,
): Promise<PublicEditionSoundtrack | null> {
  const { data, error } = await supabaseAdmin
    .from('roam_editorial_edition_soundtracks')
    .select(
      'title, description, spotify_playlist_id',
    )
    .eq('edition_id', editionId)
    .eq('is_enabled', true)
    .maybeSingle()

  if (error) {
    // A soundtrack failure should never make the
    // published editorial experience unavailable.
    console.error(
      '[Roam Editions] Failed to load soundtrack:',
      error,
    )

    return null
  }

  if (!data) {
    return null
  }

  const row = data as SoundtrackRow

  if (
    !SPOTIFY_PLAYLIST_ID_PATTERN.test(
      row.spotify_playlist_id,
    )
  ) {
    return null
  }

  return {
    title: row.title,
    description: row.description,
    spotifyPlaylistId: row.spotify_playlist_id,
  }
}
