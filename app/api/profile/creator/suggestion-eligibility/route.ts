
import { NextResponse } from "next/server"

import {
  getCreatorSuggestionEligibility,
} from "@/lib/creator/getCreatorSuggestionEligibility"

import {
  createServerClient,
} from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const headers = {
    "Cache-Control": "private, no-store",
  }

  try {
    const supabase =
      await createServerClient()

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json(
        {
          canSuggestStandalone: false,
        },
        {
          status: 401,
          headers,
        }
      )
    }

    const eligibility =
      await getCreatorSuggestionEligibility()

    if (
      eligibility.userId !== user.id
    ) {
      return NextResponse.json(
        {
          canSuggestStandalone: false,
        },
        {
          status: 403,
          headers,
        }
      )
    }

    return NextResponse.json(
      {
        canSuggestStandalone:
          eligibility.canSuggestStandalone === true,
      },
      {
        headers,
      }
    )
  } catch (error) {
    console.error(
      "[suggestion-eligibility] Eligibility check failed:",
      error
    )

    return NextResponse.json(
      {
        canSuggestStandalone: false,
      },
      {
        status: 500,
        headers,
      }
    )
  }
}
