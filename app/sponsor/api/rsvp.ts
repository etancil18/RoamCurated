import { NextRequest, NextResponse } from 'next/server';
import { supabaseServerApi } from '@/lib/supabase/server-api';
import { rebuildPublicPassportStats } from '@/lib/passport/rebuildPublicPassportStats';

function isValidUUID(value: string) {
  return /^[0-9a-fA-F-]{36}$/.test(value);
}

async function refreshPublicPassportStats(
  userId: string,
  mutation: 'JOIN_CRAWL' | 'LEAVE_CRAWL'
) {
  try {
    await rebuildPublicPassportStats(userId);
  } catch (error) {
    console.error(
      `[RSVP][${mutation}] Failed to rebuild public Passport stats:`,
      error
    );
  }
}

/**
 * JOIN CRAWL
 */
export async function POST(req: NextRequest) {
  const supabase = await supabaseServerApi();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error('[RSVP][POST] Auth error:', authError);
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { crawl_id } = body;

  if (!crawl_id || typeof crawl_id !== 'string' || !isValidUUID(crawl_id)) {
    return NextResponse.json({ error: 'Invalid crawl_id' }, { status: 400 });
  }

  console.log('[RSVP][POST]', {
    user_id: user.id,
    crawl_id,
  });

  // Check if already RSVP'd
  const { data: existing, error: existingErr } = await supabase
    .from('crawl_rsvps')
    .select('id, status')
    .eq('crawl_id', crawl_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingErr) {
    console.error('[RSVP][POST] Existing check error:', existingErr);
    return NextResponse.json({ error: 'RSVP check failed' }, { status: 500 });
  }

  if (existing) {
    return NextResponse.json(
      {
        message: 'Already joined',
        rsvpStatus: existing.status ?? 'going',
      },
      { status: 200 }
    );
  }

  // Use RPC to join
  const { error } = await supabase.rpc('join_crawl', {
    input_crawl_id: crawl_id,
  });

  if (error) {
    console.error('[RSVP][POST] join_crawl failed:', error);
    return NextResponse.json(
      { error: 'Failed to RSVP', details: error.message },
      { status: 500 }
    );
  }

  await refreshPublicPassportStats(user.id, 'JOIN_CRAWL');

  return NextResponse.json(
    {
      message: 'RSVP successful',
      rsvpStatus: 'going',
    },
    { status: 200 }
  );
}

/**
 * LEAVE CRAWL
 */
export async function DELETE(req: NextRequest) {
  const supabase = await supabaseServerApi();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error('[RSVP][DELETE] Auth error:', authError);
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { crawl_id } = body;

  if (!crawl_id || typeof crawl_id !== 'string' || !isValidUUID(crawl_id)) {
    return NextResponse.json({ error: 'Invalid crawl_id' }, { status: 400 });
  }

  console.log('[RSVP][DELETE]', {
    user_id: user.id,
    crawl_id,
  });

  /**
   * 🚨 IMPORTANT:
   * Do NOT rely solely on RPC for delete.
   * Delete explicitly scoped to user_id.
   * This prevents RLS ambiguity.
   */
  const { error } = await supabase
    .from('crawl_rsvps')
    .delete()
    .eq('crawl_id', crawl_id)
    .eq('user_id', user.id);

  if (error) {
    console.error('[RSVP][DELETE] Failed to leave crawl:', error);
    return NextResponse.json(
      { error: 'Failed to leave crawl', details: error.message },
      { status: 500 }
    );
  }

  await refreshPublicPassportStats(user.id, 'LEAVE_CRAWL');

  return NextResponse.json(
    {
      message: 'Left crawl',
      rsvpStatus: null,
    },
    { status: 200 }
  );
}