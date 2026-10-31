
'use client'

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { createBrowserClient } from '@supabase/ssr'

import type { User } from '@supabase/supabase-js'

import type { Database } from '@/types/supabase'

import LegalPolicyModal from '@/components/auth/LegalPolicyModal'

export type RoamAuthFormMode =
  | 'standalone'
  | 'contextual'

export type RoamAuthFormProps = {
  mode?: RoamAuthFormMode
  title?: string
  description?: string
  submitLabel?: string
  postAuthPath?: string
  passwordResetPath?: string
  onAuthenticated?: (
    user: User
  ) => void | Promise<void>
  onConfirmationRequired?: (
    email: string
  ) => void
  className?: string
}

/* =========================================================
 * Legal initiative
 *
 * Sign In remains available to existing users without
 * requiring a new agreement.
 *
 * Create Account requires an affirmative legal checkbox.
 *
 * Policy documents open in an in-app modal and are
 * retrieved from the same-origin sanitized HTML endpoint.
 *
 * The checkbox does NOT create a Supabase legal
 * acceptance record. That must be handled by the
 * secure legal-acceptance onboarding workflow.
 * ======================================================= */

type AuthIntent =
  | 'sign_in'
  | 'sign_up'

type LegalPolicyKey =
  | 'terms'
  | 'community-guidelines'
  | 'privacy'

type LegalPolicyContent = {
  html: string
  effectiveDate: string | null
}

const LEGAL_POLICY_TITLES: Record<
  LegalPolicyKey,
  string
> = {
  terms: 'Terms of Service',
  'community-guidelines':
    'Community Guidelines',
  privacy: 'Privacy Policy',
}

const LEGAL_POLICY_PATHS: Record<
  LegalPolicyKey,
  string
> = {
  terms: '/terms',
  'community-guidelines':
    '/community-guidelines',
  privacy: '/privacy',
}

