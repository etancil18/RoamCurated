import { NextRequest, NextResponse } from 'next/server';
import { supabaseServerApi } from '@/lib/supabase/server-api';

export async function POST(req: NextRequest) {
  const supabase = await supabaseServerApi();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error('[RSVP] Auth error:', authError);
  }

  if (!user) {
    console.warn('[RSVP] Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { crawl_id } = body;

  if (!crawl_id || typeof crawl_id !== 'string' || !crawl_id.match(/^[0-9a-fA-F-]{36}$/)) {
    console.error('[RSVP] Invalid or missing crawl_id:', crawl_id);
    return NextResponse.json({ error: 'Invalid crawl_id' }, { status: 400 });
  }

  console.log('[RSVP] POST /api/rsvp', {
    user_id: user.id,
    crawl_id,
    timestamp: new Date().toISOString(),
  });

  const { data: existing, error: existingErr } = await supabase
    .from('crawl_rsvps')
    .select('id')
    .eq('crawl_id', crawl_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingErr) {
    console.error('[RSVP] Existing check error:', existingErr);
  }

  if (existing) {
    console.log('[RSVP] User already joined crawl:', crawl_id);
    return NextResponse.json({ message: 'Already joined' }, { status: 200 });
  }

  const rpcPayload = { input_crawl_id: crawl_id };
  console.log('[RSVP] Calling join_crawl RPC with payload:', rpcPayload);

  const { data, error, status } = await supabase.rpc('join_crawl', rpcPayload);

  console.log('[RSVP] RPC join_crawl response:', {
    status,
    data,
    error,
    user_id: user.id,
    crawl_id,
  });

  if (error) {
    console.error('[RSVP] ❌ RPC join_crawl failed:', error);
    return NextResponse.json(
      {
        error: 'Failed to RSVP',
        details: error.message || error,
      },
      { status: 500 }
    );
  }

  console.log('[RSVP] ✅ RSVP successful for crawl:', crawl_id);
  return NextResponse.json({ message: 'RSVP successful' }, { status: 200 });
}

export async function DELETE(req: NextRequest) {
  const supabase = await supabaseServerApi();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error('[RSVP] Auth error:', authError);
  }

  if (!user) {
    console.warn('[RSVP] Unauthorized DELETE request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { crawl_id } = body;

  if (!crawl_id || typeof crawl_id !== 'string' || !crawl_id.match(/^[0-9a-fA-F-]{36}$/)) {
    console.error('[RSVP] Invalid or missing crawl_id in DELETE:', crawl_id);
    return NextResponse.json({ error: 'Invalid crawl_id' }, { status: 400 });
  }

  console.log('[RSVP] DELETE /api/rsvp', {
    user_id: user.id,
    crawl_id,
    timestamp: new Date().toISOString(),
  });

  const { data, error, status } = await supabase.rpc('leave_crawl', { crawl_id });

  console.log('[RSVP] RPC leave_crawl response:', {
    status,
    data,
    error,
    user_id: user.id,
    crawl_id,
  });

  if (error) {
    console.error('[RSVP] ❌ RPC leave_crawl failed:', error);
    return NextResponse.json(
      {
        error: 'Failed to leave crawl',
        details: error.message || error,
      },
      { status: 500 }
    );
  }

  console.log('[RSVP] ✅ Successfully left crawl:', crawl_id);
  return NextResponse.json({ message: 'Left crawl' }, { status: 200 });
}
