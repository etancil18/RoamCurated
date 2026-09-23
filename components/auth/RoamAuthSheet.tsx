'use client'

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import type { User } from '@supabase/supabase-js'

import RoamAuthForm from '@/components/auth/RoamAuthForm'

export type RoamAuthSheetProps = {
  open: boolean
  onClose: () => void
  onAuthenticated: (
    user: User
  ) => void | Promise<void>
  title?: string
  description?: string
  submitLabel?: string
  children?: ReactNode
  dismissible?: boolean
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export default function RoamAuthSheet({
  open,
  onClose,
  onAuthenticated,
  title = 'Continue with Roam',
  description = 'Sign in or create your Roam account to continue.',
  submitLabel = 'Continue',
  children,
  dismissible = true,
}: RoamAuthSheetProps) {
  const dialogRef =
    useRef<HTMLDivElement | null>(
      null
    )
  const previousActiveElementRef =
    useRef<HTMLElement | null>(
      null
    )
  const titleId =
    useId()
  const descriptionId =
    useId()

  const handleAuthenticated =
    useCallback(
      async (
        user: User
      ) => {
        await onAuthenticated(
          user
        )
      },
      [
        onAuthenticated,
      ]
    )

  const handleClose =
    useCallback(() => {
      if (!dismissible) {
        return
      }

      onClose()
    }, [
      dismissible,
      onClose,
    ])

  useEffect(() => {
    if (
      !open ||
      typeof document ===
        'undefined'
    ) {
      return
    }

    previousActiveElementRef.current =
      document.activeElement instanceof
      HTMLElement
        ? document.activeElement
        : null

    const previousOverflow =
      document.body.style
        .overflow

    document.body.style.overflow =
      'hidden'

    const focusDialog = () => {
      const dialog =
        dialogRef.current

      if (!dialog) {
        return
      }

      const focusableElements =
        getFocusableElements(
          dialog
        )

      const initialTarget =
        focusableElements[0] ??
        dialog

      initialTarget.focus({
        preventScroll: true,
      })
    }

    const animationFrame =
      window.requestAnimationFrame(
        focusDialog
      )

    return () => {
      window.cancelAnimationFrame(
        animationFrame
      )

      document.body.style.overflow =
        previousOverflow

      const previousActiveElement =
        previousActiveElementRef.current

      if (
        previousActiveElement &&
        document.contains(
          previousActiveElement
        )
      ) {
        previousActiveElement.focus({
          preventScroll: true,
        })
      }

      previousActiveElementRef.current =
        null
    }
  }, [
    open,
  ])

  useEffect(() => {
    if (
      !open ||
      typeof document ===
        'undefined'
    ) {
      return
    }

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      const dialog =
        dialogRef.current

      if (!dialog) {
        return
      }

      if (
        event.key ===
        'Escape'
      ) {
        if (!dismissible) {
          return
        }

        event.preventDefault()
        onClose()
        return
      }

      if (
        event.key !==
        'Tab'
      ) {
        return
      }

      const focusableElements =
        getFocusableElements(
          dialog
        )

      if (
        focusableElements.length ===
        0
      ) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const firstElement =
        focusableElements[0]
      const lastElement =
        focusableElements[
          focusableElements.length -
            1
        ]

      const activeElement =
        document.activeElement

      if (
        event.shiftKey
      ) {
        if (
          activeElement ===
            firstElement ||
          !dialog.contains(
            activeElement
          )
        ) {
          event.preventDefault()
          lastElement.focus()
        }

        return
      }

      if (
        activeElement ===
          lastElement ||
        !dialog.contains(
          activeElement
        )
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
    dismissible,
    onClose,
    open,
  ])

  if (
    !open ||
    typeof document ===
      'undefined'
  ) {
    return null
  }

  const handleBackdropMouseDown = (
    event: MouseEvent<HTMLDivElement>
  ) => {
    if (
      event.target !==
      event.currentTarget
    ) {
      return
    }

    handleClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[6000] flex min-h-dvh items-end justify-center bg-black/70 px-0 pt-8 backdrop-blur-sm sm:items-center sm:px-4 sm:py-8"
      onMouseDown={
        handleBackdropMouseDown
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
        className="relative flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-t-[2rem] border border-white/10 bg-[#09090b] text-white shadow-[0_-24px_80px_rgba(0,0,0,0.55)] outline-none sm:max-h-[min(760px,calc(100dvh-4rem))] sm:max-w-lg sm:rounded-[2rem] sm:shadow-[0_32px_100px_rgba(0,0,0,0.65)]"
        onMouseDown={(
          event
        ) =>
          event.stopPropagation()
        }
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.12),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.12),transparent_42%)]"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent"
        />

        <div className="relative flex shrink-0 items-center justify-center px-5 pb-2 pt-3 sm:hidden">
          <div className="h-1.5 w-11 rounded-full bg-white/20" />
        </div>

        {dismissible ? (
          <button
            type="button"
            onClick={
              handleClose
            }
            aria-label="Close authentication"
            className="absolute right-4 top-4 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/30 text-xl leading-none text-neutral-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
          >
            <span
              aria-hidden="true"
            >
              ×
            </span>
          </button>
        ) : null}

        <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 sm:px-8 sm:pb-8 sm:pt-8">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-6 pr-10 sm:mb-7">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5">
                <img
                  src="/favicon-new.ico"
                  alt=""
                  aria-hidden="true"
                  className="h-5 w-5 rounded-sm"
                />

                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-300">
                  Roam
                </span>
              </div>

              <h2
                id={titleId}
                className="mt-5 text-2xl font-black tracking-tight text-white sm:text-3xl"
              >
                {title}
              </h2>

              <p
                id={
                  descriptionId
                }
                className="mt-2 max-w-md text-sm leading-6 text-neutral-400"
              >
                {description}
              </p>
            </div>

            {children ? (
              <div className="mb-6">
                {children}
              </div>
            ) : null}

            <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.05] p-1 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
              <div className="rounded-[1.25rem] bg-white p-5 text-zinc-900 dark:bg-zinc-950 dark:text-white sm:p-6">
                <RoamAuthForm
                  mode="contextual"
                  title=""
                  description=""
                  submitLabel={
                    submitLabel
                  }
                  onAuthenticated={
                    handleAuthenticated
                  }
                />
              </div>
            </div>

            <p className="mx-auto mt-5 max-w-sm text-center text-xs leading-5 text-neutral-500">
              Your Roam account
              keeps your places,
              Passport, Flows, and
              city history
              connected.
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

function getFocusableElements(
  container: HTMLElement
): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      FOCUSABLE_SELECTOR
    )
  ).filter(
    (
      element
    ) =>
      !element.hasAttribute(
        'disabled'
      ) &&
      element.getAttribute(
        'aria-hidden'
      ) !== 'true' &&
      isElementVisible(
        element
      )
  )
}

function isElementVisible(
  element: HTMLElement
): boolean {
  const style =
    window.getComputedStyle(
      element
    )

  if (
    style.display ===
      'none' ||
    style.visibility ===
      'hidden'
  ) {
    return false
  }

  return (
    element.getClientRects()
      .length > 0
  )
}