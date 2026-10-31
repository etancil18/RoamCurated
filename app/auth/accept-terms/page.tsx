
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { createServerClient } from '@/lib/supabase/server'
import { getLegalAcceptanceStatus } from '@/lib/legal/getLegalAcceptanceStatus'

import LegalAcceptanceForm from './LegalAcceptanceForm'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Review Roam Agreements | Roam',
  description: 'Review and accept Roam’s account agreements.',
  robots: {
    index: false,
    follow: false,
  },
}

type PageProps = {
  searchParams: Promise<{
    next?: string | string[]
  }>
}

const DEFAULT_DESTINATION = '/welcome'

export default async function AcceptTermsPage({
  searchParams,
}: PageProps) {
  const params = await searchParams

  const requestedNext =
    typeof params.next === 'string'
      ? params.next
      : null

  const destination =
    normalizeDestination(requestedNext) ??
    DEFAULT_DESTINATION

  const supabase =
    await createServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    const loginParams =
      new URLSearchParams({
        next: `/auth/accept-terms?${new URLSearchParams({
          next: destination,
        }).toString()}`,
      })

    redirect(`/login?${loginParams.toString()}`)
  }

  const status =
    await getLegalAcceptanceStatus(user)

  if (!status.required) {
    redirect(destination)
  }

  const legalBaseUrl =
    getPublicLegalBaseUrl()

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-x-hidden bg-[#05060a] px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(5rem+env(safe-area-inset-top))] text-white sm:px-6">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.20),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(34,211,238,0.16),_transparent_36%),linear-gradient(135deg,_#05060a_0%,_#09090f_55%,_#020617_100%)]" />

      <div className="relative z-10 w-full max-w-xl">
        <LegalAcceptanceForm
          termsVersion={status.termsVersion}
          guidelinesVersion={status.guidelinesVersion}
          destination={destination}
          legalBaseUrl={legalBaseUrl}
        />
      </div>
    </main>
  )
}

/* =========================================================
 * Redirect safety
 *
 * Accept only relative, same-origin application paths.
 * Keep the agreement route from redirecting to itself.
 * ======================================================= */

function normalizeDestination(
  value: string | null
): string | null {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return null
  }

  try {
    const parsed =
      new URL(value, 'https://roam.internal')

    if (parsed.origin !== 'https://roam.internal') {
      return null
    }

    if (
      parsed.pathname === '/auth/accept-terms' ||
      parsed.pathname.startsWith('/auth/accept-terms/') ||
      parsed.pathname === '/login' ||
      parsed.pathname.startsWith('/auth/callback')
    ) {
      return null
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return null
  }
}

/* =========================================================
 * Public legal website
 *
 * The signup modal and onboarding page must use the
 * same public website for the official policy documents.
 * ======================================================= */

function getPublicLegalBaseUrl(): string | null {
  const configured =
    process.env.NEXT_PUBLIC_ROAM_LEGAL_BASE_URL?.trim()

  if (!configured) {
    return null
  }

  try {
    const url = new URL(configured)

    const validProtocol =
      url.protocol === 'https:' ||
      (
        process.env.NODE_ENV !== 'production' &&
        url.protocol === 'http:' &&
        (
          url.hostname === 'localhost' ||
          url.hostname === '127.0.0.1'
        )
      )

    if (
      !validProtocol ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return null
    }

    return url.origin
  } catch {
    return null
  }
}
