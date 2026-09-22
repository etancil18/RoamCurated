'use client'

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'

import {
  buildCollectionShareText,
  buildCollectionShareTitle,
  type PublicCollectionShareData,
} from '@/lib/creator/collectionShare'

export type CollectionShareSheetProps = {
  data: PublicCollectionShareData
  collectionUrl: string
  storyImageUrl: string
  open: boolean
  onClose: () => void
}

type ShareStatus =
  | {
      type: 'success'
      message: string
    }
  | {
      type: 'error'
      message: string
    }
  | null

type StoryPreviewStatus =
  | 'loading'
  | 'loaded'
  | 'error'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export default function CollectionShareSheet({
  data,
  collectionUrl,
  storyImageUrl,
  open,
  onClose,
}: CollectionShareSheetProps) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef =
    useRef<HTMLDivElement | null>(
      null
    )
  const closeButtonRef =
    useRef<HTMLButtonElement | null>(
      null
    )
  const previousActiveElementRef =
    useRef<HTMLElement | null>(
      null
    )

  const [
    shareStatus,
    setShareStatus,
  ] = useState<ShareStatus>(null)

  const [
    storyPreviewStatus,
    setStoryPreviewStatus,
  ] = useState<StoryPreviewStatus>(
    'loading'
  )

  const [
    storyPreviewAttempt,
    setStoryPreviewAttempt,
  ] = useState(0)

  const [
    isSharing,
    setIsSharing,
  ] = useState(false)

  const [
    isSaving,
    setIsSaving,
  ] = useState(false)

  const [
    isCopying,
    setIsCopying,
  ] = useState(false)

  const shareTitle =
    buildCollectionShareTitle({
      title: data.title,
      creatorDisplayName:
        data.creator.displayName,
      creatorUsername:
        data.creator.username,
    })

  const shareText =
    buildCollectionShareText({
      title: data.title,
      creatorDisplayName:
        data.creator.displayName,
      creatorUsername:
        data.creator.username,
      city: data.city,
      venueCount:
        data.venueCount,
    })

  const safeCollectionUrl =
    normalizeShareUrl(
      collectionUrl
    )

  const safeStoryImageUrl =
    normalizeShareUrl(
      storyImageUrl
    )

  const storyPreviewUrl =
    safeStoryImageUrl
      ? appendPreviewAttempt(
          safeStoryImageUrl,
          storyPreviewAttempt
        )
      : null

  const clearStatus =
    useCallback(() => {
      setShareStatus(null)
    }, [])

  const handleClose =
    useCallback(() => {
      if (
        isSharing ||
        isSaving ||
        isCopying
      ) {
        return
      }

      clearStatus()
      onClose()
    }, [
      clearStatus,
      isCopying,
      isSaving,
      isSharing,
      onClose,
    ])

  useEffect(() => {
    if (!open) {
      return
    }

    previousActiveElementRef.current =
      document.activeElement instanceof
      HTMLElement
        ? document.activeElement
        : null

    const previousOverflow =
      document.body.style.overflow

    document.body.style.overflow =
      'hidden'

    const focusTimer =
      window.setTimeout(() => {
        closeButtonRef.current?.focus()
      }, 0)

    return () => {
      window.clearTimeout(
        focusTimer
      )

      document.body.style.overflow =
        previousOverflow

      const previousElement =
        previousActiveElementRef.current

      window.setTimeout(() => {
        if (
          previousElement &&
          document.contains(
            previousElement
          )
        ) {
          previousElement.focus()
        }
      }, 0)
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (
        event.key === 'Escape'
      ) {
        event.preventDefault()
        handleClose()
        return
      }

      if (
        event.key !== 'Tab'
      ) {
        return
      }

      const dialog =
        dialogRef.current

      if (!dialog) {
        return
      }

      const focusableElements =
        Array.from(
          dialog.querySelectorAll<HTMLElement>(
            FOCUSABLE_SELECTOR
          )
        ).filter(
          (element) =>
            !element.hasAttribute(
              'disabled'
            ) &&
            element.getAttribute(
              'aria-hidden'
            ) !== 'true'
        )

      if (
        focusableElements.length === 0
      ) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const firstElement =
        focusableElements[0]

      const lastElement =
        focusableElements[
          focusableElements.length - 1
        ]

      const activeElement =
        document.activeElement

      if (
        event.shiftKey &&
        activeElement ===
          firstElement
      ) {
        event.preventDefault()
        lastElement.focus()
        return
      }

      if (
        !event.shiftKey &&
        activeElement ===
          lastElement
      ) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener(
      'keydown',
      handleKeyDown
    )

    return () => {
      document.removeEventListener(
        'keydown',
        handleKeyDown
      )
    }
  }, [
    handleClose,
    open,
  ])

  useEffect(() => {
    if (!open) {
      clearStatus()
      setIsSharing(false)
      setIsSaving(false)
      setIsCopying(false)
    }
  }, [
    clearStatus,
    open,
  ])

  useEffect(() => {
    setStoryPreviewAttempt(0)
    setStoryPreviewStatus(
      safeStoryImageUrl
        ? 'loading'
        : 'error'
    )
  }, [
    open,
    safeStoryImageUrl,
  ])

  const handleShare =
    useCallback(async () => {
      if (
        isSharing ||
        !safeCollectionUrl
      ) {
        return
      }

      clearStatus()
      setIsSharing(true)

      try {
        if (
          typeof navigator.share ===
          'function'
        ) {
          await navigator.share({
            title: shareTitle,
            text: shareText,
            url: safeCollectionUrl,
          })

          setShareStatus({
            type: 'success',
            message:
              'Share options opened.',
          })

          return
        }

        const copied =
          await copyText(
            safeCollectionUrl
          )

        if (!copied) {
          throw new Error(
            'Unable to copy link.'
          )
        }

        setShareStatus({
          type: 'success',
          message:
            'Link copied. Paste it anywhere you want to share the Collection.',
        })
      } catch (error) {
        if (
          isShareAbortError(error)
        ) {
          return
        }

        console.error(
          '[collection share] Share failed:',
          error
        )

        setShareStatus({
          type: 'error',
          message:
            'Could not open sharing. Try copying the link instead.',
        })
      } finally {
        setIsSharing(false)
      }
    }, [
      clearStatus,
      isSharing,
      safeCollectionUrl,
      shareText,
      shareTitle,
    ])

  const handleSaveImage =
    useCallback(async () => {
      if (
        isSaving ||
        !safeStoryImageUrl
      ) {
        return
      }

      clearStatus()
      setIsSaving(true)

      try {
        const response =
          await fetch(
            safeStoryImageUrl,
            {
              credentials:
                'same-origin',
            }
          )

        if (!response.ok) {
          throw new Error(
            `Story image request failed with status ${response.status}.`
          )
        }

        const blob =
          await response.blob()

        if (
          !blob.type.startsWith(
            'image/'
          )
        ) {
          throw new Error(
            'Story endpoint did not return an image.'
          )
        }

        const objectUrl =
          URL.createObjectURL(
            blob
          )

        try {
          const anchor =
            document.createElement(
              'a'
            )

          anchor.href =
            objectUrl

          anchor.download =
            buildStoryFilename(
              data.slug
            )

          anchor.rel =
            'noopener'

          document.body.appendChild(
            anchor
          )

          anchor.click()
          anchor.remove()
        } finally {
          window.setTimeout(
            () => {
              URL.revokeObjectURL(
                objectUrl
              )
            },
            0
          )
        }

        setShareStatus({
          type: 'success',
          message:
            'Story image saved. Add it to Instagram Stories and attach the Collection link.',
        })
      } catch (error) {
        console.error(
          '[collection share] Story image save failed:',
          error
        )

        setShareStatus({
          type: 'error',
          message:
            'Could not save the Story image. Try opening the preview and saving it from your browser.',
        })
      } finally {
        setIsSaving(false)
      }
    }, [
      clearStatus,
      data.slug,
      isSaving,
      safeStoryImageUrl,
    ])

  const handleCopyLink =
    useCallback(async () => {
      if (
        isCopying ||
        !safeCollectionUrl
      ) {
        return
      }

      clearStatus()
      setIsCopying(true)

      try {
        const copied =
          await copyText(
            safeCollectionUrl
          )

        if (!copied) {
          throw new Error(
            'Unable to copy link.'
          )
        }

        setShareStatus({
          type: 'success',
          message:
            'Collection link copied.',
        })
      } catch (error) {
        console.error(
          '[collection share] Copy link failed:',
          error
        )

        setShareStatus({
          type: 'error',
          message:
            'Could not copy the link. Select and copy it manually.',
        })
      } finally {
        setIsCopying(false)
      }
    }, [
      clearStatus,
      isCopying,
      safeCollectionUrl,
    ])

  const handleRetryStoryPreview =
    useCallback(() => {
      if (!safeStoryImageUrl) {
        return
      }

      clearStatus()
      setStoryPreviewStatus(
        'loading'
      )
      setStoryPreviewAttempt(
        (current) =>
          current + 1
      )
    }, [
      clearStatus,
      safeStoryImageUrl,
    ])

  const handleBackdropPointerDown =
    useCallback(
      (
        event:
          React.PointerEvent<HTMLDivElement>
      ) => {
        if (
          event.target !==
          event.currentTarget
        ) {
          return
        }

        handleClose()
      },
      [handleClose]
    )

  if (!open) {
    return null
  }

  const hasCollectionUrl =
    safeCollectionUrl !== null

  const hasStoryImage =
    safeStoryImageUrl !== null

  const storyPreviewAvailable =
    hasStoryImage &&
    storyPreviewStatus !==
      'error'

  const isBusy =
    isSharing ||
    isSaving ||
    isCopying

  return (
    <div
      className="fixed inset-0 z-[6000] flex items-end justify-center bg-black/70 px-0 backdrop-blur-sm sm:items-center sm:px-6 sm:py-8"
      onPointerDown={
        handleBackdropPointerDown
      }
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={
          titleId
        }
        aria-describedby={
          descriptionId
        }
        tabIndex={-1}
        className="relative flex max-h-[calc(100dvh-env(safe-area-inset-top))] w-full min-w-0 flex-col overflow-hidden rounded-t-[2rem] border border-neutral-800 bg-neutral-950 shadow-2xl shadow-black/60 sm:max-h-[min(860px,calc(100dvh-4rem))] sm:max-w-3xl sm:rounded-[2rem]"
      >
        <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-neutral-700 sm:hidden" />

        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-neutral-800 px-5 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-6">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-400">
              Share Collection
            </p>

            <h2
              id={titleId}
              className="mt-1 break-words text-xl font-semibold tracking-tight text-white sm:text-2xl"
            >
              Share the places worth
              knowing
            </h2>

            <p
              id={
                descriptionId
              }
              className="mt-2 max-w-xl text-sm leading-6 text-neutral-400"
            >
              Share the Collection
              directly, or save the
              Story artwork for
              Instagram.
            </p>
          </div>

          <button
            ref={
              closeButtonRef
            }
            type="button"
            onClick={
              handleClose
            }
            disabled={
              isBusy
            }
            aria-label="Close share dialog"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-800 bg-black/30 text-lg text-neutral-400 transition hover:border-neutral-700 hover:bg-neutral-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span aria-hidden="true">
              ×
            </span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="grid min-w-0 gap-6 px-5 py-5 sm:grid-cols-[minmax(0,280px)_minmax(0,1fr)] sm:px-6 sm:py-6">
            <section
              aria-label="Instagram Story preview"
              className="min-w-0"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                    Instagram Story
                  </p>

                  <p className="mt-1 text-xs text-neutral-600">
                    1080 × 1920
                  </p>
                </div>

                <span className="shrink-0 rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-fuchsia-200">
                  Primary
                </span>
              </div>

              <div className="mt-3 overflow-hidden rounded-[1.5rem] border border-neutral-800 bg-black shadow-xl shadow-black/30">
                <div className="relative aspect-[9/16] w-full overflow-hidden bg-neutral-900">
                  {storyPreviewAvailable &&
                  storyPreviewUrl ? (
                    <>
                      {storyPreviewStatus ===
                      'loading' ? (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-950">
                          <span className="h-7 w-7 animate-spin rounded-full border-2 border-neutral-700 border-t-indigo-300" />
                          <span className="sr-only">
                            Loading Story
                            preview
                          </span>
                        </div>
                      ) : null}

                      <img
                        src={
                          storyPreviewUrl
                        }
                        alt={`Instagram Story preview for ${data.title}`}
                        className="absolute inset-0 h-full w-full object-cover"
                        onLoad={() => {
                          setStoryPreviewStatus(
                            'loaded'
                          )
                        }}
                        onError={() => {
                          setStoryPreviewStatus(
                            'error'
                          )
                        }}
                      />
                    </>
                  ) : (
                    <StoryPreviewFallback
                      title={
                        data.title
                      }
                      city={
                        data.city
                      }
                    />
                  )}
                </div>
              </div>

              {hasStoryImage ? (
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <a
                    href={
                      safeStoryImageUrl
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex text-xs font-medium text-neutral-500 transition hover:text-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
                  >
                    Open full-size
                    artwork ↗
                  </a>

                  {storyPreviewStatus ===
                  'error' ? (
                    <button
                      type="button"
                      onClick={
                        handleRetryStoryPreview
                      }
                      className="inline-flex text-xs font-medium text-indigo-300 transition hover:text-indigo-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50"
                    >
                      Retry preview
                    </button>
                  ) : null}
                </div>
              ) : null}

              {storyPreviewStatus ===
                'error' &&
              hasStoryImage ? (
                <p
                  role="status"
                  className="mt-2 text-xs leading-5 text-amber-300"
                >
                  Story artwork could
                  not be generated.
                  Open the full-size
                  artwork to inspect
                  the image endpoint,
                  or retry the
                  preview.
                </p>
              ) : null}
            </section>

            <section className="flex min-w-0 flex-col">
              <div className="rounded-[1.5rem] border border-neutral-800 bg-black/25 p-4 sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                  Ready to share
                </p>

                <h3 className="mt-2 break-words text-lg font-semibold text-white">
                  {data.title}
                </h3>

                <p className="mt-2 text-sm leading-6 text-neutral-400">
                  {shareText}
                </p>

                {hasCollectionUrl ? (
                  <div className="mt-4 rounded-xl border border-neutral-800 bg-black/40 px-3 py-2.5">
                    <p className="truncate text-xs text-neutral-500">
                      {
                        safeCollectionUrl
                      }
                    </p>
                  </div>
                ) : (
                  <p className="mt-4 text-xs leading-5 text-rose-300">
                    The public
                    Collection URL is
                    unavailable.
                  </p>
                )}
              </div>

              <div className="mt-4 space-y-3">
                <button
                  type="button"
                  onClick={
                    handleShare
                  }
                  disabled={
                    isBusy ||
                    !hasCollectionUrl
                  }
                  className="flex w-full items-center justify-between gap-4 rounded-2xl border border-indigo-400/30 bg-indigo-500/15 px-4 py-3.5 text-left transition hover:border-indigo-300/50 hover:bg-indigo-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <ActionIcon>
                      <ShareIcon />
                    </ActionIcon>

                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-white">
                        {isSharing
                          ? 'Opening share…'
                          : 'Share'}
                      </span>

                      <span className="mt-0.5 block text-xs text-neutral-400">
                        Use your
                        device&apos;s
                        share options
                      </span>
                    </span>
                  </span>

                  <span
                    aria-hidden="true"
                    className="shrink-0 text-neutral-500"
                  >
                    →
                  </span>
                </button>

                <button
                  type="button"
                  onClick={
                    handleSaveImage
                  }
                  disabled={
                    isBusy ||
                    !hasStoryImage ||
                    storyPreviewStatus ===
                      'error'
                  }
                  className="flex w-full items-center justify-between gap-4 rounded-2xl border border-neutral-800 bg-neutral-900/70 px-4 py-3.5 text-left transition hover:border-fuchsia-400/30 hover:bg-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <ActionIcon>
                      <DownloadIcon />
                    </ActionIcon>

                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-white">
                        {isSaving
                          ? 'Saving image…'
                          : 'Save Story image'}
                      </span>

                      <span className="mt-0.5 block text-xs text-neutral-400">
                        Add it to
                        Instagram
                        Stories
                      </span>
                    </span>
                  </span>

                  <span
                    aria-hidden="true"
                    className="shrink-0 text-neutral-500"
                  >
                    ↓
                  </span>
                </button>

                <button
                  type="button"
                  onClick={
                    handleCopyLink
                  }
                  disabled={
                    isBusy ||
                    !hasCollectionUrl
                  }
                  className="flex w-full items-center justify-between gap-4 rounded-2xl border border-neutral-800 bg-neutral-900/70 px-4 py-3.5 text-left transition hover:border-cyan-400/30 hover:bg-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <ActionIcon>
                      <LinkIcon />
                    </ActionIcon>

                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-white">
                        {isCopying
                          ? 'Copying…'
                          : 'Copy link'}
                      </span>

                      <span className="mt-0.5 block text-xs text-neutral-400">
                        Share the
                        public
                        Collection URL
                      </span>
                    </span>
                  </span>

                  <span
                    aria-hidden="true"
                    className="shrink-0 text-neutral-500"
                  >
                    ⧉
                  </span>
                </button>
              </div>

              <div className="mt-4 rounded-2xl border border-fuchsia-400/15 bg-gradient-to-br from-fuchsia-500/[0.08] via-purple-500/[0.05] to-orange-400/[0.06] p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-fuchsia-400/20 bg-black/30 text-base">
                    <InstagramIcon />
                  </span>

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">
                      Sharing to
                      Instagram?
                    </p>

                    <p className="mt-1 text-xs leading-5 text-neutral-400">
                      Save the Story
                      image, add it to
                      your Story, then
                      use Instagram&apos;s
                      link sticker for
                      this Collection.
                    </p>
                  </div>
                </div>
              </div>

              <div
                aria-live="polite"
                aria-atomic="true"
                className="mt-4 min-h-6"
              >
                {shareStatus ? (
                  <p
                    className={
                      shareStatus.type ===
                      'success'
                        ? 'text-xs leading-5 text-emerald-300'
                        : 'text-xs leading-5 text-rose-300'
                    }
                  >
                    {
                      shareStatus.message
                    }
                  </p>
                ) : null}
              </div>
            </section>
          </div>
        </div>

        <div className="shrink-0 border-t border-neutral-800 bg-neutral-950/95 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-5 sm:pt-4">
          <p className="text-center text-[11px] leading-5 text-neutral-600">
            Roam creates the
            artwork. Instagram
            publishing still happens
            through Instagram.
          </p>
        </div>
      </div>
    </div>
  )
}

function StoryPreviewFallback({
  title,
  city,
}: {
  title: string
  city: string | null
}) {
  return (
    <div className="absolute inset-0 flex flex-col justify-between bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.35),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(217,70,239,0.18),transparent_38%),linear-gradient(145deg,#18181b,#09090b)] p-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white">
          ROAM
        </p>

        <p className="mt-10 text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-300">
          Collection
        </p>

        <p className="mt-2 break-words text-2xl font-bold leading-tight tracking-tight text-white">
          {title}
        </p>
      </div>

      <div>
        {city ? (
          <p className="text-xs font-medium text-neutral-300">
            {city}
          </p>
        ) : null}

        <p className="mt-1 text-[10px] text-neutral-500">
          Places worth knowing
        </p>
      </div>
    </div>
  )
}

function ActionIcon({
  children,
}: {
  children:
    React.ReactNode
}) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-neutral-200">
      {children}
    </span>
  )
}

function ShareIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
    >
      <path
        d="M12 16V4m0 0L8 8m4-4 4 4M6 12H5a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2h-1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
    >
      <path
        d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
    >
      <path
        d="M10 13a5 5 0 0 0 7.07.07l2-2A5 5 0 0 0 12 4l-1.15 1.15M14 11a5 5 0 0 0-7.07-.07l-2 2A5 5 0 0 0 12 20l1.15-1.15"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
    >
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="5"
        stroke="currentColor"
        strokeWidth="1.8"
      />

      <circle
        cx="12"
        cy="12"
        r="4"
        stroke="currentColor"
        strokeWidth="1.8"
      />

      <circle
        cx="17.4"
        cy="6.6"
        r="1"
        fill="currentColor"
      />
    </svg>
  )
}

async function copyText(
  value: string
): Promise<boolean> {
  if (!value) {
    return false
  }

  if (
    navigator.clipboard &&
    typeof navigator.clipboard
      .writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(
        value
      )

      return true
    } catch {
      // Continue to the legacy fallback.
    }
  }

  const textarea =
    document.createElement(
      'textarea'
    )

  textarea.value = value
  textarea.setAttribute(
    'readonly',
    ''
  )

  textarea.style.position =
    'fixed'
  textarea.style.left =
    '-9999px'
  textarea.style.top = '0'
  textarea.style.opacity = '0'

  document.body.appendChild(
    textarea
  )

  textarea.focus()
  textarea.select()

  let copied = false

  try {
    copied =
      document.execCommand(
        'copy'
      )
  } catch {
    copied = false
  } finally {
    textarea.remove()
  }

  return copied
}

