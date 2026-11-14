
import 'server-only'

import { NextResponse } from 'next/server'

import { requireVenueAdmin } from '@/lib/admin/requireVenueAdmin'
import { supabaseAdmin } from '@/lib/supabase/admin'

type Context = {
  params: Promise<{ editionId: string }>
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
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

    const body: unknown = await request
      .json()
      .catch(() => null)

    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      !('item_ids' in body) ||
      !Array.isArray(body.item_ids) ||
      !body.item_ids.every(
        (id) =>
          typeof id === 'string' &&
          UUID_PATTERN.test(id),
      )
    ) {
      return json(
        { error: 'A valid item_ids array is required.' },
        400,
      )
    }

    const itemIds = body.item_ids as string[]

    if (new Set(itemIds).size !== itemIds.length) {
      return json(
        { error: 'Duplicate item IDs are not allowed.' },
        400,
      )
    }

    const { error } = await supabaseAdmin.rpc(
      'roam_editorial_reorder_items',
      {
        p_edition_id: editionId,
        p_item_ids: itemIds,
      },
    )

    if (error) {
      console.error(
        '[editorial/items/reorder] Reorder rejected:',
        error,
      )

      return json(
        {
          error:
            'Could not reorder items. Refresh the edition and retry.',
        },
        409,
      )
    }

    return json({ success: true })
  } catch (error) {
    console.error(
      '[editorial/items/reorder] Unexpected error:',
      error,
    )

    return json(
      { error: 'Unexpected error reordering items.' },
      500,
    )
  }
}
