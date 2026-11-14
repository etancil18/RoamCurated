
import 'server-only'

import { NextResponse } from 'next/server'

import { requireVenueAdmin } from '@/lib/admin/requireVenueAdmin'
import { supabaseAdmin } from '@/lib/supabase/admin'

type Context = {
  params: Promise<{ editionId: string }>
}

type ImportBody = {
  collection_id?: unknown
}

// Standard UUID format: 8-4-4-4-12
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}

export async function POST(
  request: Request,
  context: Context,
) {
  try {
    const auth = await requireVenueAdmin()
    if (!auth.ok) return auth.response

    const { editionId } = await context.params

    if (!UUID_PATTERN.test(editionId)) {
      return json(
        { error: 'Invalid edition ID.' },
        400,
      )
    }

    let body: ImportBody

    try {
      body = (await request.json()) as ImportBody
    } catch {
      return json(
        { error: 'Invalid JSON body.' },
        400,
      )
    }

    const collectionId = body?.collection_id

    if (
      typeof collectionId !== 'string' ||
      !UUID_PATTERN.test(collectionId)
    ) {
      return json(
        { error: 'A valid collection_id is required.' },
        400,
      )
    }

    const { data, error } = await supabaseAdmin.rpc(
      'roam_editorial_import_collection',
      {
        p_edition_id: editionId,
        p_collection_id: collectionId,
        p_actor_id: auth.user.id,
      },
    )

    if (error) {
      console.error(
        '[editorial/creator-collections/import] Failed:',
        error,
      )

      return json(
        {
          error:
            error.message ||
            'Unable to import this creator collection.',
        },
        409,
      )
    }

    return json(data)
  } catch (error) {
    console.error(
      '[editorial/creator-collections/import] Unexpected error:',
      error,
    )

    return json(
      {
        error: 'Unexpected error importing creator collection.',
      },
      500,
    )
  }
}
