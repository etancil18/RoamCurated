'use client'

import {
  useCallback,
  useEffect,
  useState,
} from 'react'
import {
  useRouter,
} from 'next/navigation'

import RoamAuthSheet from '@/components/auth/RoamAuthSheet'

type CollectionFlowCallToActionProps = {
  collectionId: string
  className?: string
}

type GenerateCollectionFlowResponse = {
  session?: {
    id?: string
  } | null
  activeSession?: {
    id?: string
    title?: string | null
    city?: string | null
    started_at?: string | null
  } | null
  redirectTo?: string | null
  error?: string | null
  code?: string | null
  authRequired?: boolean
}

type RequestState =
  | 'idle'
  | 'generating'

const GENERATE_COLLECTION_FLOW_ENDPOINT =
  '/api/generate-from-collection'

const COLLECTION_FLOW_RESUME_PARAM =
  'roamResumeCollectionFlow'

export default function CollectionFlowCallToAction({
  collectionId,
  className,
}: CollectionFlowCallToActionProps) {
  const router =
    useRouter()

  const [
    requestState,
    setRequestState,
  ] = useState<RequestState>(
    'idle'
  )

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null
  )

  const [
    authSheetOpen,
    setAuthSheetOpen,
  ] = useState(false)

  const isGenerating =
    requestState ===
    'generating'

  const generateCollectionFlow =
    useCallback(async () => {
      setRequestState(
        'generating'
      )
      setErrorMessage(
        null
      )

      try {
        const response =
          await fetch(
            GENERATE_COLLECTION_FLOW_ENDPOINT,
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body: JSON.stringify({
                collectionId,
                travelMode:
                  'walking',
                tightness:
                  'medium',
                maxStops: 5,
              }),
            }
          )

        const result =
          await readGenerateCollectionFlowResponse(
            response
          )

        /*
         * Authentication is intentionally enforced by the
         * trusted server endpoint rather than inferred in the
         * public Collection UI.
         */
        if (
          response.status ===
            401 &&
          result?.authRequired ===
            true &&
          result.code ===
            'AUTH_REQUIRED'
        ) {
          setAuthSheetOpen(
            true
          )

          return
        }

        /*
         * The platform permits only one active Flow per user.
         *
         * If this generation request discovers an existing
         * active Flow, continue into that canonical session
         * rather than leaving the user at a dead end.
         */
        if (
          response.status ===
          409
        ) {
          const redirectTo =
            normalizeInternalRedirect(
              result?.redirectTo
            )

          if (redirectTo) {
            router.push(
              redirectTo
            )

            return
          }
        }

        if (!response.ok) {
          setErrorMessage(
            normalizeErrorMessage(
              result?.error
            ) ??
              'Could not build a Flow from this Collection. Please try again.'
          )

          return
        }

        const redirectTo =
          normalizeInternalRedirect(
            result?.redirectTo
          )

        if (!redirectTo) {
          setErrorMessage(
            'Your Flow was created, but Roam could not open it. Please try again.'
          )

          return
        }

        router.push(
          redirectTo
        )
      } catch (error) {
        console.error(
          '[CollectionFlowCallToAction] Collection Flow generation failed:',
          error
        )

        setErrorMessage(
          'Could not build a Flow from this Collection. Please check your connection and try again.'
        )
      } finally {
        setRequestState(
          'idle'
        )
      }
    }, [
      collectionId,
      router,
    ])

  useEffect(() => {
    const url =
      new URL(
        window.location.href
      )

    const resumeCollectionId =
      url.searchParams.get(
        COLLECTION_FLOW_RESUME_PARAM
      )

    if (
      resumeCollectionId !==
      collectionId
    ) {
      return
    }

    url.searchParams.delete(
      COLLECTION_FLOW_RESUME_PARAM
    )

    window.history.replaceState(
      window.history.state,
      '',
      `${url.pathname}${url.search}${url.hash}`
    )

    void generateCollectionFlow()
  }, [
    collectionId,
    generateCollectionFlow,
  ])

  const handleBuildFlow =
    useCallback(async () => {
      if (isGenerating) {
        return
      }

      await generateCollectionFlow()
    }, [
      generateCollectionFlow,
      isGenerating,
    ])

  const handleAuthenticated =
    useCallback(async () => {
      setAuthSheetOpen(
        false
      )

      await generateCollectionFlow()
    }, [
      generateCollectionFlow,
    ])

  const googlePostAuthPath =
    getCollectionFlowOAuthReturnPath(
      collectionId
    )

  const rootClassName = [
    'mt-6 min-w-0',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <section
        aria-labelledby="collection-flow-cta-title"
        className={
          rootClassName
        }
      >
        <div className="relative min-w-0 overflow-hidden rounded-[1.75rem] border border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.13),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.12),transparent_44%),#09090b] p-5 sm:p-6">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent"
          />

          <div className="relative flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                Make it yours
              </p>

              <h2
                id="collection-flow-cta-title"
                className="mt-2 break-words text-xl font-semibold tracking-tight text-white sm:text-2xl"
              >
                Turn this Collection
                into a Flow
              </h2>

              <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-400">
                Build a personalized
                outing from these
                places. Roam may add
                nearby stops when
                needed to complete the
                Flow.
              </p>
            </div>

            <div className="flex w-full shrink-0 flex-col sm:w-auto sm:items-end">
              <button
                type="button"
                onClick={
                  handleBuildFlow
                }
                disabled={
                  isGenerating
                }
                aria-busy={
                  isGenerating
                }
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-wait disabled:border-neutral-700 disabled:bg-neutral-800 disabled:text-neutral-400 sm:w-auto"
              >
                {isGenerating ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-500 border-t-neutral-200"
                    />

                    Building your
                    Flow…
                  </>
                ) : (
                  <>
                    Build a Flow from
                    these places

                    <span
                      aria-hidden="true"
                    >
                      →
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

          {errorMessage ? (
            <div
              role="alert"
              className="relative mt-4 rounded-2xl border border-red-500/20 bg-red-500/[0.07] px-4 py-3"
            >
              <p className="text-sm leading-6 text-red-200">
                {errorMessage}
              </p>

              <button
                type="button"
                onClick={() =>
                  setErrorMessage(
                    null
                  )
                }
                className="mt-2 text-xs font-semibold text-red-300 transition hover:text-white focus-visible:outline-none focus-visible:underline"
              >
                Dismiss
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <RoamAuthSheet
        open={
          authSheetOpen
        }
        onClose={() =>
          setAuthSheetOpen(
            false
          )
        }
        onAuthenticated={
          handleAuthenticated
        }
        title="Continue with Roam"
        description="Sign in or create your Roam account to build a personalized Flow from this Collection."
        submitLabel="Continue to your Flow"
        postAuthPath={
          googlePostAuthPath
        }
      />
    </>
  )
}

async function readGenerateCollectionFlowResponse(
  response: Response
): Promise<GenerateCollectionFlowResponse | null> {
  const contentType =
    response.headers.get(
      'content-type'
    )

  if (
    !contentType
      ?.toLowerCase()
      .includes(
        'application/json'
      )
  ) {
    return null
  }

  try {
    const value:
      unknown =
      await response.json()

    if (
      !isRecord(
        value
      )
    ) {
      return null
    }

    return {
      session:
        isRecord(
          value.session
        )
          ? {
              id:
                normalizeOptionalText(
                  value.session.id
                ) ??
                undefined,
            }
          : null,

      activeSession:
        isRecord(
          value.activeSession
        )
          ? {
              id:
                normalizeOptionalText(
                  value.activeSession
                    .id
                ) ??
                undefined,

              title:
                normalizeOptionalText(
                  value.activeSession
                    .title
                ),

              city:
                normalizeOptionalText(
                  value.activeSession
                    .city
                ),

              started_at:
                normalizeOptionalText(
                  value.activeSession
                    .started_at
                ),
            }
          : null,

      redirectTo:
        normalizeOptionalText(
          value.redirectTo
        ),

      error:
        normalizeErrorMessage(
          value.error
        ),

      code:
        normalizeOptionalText(
          value.code
        ),

      authRequired:
        value.authRequired ===
        true,
    }
  } catch {
    return null
  }
}

function getCollectionFlowOAuthReturnPath(
  collectionId: string
): string {
  if (
    typeof window ===
    'undefined'
  ) {
    return '/welcome'
  }

  const url =
    new URL(
      window.location.href
    )

  url.searchParams.set(
    COLLECTION_FLOW_RESUME_PARAM,
    collectionId
  )

  return `${url.pathname}${url.search}${url.hash}`
}

function normalizeInternalRedirect(
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
    /[\r\n]/.test(
      normalized
    )
  ) {
    return null
  }

  return normalized
}

function normalizeErrorMessage(
  value: unknown
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const normalized =
    value
      .trim()
      .replace(
        /\s+/g,
        ' '
      )

  if (!normalized) {
    return null
  }

  return normalized.slice(
    0,
    500
  )
}

function normalizeOptionalText(
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

  return normalized
    ? normalized
    : null
}

function isRecord(
  value: unknown
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      'object' &&
    value !== null &&
    !Array.isArray(
      value
    )
  )
}