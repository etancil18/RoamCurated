
'use client'

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'

import LegalPolicyModal from '@/components/auth/LegalPolicyModal'

type Props = {
  termsVersion: string
  guidelinesVersion: string
  destination: string
  legalBaseUrl: string | null
}

type PolicyKey =
  | 'terms'
  | 'community-guidelines'
  | 'privacy'

type PolicyContent = {
  html: string
  effectiveDate: string | null
}

const POLICY_DETAILS: Record<
  PolicyKey,
  {
    title: string
    path: string
  }
> = {
  terms: {
    title: 'Terms of Service',
    path: '/terms',
  },
  'community-guidelines': {
    title: 'Community Guidelines',
    path: '/community-guidelines',
  },
  privacy: {
    title: 'Privacy Policy',
    path: '/privacy',
  },
}

export default function LegalAcceptanceForm({
  termsVersion,
  guidelinesVersion,
  destination,
  legalBaseUrl,
}: Props) {
  const [
    agreed,
    setAgreed,
  ] = useState(false)

  const [
    submitting,
    setSubmitting,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState<string | null>(null)

  const [
    activePolicy,
    setActivePolicy,
  ] = useState<PolicyKey | null>(null)

  const [
    policyLoading,
    setPolicyLoading,
  ] = useState(false)

  const [
    policyError,
    setPolicyError,
  ] = useState<string | null>(null)

  const [
    policyContents,
    setPolicyContents,
  ] = useState<
    Partial<Record<PolicyKey, PolicyContent>>
  >({})

  const submittingRef =
    useRef(false)

  const policyContent =
    activePolicy
      ? policyContents[activePolicy]
      : undefined

  const policyTitle =
    activePolicy
      ? POLICY_DETAILS[activePolicy].title
      : ''

  const policyUrl =
    activePolicy && legalBaseUrl
      ? new URL(
          POLICY_DETAILS[activePolicy].path,
          legalBaseUrl
        ).toString()
      : ''

  /* =========================================================
   * Fetch sanitized policy content for the modal.
   *
   * The API, not this client component, must sanitize
   * the published HTML before it reaches React.
   * ======================================================= */

  useEffect(() => {
    if (
      !activePolicy ||
      !legalBaseUrl
    ) {
      return
    }

    const cached =
      policyContents[activePolicy]

    if (cached) {
      setPolicyLoading(false)
      setPolicyError(null)
      return
    }

    const controller =
      new AbortController()

    const policy =
      activePolicy

    async function loadPolicy() {
      setPolicyLoading(true)
      setPolicyError(null)

      try {
        const query =
          new URLSearchParams({
            policy,
          })

        const response =
          await fetch(
            `/api/legal/policy?${query.toString()}`,
            {
              method: 'GET',
              credentials: 'same-origin',
              cache: 'no-store',
              headers: {
                Accept: 'application/json',
              },
              signal: controller.signal,
            }
          )

        if (!response.ok) {
          throw new Error(
            'Unable to load the policy document.'
          )
        }

        const payload: unknown =
          await response.json()

        if (!isPolicyPayload(payload)) {
          throw new Error(
            'The policy response is invalid.'
          )
        }

        if (controller.signal.aborted) {
          return
        }

        setPolicyContents(
          (current) => ({
            ...current,
            [policy]: {
              html: payload.html,
              effectiveDate:
                payload.effectiveDate ?? null,
            },
          })
        )
      } catch (loadError) {
        if (controller.signal.aborted) {
          return
        }

        console.error(
          '[legal acceptance] Policy loading failed:',
          policy,
          loadError
        )

        setPolicyError(
          'This document could not be displayed inside Roam. Please use the website link below to review it.'
        )
      } finally {
        if (!controller.signal.aborted) {
          setPolicyLoading(false)
        }
      }
    }

    void loadPolicy()

    return () => {
      controller.abort()
    }
  }, [
    activePolicy,
    legalBaseUrl,
    policyContents,
  ])

  function openPolicy(policy: PolicyKey) {
    if (!legalBaseUrl) {
      return
    }

    setPolicyError(null)
    setActivePolicy(policy)
  }

  function closePolicy() {
    setActivePolicy(null)
    setPolicyError(null)
    setPolicyLoading(false)
  }

  /* =========================================================
   * Record affirmative acceptance.
   *
   * The server independently verifies the user,
   * policy versions, and rollout cutoff.
   * ======================================================= */

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (
      submittingRef.current ||
      submitting
    ) {
      return
    }

    setError(null)

    if (!legalBaseUrl) {
      setError(
        'Roam’s legal policy links are temporarily unavailable. Please try again later.'
      )
      return
    }

    if (!agreed) {
      setError(
        'Please confirm that you are at least 18 and agree to the Terms of Service and Community Guidelines.'
      )
      return
    }

    submittingRef.current = true
    setSubmitting(true)

    try {
      const response =
        await fetch('/api/legal/accept', {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            accepted: true,
            termsVersion,
            guidelinesVersion,
          }),
        })

      const payload: unknown =
        await response.json().catch(
          () => null
        )

      if (!response.ok) {
        if (response.status === 401) {
          setError(
            'Your session has expired. Please sign in again to complete your agreement.'
          )
          return
        }

        if (response.status === 409) {
          setError(
            'Roam’s legal agreements have been updated. Refresh this page to review the current versions.'
          )
          return
        }

        setError(
          getResponseError(payload) ??
          'We could not save your agreement. Please try again.'
        )
        return
      }

      if (
        !isAcceptanceSuccess(payload)
      ) {
        setError(
          'We could not verify that your agreement was saved. Please try again.'
        )
        return
      }

      window.location.assign(destination)
    } catch (submitError) {
      console.error(
        '[legal acceptance] Submission failed:',
        submitError
      )

      setError(
        'Something went wrong while saving your agreement. Please try again.'
      )
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.065] p-1 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:rounded-[2rem]">
        <div className="rounded-[1.5rem] bg-[#10131a] px-5 py-7 sm:rounded-[1.75rem] sm:px-9 sm:py-9">
          <div className="mb-7 space-y-3 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-indigo-500 shadow-lg shadow-cyan-500/20">
              <img
                src="/favicon-new.ico"
                alt="Roam logo"
                className="h-7 w-7 rounded-sm"
              />
            </div>

            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
              One final step
            </p>

            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              Welcome to Roam
            </h1>

            <p className="mx-auto max-w-md text-sm leading-6 text-zinc-400">
              Before continuing, please review and
              accept Roam&apos;s account agreements.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <input
                  id="roam-onboarding-legal-agreement"
                  type="checkbox"
                  checked={agreed}
                  onChange={(event) =>
                    setAgreed(event.target.checked)
                  }
                  required
                  disabled={submitting || !legalBaseUrl}
                  className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-cyan-400"
                />

                <div className="min-w-0 space-y-3">
                  <label
                    htmlFor="roam-onboarding-legal-agreement"
                    className="block cursor-pointer text-sm leading-6 text-zinc-200"
                  >
                    I confirm that I am at least
                    18 years old and agree to
                    Roam&apos;s Terms of Service
                    and Community Guidelines.
                  </label>

                  <p className="text-xs leading-6 text-zinc-400">
                    Read the{' '}
                    <button
                      type="button"
                      onClick={() => openPolicy('terms')}
                      disabled={!legalBaseUrl}
                      className="font-semibold text-cyan-300 underline underline-offset-2 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Terms of Service
                    </button>
                    {' '}and{' '}
                    <button
                      type="button"
                      onClick={() =>
                        openPolicy('community-guidelines')
                      }
                      disabled={!legalBaseUrl}
                      className="font-semibold text-cyan-300 underline underline-offset-2 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Community Guidelines
                    </button>
                    .
                  </p>
                </div>
              </div>

              <p className="mt-4 border-t border-white/10 pt-4 text-xs leading-6 text-zinc-400">
                By continuing, you acknowledge
                Roam&apos;s{' '}
                <button
                  type="button"
                  onClick={() => openPolicy('privacy')}
                  disabled={!legalBaseUrl}
                  className="font-semibold text-cyan-300 underline underline-offset-2 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Privacy Policy
                </button>
                .
              </p>
            </div>

            {!legalBaseUrl ? (
              <p
                role="alert"
                className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-3 text-xs leading-5 text-amber-200"
              >
                The public legal policy website is not configured.
                Agreement cannot be completed at this time.
              </p>
            ) : null}

            {error ? (
              <div
                role="alert"
                aria-live="polite"
                className="rounded-xl border border-red-400/20 bg-red-400/[0.07] px-4 py-3 text-sm leading-6 text-red-200"
              >
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={
                submitting ||
                !agreed ||
                !legalBaseUrl
              }
              className="flex min-h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-cyan-500/10 transition hover:from-cyan-400 hover:to-indigo-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:bg-none disabled:text-zinc-400 disabled:shadow-none"
            >
              {submitting
                ? 'Saving agreement...'
                : 'Agree & Continue'}
            </button>
          </form>

          <p className="mt-5 text-center text-[11px] leading-5 text-zinc-500">
            Your agreement is securely recorded
            against your Roam account.
          </p>
        </div>
      </div>

      <LegalPolicyModal
        open={activePolicy !== null}
        onClose={closePolicy}
        title={policyTitle}
        html={policyContent?.html ?? null}
        externalUrl={policyUrl}
        effectiveDate={policyContent?.effectiveDate ?? null}
        loading={policyLoading}
        error={policyError}
      />
    </>
  )
}

/* =========================================================
 * Validate the legal policy API response shape.
 *
 * Sanitization must be performed by the API route.
 * ======================================================= */

function isPolicyPayload(
  value: unknown
): value is {
  html: string
  effectiveDate?: string | null
} {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return false
  }

  const payload =
    value as Record<string, unknown>

  return (
    typeof payload.html === 'string' &&
    payload.html.trim().length > 0 &&
    (
      payload.effectiveDate === undefined ||
      payload.effectiveDate === null ||
      typeof payload.effectiveDate === 'string'
    )
  )
}

function isAcceptanceSuccess(
  value: unknown
): value is {
  accepted: true
} {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return false
  }

  return (
    (value as Record<string, unknown>)
      .accepted === true
  )
}

function getResponseError(
  value: unknown
): string | null {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return null
  }

  const error =
    (value as Record<string, unknown>).error

  return typeof error === 'string' &&
    error.trim().length > 0
    ? error
    : null
}