export default function RoamAuthForm({
  mode = 'standalone',
  title = 'Enter Roam',
  submitLabel = 'Continue to Roam',
  postAuthPath = '/welcome',
  passwordResetPath = '/auth/update-password',
  onAuthenticated,
  onConfirmationRequired,
  className,
}: RoamAuthFormProps) {
  const [email, setEmail] =
    useState('')
  const [password, setPassword] =
    useState('')
  const [loading, setLoading] =
    useState(false)
  const [
    googleLoading,
    setGoogleLoading,
  ] = useState(false)
  const [
    resetLoading,
    setResetLoading,
  ] = useState(false)
  const [error, setError] =
    useState('')
  const [
    successMessage,
    setSuccessMessage,
  ] = useState('')

  /* =========================================================
   * Registration and legal policy viewer state
   * ======================================================= */

  const [
    authIntent,
    setAuthIntent,
  ] =
    useState<AuthIntent>(
      'sign_in'
    )

  const [
    legalAccepted,
    setLegalAccepted,
  ] =
    useState(false)

  const [
    activePolicy,
    setActivePolicy,
  ] =
    useState<LegalPolicyKey | null>(
      null
    )

  const [
    policyContents,
    setPolicyContents,
  ] =
    useState<
      Partial<
        Record<
          LegalPolicyKey,
          LegalPolicyContent
        >
      >
    >({})

  const [
    policyLoading,
    setPolicyLoading,
  ] =
    useState(false)

  const [
    policyError,
    setPolicyError,
  ] =
    useState<string | null>(
      null
    )

  const legalBaseUrl =
    useMemo(
      () =>
        getPublicLegalBaseUrl(),
      []
    )

  const legalLinksAvailable =
    legalBaseUrl !== null

  const isSignUp =
    authIntent ===
    'sign_up'

  const activePolicyTitle =
    activePolicy
      ? LEGAL_POLICY_TITLES[
          activePolicy
        ]
      : ''

  const activePolicyUrl =
    activePolicy &&
    legalBaseUrl
      ? new URL(
          LEGAL_POLICY_PATHS[
            activePolicy
          ],
          legalBaseUrl
        ).toString()
      : ''

  const activePolicyContent =
    activePolicy
      ? policyContents[
          activePolicy
        ]
      : undefined

  /* =========================================================
   * Load sanitized policy content
   *
   * Expected endpoint:
   *
   * GET /api/legal/policy?policy=terms
   * GET /api/legal/policy?policy=community-guidelines
   * GET /api/legal/policy?policy=privacy
   *
   * Expected JSON:
   * {
   *   html: string,
   *   effectiveDate?: string | null
   * }
   *
   * SECURITY:
   * The endpoint must sanitize the HTML on the server
   * before sending it to this component.
   *
   * This client intentionally does not fetch or inject
   * arbitrary third-party website HTML directly.
   * ======================================================= */

  useEffect(() => {
    if (
      !activePolicy ||
      !legalBaseUrl
    ) {
      return
    }

    const cachedPolicy =
      policyContents[
        activePolicy
      ]

    if (
      cachedPolicy
    ) {
      setPolicyLoading(
        false
      )
      setPolicyError(
        null
      )
      return
    }

    const controller =
      new AbortController()

    const policyKey =
      activePolicy

    async function loadPolicy() {
      setPolicyLoading(
        true
      )

      setPolicyError(
        null
      )

      try {
        const params =
          new URLSearchParams({
            policy:
              policyKey,
          })

        const response =
          await fetch(
            `/api/legal/policy?${params.toString()}`,
            {
              method:
                'GET',
              credentials:
                'same-origin',
              cache:
                'no-store',
              signal:
                controller.signal,
              headers: {
                Accept:
                  'application/json',
              },
            }
          )

        if (
          !response.ok
        ) {
          throw new Error(
            'The policy could not be loaded.'
          )
        }

        const payload:
          unknown =
          await response.json()

        if (
          !isLegalPolicyPayload(
            payload
          )
        ) {
          throw new Error(
            'The policy response was not valid.'
          )
        }

        if (
          controller.signal.aborted
        ) {
          return
        }

        setPolicyContents(
          (
            current
          ) => ({
            ...current,
            [policyKey]: {
              html:
                payload.html,
              effectiveDate:
                payload.effectiveDate ??
                null,
            },
          })
        )
      } catch (
        loadError
      ) {
        if (
          controller.signal.aborted
        ) {
          return
        }

        console.error(
          '[roam auth form] Failed to load legal policy:',
          policyKey,
          loadError
        )

        setPolicyError(
          'We could not display this policy inside Roam. You can still read the complete document on our public website.'
        )
      } finally {
        if (
          !controller.signal.aborted
        ) {
          setPolicyLoading(
            false
          )
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

  function openLegalPolicy(
    policy:
      LegalPolicyKey
  ) {
    if (
      !legalBaseUrl
    ) {
      return
    }

    setPolicyError(
      null
    )

    setActivePolicy(
      policy
    )
  }

  function closeLegalPolicy() {
    setActivePolicy(
      null
    )

    setPolicyError(
      null
    )

    setPolicyLoading(
      false
    )
  }

  function changeAuthIntent(
    nextIntent:
      AuthIntent
  ) {
    if (
      loading ||
      googleLoading ||
      resetLoading
    ) {
      return
    }

    setAuthIntent(
      nextIntent
    )

    setLegalAccepted(
      false
    )

    setError('')
    setSuccessMessage('')
  }

  const supabase =
    useMemo(
      () =>
        createBrowserClient<Database>(
          process.env
            .NEXT_PUBLIC_SUPABASE_URL!,
          process.env
            .NEXT_PUBLIC_SUPABASE_ANON_KEY!
        ),
      []
    )

  const normalizedClassName =
    typeof className === 'string'
      ? className.trim()
      : ''

  const containerClassName = [
    'w-full',
    normalizedClassName,
  ]
    .filter(Boolean)
    .join(' ')

  async function handleGoogleAuth() {
    if (
      loading ||
      googleLoading ||
      resetLoading
    ) {
      return
    }

    setError('')
    setSuccessMessage('')
    setGoogleLoading(true)

    try {
      const origin =
        window.location.origin

      const safePostAuthPath =
        normalizeInternalPath(
          postAuthPath
        ) ?? '/welcome'

      const callbackUrl =
        new URL(
          '/auth/callback',
          origin
        )

      callbackUrl.searchParams.set(
        'next',
        safePostAuthPath
      )

      const {
        error: googleAuthError,
      } =
        await supabase.auth
          .signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo:
                callbackUrl.toString(),
            },
          })

      if (googleAuthError) {
        setError(
          googleAuthError.message
        )
        setGoogleLoading(false)
      }
    } catch (googleAuthError) {
      console.error(
        '[roam auth form] Google authentication failed:',
        googleAuthError
      )

      setError(
        'Something went wrong while connecting to Google. Please try again.'
      )
      setGoogleLoading(false)
    }
  }

  async function handleAuth(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (
      loading ||
      googleLoading ||
      resetLoading
    ) {
      return
    }

    setError('')
    setSuccessMessage('')

    const normalizedEmail =
      email.trim()

    if (
      !normalizedEmail ||
      !password
    ) {
      setError(
        'Please enter both email and password.'
      )
      return
    }

    /* =====================================================
     * New-user signup agreement requirement
     *
     * This only controls registration submission.
     * It does not persist acceptance.
     * =================================================== */

    if (
      isSignUp
    ) {
      if (
        !legalLinksAvailable
      ) {
        setError(
          'Account registration is temporarily unavailable because Roam’s legal policy links are not configured.'
        )
        return
      }

      if (
        !legalAccepted
      ) {
        setError(
          'Please confirm that you are at least 18 and agree to Roam’s Terms of Service and Community Guidelines.'
        )
        return
      }
    }

    setLoading(true)

    try {
      /* =====================================================
       * Existing user sign-in
       * =================================================== */

      if (
        authIntent ===
        'sign_in'
      ) {
        const {
          data: signInData,
          error: signInError,
        } =
          await supabase.auth
            .signInWithPassword({
              email:
                normalizedEmail,
              password,
            })

        if (
          !signInError &&
          signInData.user &&
          signInData.session
        ) {
          await completeAuthentication(
            signInData.user
          )
          return
        }

        if (!signInError) {
          const authenticatedUser =
            await getAuthenticatedUser()

          if (authenticatedUser) {
            await completeAuthentication(
              authenticatedUser
            )
            return
          }

          setError(
            'Roam could not establish your authenticated session. Please try again.'
          )
          return
        }

        setError(
          signInError.message
        )
        return
      }

      /* =====================================================
       * Explicit new-user registration
       * =================================================== */

      const {
        data: signUpData,
        error: signUpError,
      } =
        await supabase.auth.signUp({
          email:
            normalizedEmail,
          password,
        })

      if (signUpError) {
        setError(
          signUpError.message
        )
        return
      }

      if (
        signUpData.user &&
        signUpData.session
      ) {
        await completeAuthentication(
          signUpData.user
        )
        return
      }

      const authenticatedUser =
        await getAuthenticatedUser()

      if (authenticatedUser) {
        await completeAuthentication(
          authenticatedUser
        )
        return
      }

      if (signUpData.user) {
        const confirmationMessage =
          `Check ${normalizedEmail} to confirm your Roam account, then return here to continue.`

        setSuccessMessage(
          confirmationMessage
        )

        onConfirmationRequired?.(
          normalizedEmail
        )

        return
      }

      setError(
        'Roam could not create your account. Please try again.'
      )
    } catch (authError) {
      console.error(
        '[roam auth form] Authentication failed:',
        authError
      )

      setError(
        'Something went wrong while connecting to Roam. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotPassword() {
    if (
      loading ||
      googleLoading ||
      resetLoading
    ) {
      return
    }

    setError('')
    setSuccessMessage('')

    const normalizedEmail =
      email.trim()

    if (!normalizedEmail) {
      setError(
        'Enter your email above first.'
      )
      return
    }

    setResetLoading(true)

    try {
      const origin =
        window.location.origin

      const safePasswordResetPath =
        normalizeInternalPath(
          passwordResetPath
        ) ??
        '/auth/update-password'

      const callbackUrl =
        new URL(
          '/auth/callback',
          origin
        )

      callbackUrl.searchParams.set(
        'next',
        safePasswordResetPath
      )

      const {
        error: resetError,
      } =
        await supabase.auth
          .resetPasswordForEmail(
            normalizedEmail,
            {
              redirectTo:
                callbackUrl.toString(),
            }
          )

      if (resetError) {
        setError(
          resetError.message
        )
        return
      }

      setSuccessMessage(
        'Reset link sent. Check your email to set a password.'
      )
    } catch (resetError) {
      console.error(
        '[roam auth form] Password reset failed:',
        resetError
      )

      setError(
        'Something went wrong while sending the reset link. Please try again.'
      )
    } finally {
      setResetLoading(false)
    }
  }

  async function getAuthenticatedUser(): Promise<User | null> {
    const {
      data: {
        user,
      },
      error:
        getUserError,
    } =
      await supabase.auth.getUser()

    if (getUserError) {
      console.error(
        '[roam auth form] Authenticated-user verification failed:',
        {
          code:
            getUserError.code,
          message:
            getUserError.message,
        }
      )

      return null
    }

    return user
  }

  async function completeAuthentication(
    user: User
  ) {
    if (onAuthenticated) {
      await onAuthenticated(
        user
      )
      return
    }

    const destination =
      normalizeInternalPath(
        postAuthPath
      ) ?? '/welcome'

    window.location.assign(
      destination
    )
  }

  const busy =
    loading ||
    googleLoading ||
    resetLoading

  return (
    <div
      className={
        containerClassName
      }
    >
      <div className="mb-7 space-y-3 text-center sm:mb-8">
        {mode ===
        'standalone' ? (
          <div className="mx-auto mb-4 hidden h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-indigo-500 shadow-lg shadow-cyan-500/20 lg:flex">
            <img
              src="/favicon-new.ico"
              alt="Roam logo"
              className="h-8 w-8 rounded-sm"
            />
          </div>
        ) : null}

        <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
          {title}
        </h2>
      </div>

      {/* ===================================================
          Explicit Sign In / Create Account selection
          ================================================= */}

      <div
        role="group"
        aria-label="Account access"
        className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <button
          type="button"
          onClick={() =>
            changeAuthIntent(
              'sign_in'
            )
          }
          disabled={busy}
          aria-pressed={
            authIntent ===
            'sign_in'
          }
          className={[
            'min-h-11 rounded-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
            authIntent ===
            'sign_in'
              ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-700 dark:text-white'
              : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white',
          ].join(' ')}
        >
          Sign In
        </button>

        <button
          type="button"
          onClick={() =>
            changeAuthIntent(
              'sign_up'
            )
          }
          disabled={busy}
          aria-pressed={
            authIntent ===
            'sign_up'
          }
          className={[
            'min-h-11 rounded-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
            authIntent ===
            'sign_up'
              ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-700 dark:text-white'
              : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white',
          ].join(' ')}
        >
          Create Account
        </button>
      </div>

      <button
        type="button"
        onClick={
          handleGoogleAuth
        }
        disabled={busy}
        className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5 shrink-0"
        >
          <path
            fill="#4285F4"
            d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"
          />
          <path
            fill="#34A853"
            d="M12 22c2.7 0 4.97-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"
          />
          <path
            fill="#FBBC05"
            d="M6.39 13.93A6.02 6.02 0 0 1 6.08 12c0-.67.12-1.32.31-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.55l3.35-2.62Z"
          />
          <path
            fill="#EA4335"
            d="M12 5.94c1.47 0 2.79.51 3.83 1.5l2.87-2.88A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z"
          />
        </svg>

        {googleLoading
          ? 'Connecting to Google...'
          : 'Continue with Google'}
      </button>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />

        <span className="text-xs font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          or
        </span>

        <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
      </div>

      <form
        onSubmit={handleAuth}
        className="space-y-4"
      >
        <div className="space-y-2">
          <label
            htmlFor="roam-auth-email"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Email
          </label>

          <input
            id="roam-auth-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="you@example.com"
            value={email}
            onChange={(
              event
            ) =>
              setEmail(
                event.target.value
              )
            }
            disabled={busy}
            required
            className="min-h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-black placeholder:text-zinc-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-500 sm:text-sm"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="roam-auth-password"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Password
          </label>

          <input
            id="roam-auth-password"
            type="password"
            autoComplete={
              isSignUp
                ? 'new-password'
                : 'current-password'
            }
            placeholder="Password"
            value={
              password
            }
            onChange={(
              event
            ) =>
              setPassword(
                event.target.value
              )
            }
            disabled={busy}
            required
            className="min-h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-black placeholder:text-zinc-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-500 sm:text-sm"
          />
        </div>

        {/* =================================================
            Registration-only legal agreement
            ================================================= */}

        {isSignUp ? (
          <div className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
            {legalLinksAvailable ? (
              <>
                <div className="flex items-start gap-3">
                  <input
                    id="roam-legal-acceptance"
                    type="checkbox"
                    checked={
                      legalAccepted
                    }
                    onChange={(
                      event
                    ) =>
                      setLegalAccepted(
                        event.target.checked
                      )
                    }
                    disabled={busy}
                    required
                    className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-cyan-500"
                  />

                  <div className="min-w-0 space-y-2">
                    <label
                      htmlFor="roam-legal-acceptance"
                      className="block cursor-pointer text-sm leading-6 text-zinc-700 dark:text-zinc-300"
                    >
                      I confirm that I am at least 18 years old and agree to Roam&apos;s Terms of Service and Community Guidelines.
                    </label>

                    <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                      Review the{' '}
                      <button
                        type="button"
                        onClick={() =>
                          openLegalPolicy(
                            'terms'
                          )
                        }
                        className="font-semibold text-cyan-700 underline underline-offset-2 transition hover:text-cyan-600 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 dark:text-cyan-300"
                      >
                        Terms of Service
                      </button>
                      {' '}and{' '}
                      <button
                        type="button"
                        onClick={() =>
                          openLegalPolicy(
                            'community-guidelines'
                          )
                        }
                        className="font-semibold text-cyan-700 underline underline-offset-2 transition hover:text-cyan-600 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 dark:text-cyan-300"
                      >
                        Community Guidelines
                      </button>
                      .
                    </p>
                  </div>
                </div>

                <p className="border-t border-zinc-200 pt-3 text-xs leading-5 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  By creating an account, you acknowledge Roam&apos;s{' '}
                  <button
                    type="button"
                    onClick={() =>
                      openLegalPolicy(
                        'privacy'
                      )
                    }
                    className="font-semibold text-cyan-700 underline underline-offset-2 transition hover:text-cyan-600 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 dark:text-cyan-300"
                  >
                    Privacy Policy
                  </button>
                  .
                </p>
              </>
            ) : (
              <p
                role="alert"
                className="text-xs leading-5 text-amber-700 dark:text-amber-300"
              >
                Account registration is temporarily unavailable because Roam&apos;s public legal policy links are not configured.
              </p>
            )}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={
            busy ||
            (
              isSignUp &&
              (
                !legalAccepted ||
                !legalLinksAvailable
              )
            )
          }
          className={`min-h-12 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all ${
            busy ||
            (
              isSignUp &&
              (
                !legalAccepted ||
                !legalLinksAvailable
              )
            )
              ? 'cursor-not-allowed bg-zinc-400 dark:bg-zinc-600'
              : 'bg-gradient-to-r from-cyan-500 to-indigo-600 shadow-cyan-500/20 hover:-translate-y-0.5 hover:from-cyan-400 hover:to-indigo-500'
          }`}
        >
          {loading
            ? 'Processing...'
            : isSignUp
              ? 'Create Roam Account'
              : submitLabel}
        </button>
      </form>

      {mode ===
      'standalone' ? (
        <div className="mt-5 grid gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-xs leading-5 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-400">
          <p>
            ✓ Save places,
            Flows, and
            collections
          </p>

          <p>
            ✓ Grow your
            Passport and city
            history
          </p>

          <p>
            ✓ Explore normally
            or build as a
            creator
          </p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={
          handleForgotPassword
        }
        disabled={busy}
        className="mt-5 block min-h-11 w-full rounded-xl text-center text-sm font-medium text-zinc-600 underline-offset-4 transition hover:bg-zinc-100 hover:underline disabled:cursor-not-allowed disabled:opacity-60 dark:text-zinc-400 dark:hover:bg-zinc-900"
      >
        {resetLoading
          ? 'Sending reset link...'
          : 'Forgot password?'}
      </button>

      {error ? (
        <div
          role="alert"
          aria-live="polite"
          className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
        >
          <span className="font-medium">
            Something went
            wrong:
          </span>{' '}
          {error}
        </div>
      ) : null}

      {successMessage ? (
        <div
          role="status"
          aria-live="polite"
          className="mt-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm leading-6 text-green-700 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-300"
        >
          {successMessage}
        </div>
      ) : null}

      {mode ===
      'standalone' ? (
        <div className="mt-7 border-t border-zinc-200 pt-5 dark:border-zinc-800 sm:mt-8">
          <p className="text-center text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            Your places,
            Passport,
            collections,
            creator knowledge,
            and city history
            stay connected to
            your Roam account.
          </p>
        </div>
      ) : null}

      {/* =================================================
          In-app legal policy modal

          Renders outside the form so its controls never
          trigger registration submission.

          Reading a policy does not constitute agreement.
          ================================================= */}

      <LegalPolicyModal
        open={
          activePolicy !==
          null
        }
        onClose={
          closeLegalPolicy
        }
        title={
          activePolicyTitle
        }
        html={
          activePolicyContent?.html ??
          null
        }
        externalUrl={
          activePolicyUrl
        }
        effectiveDate={
          activePolicyContent
            ?.effectiveDate ??
          null
        }
        loading={
          policyLoading
        }
        error={
          policyError
        }
      />
    </div>
  )
}

/* =========================================================
 * Public legal website configuration
 * ======================================================= */

function getPublicLegalBaseUrl():
  string | null {
  const configuredWebsite =
    process.env
      .NEXT_PUBLIC_ROAM_LEGAL_BASE_URL
      ?.trim()

  if (
    !configuredWebsite
  ) {
    return null
  }

  try {
    const parsed =
      new URL(
        configuredWebsite
      )

    if (
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      return null
    }

    if (
      parsed.protocol !==
      'https:' &&
      !(
        process.env.NODE_ENV !==
          'production' &&
        parsed.protocol ===
          'http:'
      )
    ) {
      return null
    }

    return parsed.origin
  } catch {
    return null
  }
}

/* =========================================================
 * Legal API response validation
 *
 * This checks the response shape only.
 * HTML sanitization MUST happen server-side.
 * ======================================================= */

function isLegalPolicyPayload(
  value: unknown
): value is {
  html: string
  effectiveDate?: string | null
} {
  if (
    !value ||
    typeof value !==
      'object'
  ) {
    return false
  }

  const payload =
    value as Record<
      string,
      unknown
    >

  if (
    typeof payload.html !==
      'string' ||
    !payload.html.trim()
  ) {
    return false
  }

  return (
    payload.effectiveDate ===
      undefined ||
    payload.effectiveDate ===
      null ||
    typeof payload.effectiveDate ===
      'string'
  )
}

function normalizeInternalPath(
  value: unknown
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const normalized =
    value.trim()

  if (
    !normalized ||
    !normalized.startsWith(
      '/'
    ) ||
    normalized.startsWith(
      '//'
    ) ||
    normalized.includes(
      '\\'
    ) ||
    containsControlCharacters(
      normalized
    )
  ) {
    return null
  }

  try {
    const parsed =
      new URL(
        normalized,
        window.location.origin
      )

    if (
      parsed.origin !==
      window.location.origin
    ) {
      return null
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return null
  }
}

function containsControlCharacters(
  value: string
): boolean {
  for (
    let index = 0;
    index <
    value.length;
    index += 1
  ) {
    const characterCode =
      value.charCodeAt(
        index
      )

    if (
      characterCode <=
        31 ||
      characterCode ===
        127
    ) {
      return true
    }
  }

  return false
}

function getAuthenticationErrorMessage({
  signInMessage,
  signUpMessage,
}: {
  signInMessage: string
  signUpMessage: string
}): string {
  const normalizedSignInMessage =
    signInMessage
      .trim()
      .toLowerCase()

  const normalizedSignUpMessage =
    signUpMessage
      .trim()
      .toLowerCase()

  if (
    normalizedSignInMessage.includes(
      'invalid login credentials'
    ) &&
    (
      normalizedSignUpMessage.includes(
        'already registered'
      ) ||
      normalizedSignUpMessage.includes(
        'already exists'
      ) ||
      normalizedSignUpMessage.includes(
        'user already'
      )
    )
  ) {
    return 'That email is already connected to a Roam account, but the password did not match. Try again or reset your password.'
  }

  return (
    signUpMessage.trim() ||
    signInMessage.trim() ||
    'Roam could not authenticate your account. Please try again.'
  )
}
