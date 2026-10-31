
'use client'

import {
  useEffect,
  useId,
  useRef,
  type MouseEvent,
} from 'react'

/* =========================================================
 * Legal Policy Modal
 *
 * Accessible in-app viewer for Roam's legal policies.
 *
 * Features:
 * - Native modal dialog with focus management
 * - Escape key support
 * - Backdrop dismissal
 * - Mobile-friendly scrolling
 * - Preserves underlying signup form state
 * - External website fallback
 * - No iframe
 * - No policy acceptance side effects
 *
 * SECURITY:
 * The html prop MUST contain HTML sanitized by a
 * trusted server-side process before it reaches this
 * component.
 *
 * Never pass arbitrary website HTML directly into this
 * component without sanitizing it first.
 * ======================================================= */

export type LegalPolicyModalProps = {
  open: boolean

  onClose: () => void

  title: string

  html: string | null

  externalUrl: string

  effectiveDate?: string | null

  loading?: boolean

  error?: string | null
}

export default function LegalPolicyModal({
  open,
  onClose,
  title,
  html,
  externalUrl,
  effectiveDate = null,
  loading = false,
  error = null,
}: LegalPolicyModalProps) {
  const dialogRef =
    useRef<HTMLDialogElement | null>(
      null
    )

  const closeButtonRef =
    useRef<HTMLButtonElement | null>(
      null
    )

  const headingId =
    useId()

  const descriptionId =
    useId()

  /* =========================================================
   * Native dialog lifecycle
   *
   * showModal() handles:
   * - Background inertness
   * - Focus containment
   * - Modal accessibility semantics
   * - Escape key cancellation
   * ======================================================= */

  useEffect(() => {
    const dialog =
      dialogRef.current

    if (!dialog) {
      return
    }

    if (open) {
      if (!dialog.open) {
        dialog.showModal()
      }

      closeButtonRef.current?.focus()
    } else if (dialog.open) {
      dialog.close()
    }
  }, [open])

  /* =========================================================
   * Close interaction
   * ======================================================= */

  function handleCancel(
    event: React.SyntheticEvent<HTMLDialogElement>
  ) {
    event.preventDefault()
    onClose()
  }

  function handleBackdropClick(
    event: MouseEvent<HTMLDialogElement>
  ) {
    if (
      event.target !==
      event.currentTarget
    ) {
      return
    }

    onClose()
  }

  /* =========================================================
   * Policy display states
   * ======================================================= */

  const hasPolicyContent =
    typeof html === 'string' &&
    html.trim().length > 0

  const showLoading =
    loading && !hasPolicyContent

  const showError =
    !showLoading &&
    Boolean(error)

  const showUnavailable =
    !showLoading &&
    !showError &&
    !hasPolicyContent

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={
        headingId
      }
      aria-describedby={
        descriptionId
      }
      onCancel={
        handleCancel
      }
      onClick={
        handleBackdropClick
      }
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-1.5rem)] max-w-3xl overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0b0d12] p-0 text-white shadow-[0_35px_120px_rgba(0,0,0,0.65)] backdrop:bg-black/80 backdrop:backdrop-blur-sm sm:w-[calc(100%-3rem)] sm:rounded-[2rem]"
    >
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden">
        {/* ===============================================
            Header
            ============================================= */}

        <div className="relative shrink-0 overflow-hidden border-b border-white/[0.08] px-5 pb-4 pt-5 sm:px-7 sm:pb-5 sm:pt-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(34,211,238,0.09),_transparent_65%)]" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                Roam Curated LLC
              </p>

              <h2
                id={headingId}
                className="mt-2 break-words text-xl font-black leading-tight tracking-tight text-white sm:text-2xl"
              >
                {title}
              </h2>

              <p
                id={descriptionId}
                className="mt-2 text-xs leading-5 text-zinc-400"
              >
                Review this policy without leaving your Roam account setup.
              </p>

              {effectiveDate ? (
                <p className="mt-2 text-[11px] font-medium text-zinc-500">
                  Effective: {effectiveDate}
                </p>
              ) : null}
            </div>

            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label={`Close ${title}`}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-zinc-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ===============================================
            Scrollable policy content
            ============================================= */}

        <div
          tabIndex={0}
          aria-label={`${title} document`}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cyan-300 sm:px-7 sm:py-7"
        >
          {showLoading ? (
            <div
              role="status"
              aria-live="polite"
              className="space-y-4"
            >
              <div className="h-6 w-3/4 animate-pulse rounded-lg bg-white/[0.08]" />

              <div className="h-4 w-full animate-pulse rounded bg-white/[0.05]" />

              <div className="h-4 w-11/12 animate-pulse rounded bg-white/[0.05]" />

              <div className="h-4 w-4/5 animate-pulse rounded bg-white/[0.05]" />

              <div className="h-6 w-1/2 animate-pulse rounded-lg bg-white/[0.08]" />

              <div className="h-4 w-full animate-pulse rounded bg-white/[0.05]" />

              <div className="h-4 w-5/6 animate-pulse rounded bg-white/[0.05]" />

              <p className="pt-2 text-sm text-zinc-400">
                Loading policy...
              </p>
            </div>
          ) : showError ? (
            <div
              role="alert"
              className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.055] p-5"
            >
              <h3 className="text-sm font-bold text-amber-100">
                Policy unavailable
              </h3>

              <p className="mt-2 text-sm leading-6 text-zinc-300">
                {error}
              </p>

              <p className="mt-3 text-xs leading-5 text-zinc-400">
                You can still open the complete policy on Roam&apos;s public website using the link below.
              </p>
            </div>
          ) : showUnavailable ? (
            <div
              role="status"
              className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"
            >
              <h3 className="text-sm font-bold text-white">
                Policy content unavailable
              </h3>

              <p className="mt-2 text-sm leading-6 text-zinc-400">
                The document could not be displayed inside Roam. You can read the full policy on our website.
              </p>
            </div>
          ) : (
            <article
              className={[
                'legal-policy-content',
                'min-w-0 break-words text-sm leading-7 text-zinc-300',
                '[&_h1]:mb-5 [&_h1]:text-2xl [&_h1]:font-black [&_h1]:leading-tight [&_h1]:text-white',
                '[&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-white',
                '[&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-white',
                '[&_h4]:mb-2 [&_h4]:mt-5 [&_h4]:font-semibold [&_h4]:text-white',
                '[&_p]:mb-4',
                '[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5',
                '[&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5',
                '[&_li]:pl-1',
                '[&_strong]:font-bold [&_strong]:text-white',
                '[&_b]:font-bold [&_b]:text-white',
                '[&_a]:break-all [&_a]:font-semibold [&_a]:text-cyan-300 [&_a]:underline [&_a]:underline-offset-2',
                '[&_blockquote]:my-5 [&_blockquote]:border-l-2 [&_blockquote]:border-cyan-300/40 [&_blockquote]:pl-4 [&_blockquote]:text-zinc-400',
                '[&_hr]:my-7 [&_hr]:border-white/10',
                '[&_table]:my-5 [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:text-left',
                '[&_th]:border [&_th]:border-white/15 [&_th]:bg-white/[0.05] [&_th]:p-2 [&_th]:text-white',
                '[&_td]:border [&_td]:border-white/10 [&_td]:p-2',
                '[&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-black/40 [&_pre]:p-3',
              ].join(' ')}
              dangerouslySetInnerHTML={{
                __html: html!,
              }}
            />
          )}
        </div>

        {/* ===============================================
            Footer actions
            ============================================= */}

        <div className="shrink-0 border-t border-white/[0.08] bg-[#10131a] px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-7 sm:py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-2 text-center text-xs font-semibold text-cyan-300 transition hover:bg-white/[0.04] hover:text-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 sm:justify-start"
            >
              Open full policy on website

              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M7 17 17 7M8 7h9v9" />
              </svg>
            </a>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/10 transition hover:from-cyan-400 hover:to-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
            >
              Close &amp; Return
            </button>
          </div>
        </div>
      </div>
    </dialog>
  )
}