function normalizeShareUrl(
  value: string
): string | null {
  if (
    typeof value !== 'string'
  ) {
    return null
  }

  const normalized =
    value.trim()

  if (!normalized) {
    return null
  }

  try {
    const parsed = new URL(
      normalized,
      window.location.origin
    )

    if (
      parsed.protocol !==
        'https:' &&
      parsed.protocol !==
        'http:'
    ) {
      return null
    }

    if (
      parsed.origin !==
        window.location.origin &&
      !isAbsoluteHttpUrl(
        normalized
      )
    ) {
      return null
    }

    parsed.hash = ''

    return parsed.toString()
  } catch {
    return null
  }
}

function isAbsoluteHttpUrl(
  value: string
): boolean {
  return (
    /^https?:\/\//i.test(
      value
    )
  )
}

function appendPreviewAttempt(
  value: string,
  attempt: number
): string {
  if (attempt <= 0) {
    return value
  }

  try {
    const parsed =
      new URL(value)

    parsed.searchParams.set(
      'previewAttempt',
      String(attempt)
    )

    return parsed.toString()
  } catch {
    return value
  }
}

function buildStoryFilename(
  slug: string
): string {
  const normalized =
    slug
      .trim()
      .toLowerCase()
      .replace(
        /[^a-z0-9-]+/g,
        '-'
      )
      .replace(
        /^-+|-+$/g,
        ''
      )

  return `${
    normalized ||
    'collection'
  }-roam-story.png`
}

function isShareAbortError(
  error: unknown
): boolean {
  return (
    error instanceof DOMException &&
    error.name === 'AbortError'
  )
}