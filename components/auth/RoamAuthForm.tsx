'use client'

import {
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { createBrowserClient } from '@supabase/ssr'

import type { User } from '@supabase/supabase-js'

import type { Database } from '@/types/supabase'

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

export default function RoamAuthForm({
  mode = 'standalone',
  title = 'Enter Roam',
  description = 'Sign in to explore your city, continue your Passport, manage your saved places, and build your public point of view.',
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

    setLoading(true)

    try {
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
          getAuthenticationErrorMessage({
            signInMessage:
              signInError.message,
            signUpMessage:
              signUpError.message,
          })
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
        'Roam could not sign you in or create your account. Please try again.'
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

        <p className="mx-auto max-w-sm text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          {description}
        </p>
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
            autoComplete="current-password"
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

        <button
          type="submit"
          disabled={busy}
          className={`min-h-12 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all ${
            busy
              ? 'cursor-not-allowed bg-zinc-400 dark:bg-zinc-600'
              : 'bg-gradient-to-r from-cyan-500 to-indigo-600 shadow-cyan-500/20 hover:-translate-y-0.5 hover:from-cyan-400 hover:to-indigo-500'
          }`}
        >
          {loading
            ? 'Processing...'
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
    </div>
  )
}

function normalizeInternalPath(
  value: unknown
): string | null {
  if (
    typeof value !== 'string'
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