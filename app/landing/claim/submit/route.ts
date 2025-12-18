import { supabaseServerApi } from '@/lib/supabase/server-api';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { venue_name, email, instagram_handle, event_submission } = await req.json();

    // ✅ Validate input
    if (
      !venue_name ||
      typeof venue_name !== 'string' ||
      !email ||
      typeof email !== 'string' ||
      !instagram_handle ||
      typeof instagram_handle !== 'string' ||
      !['Connect IG', 'Form', 'Manual'].includes(event_submission)
    ) {
      return NextResponse.json(
        { message: 'Invalid input' },
        { status: 400 }
      );
    }

    const supabase = await supabaseServerApi();

    // 🔒 Optional: Prevent duplicate claims (same email)
    const { data: existing, error: existingError } = await supabase
      .from('venue_claim_requests')
      .select('id')
      .eq('email', email)
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error('DB check error:', existingError.message);
      return NextResponse.json(
        { message: 'Server error during email check' },
        { status: 500 }
      );
    }

    if (existing) {
      return NextResponse.json(
        { message: 'You’ve already submitted a claim. We’ll be in touch!' },
        { status: 200 }
      );
    }

    // 🚀 Insert the new request
    const { error: insertError } = await supabase
      .from('venue_claim_requests')
      .insert({
        venue_name,
        email,
        instagram_handle,
        event_submission,
        status: 'pending',
      });

    if (insertError) {
      console.error('Insert error:', insertError.message);
      return NextResponse.json(
        { message: 'Something went wrong. Please try again later.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
