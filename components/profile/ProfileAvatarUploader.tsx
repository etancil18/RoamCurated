'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

import type { Database } from '@/types/supabase'

/* =========================================================
 * Public contracts
 * ======================================================= */

export type ProfileAvatarUploaderProps = {
  /**
   * Current profiles.avatar_url value.
   */
  initialAvatarUrl?: string | null

  /**
   * Optional display name used for accessible labeling
   * and the fallback avatar treatment.
   */
  displayName?: string | null

  className?: string
}

/* =========================================================
 * Constants
 * ======================================================= */

const AVATAR_BUCKET =
  'avatars'

const MAX_FILE_SIZE_BYTES =
  5 * 1024 * 1024

const ALLOWED_MIME_TYPES =
  new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
  ])

const FILE_EXTENSION_BY_MIME_TYPE:
  Record<
    string,
    string
  > = {
    'image/jpeg':
      'jpg',

    'image/png':
      'png',

    'image/webp':
      'webp',

    'image/avif':
      'avif',
  }

/* =========================================================
 * Supabase
 * ======================================================= */

function createSupabaseBrowserClient() {
  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL

  const supabaseKey =
    process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env
      .NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (
    !supabaseUrl ||
    !supabaseKey
  ) {
    throw new Error(
      'Supabase browser environment variables are not configured.'
    )
  }

  return createBrowserClient<Database>(
    supabaseUrl,
    supabaseKey
  )
}

/* =========================================================
 * Component
 * ======================================================= */

export default function ProfileAvatarUploader({
  initialAvatarUrl,
  displayName,
  className,
}: ProfileAvatarUploaderProps) {
  const router =
    useRouter()

  const inputRef =
    useRef<HTMLInputElement | null>(
      null
    )

  const supabase =
    useMemo(
      () =>
        createSupabaseBrowserClient(),
      []
    )

  const [
    currentAvatarUrl,
    setCurrentAvatarUrl,
  ] =
    useState<
      string | null
    >(
      normalizeNullableText(
        initialAvatarUrl
      )
    )

  const [
    selectedFile,
    setSelectedFile,
  ] =
    useState<
      File | null
    >(null)

  const [
    previewUrl,
    setPreviewUrl,
  ] =
    useState<
      string | null
    >(null)

  const [
    uploading,
    setUploading,
  ] =
    useState(false)

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null)

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState<
      string | null
    >(null)

  useEffect(
    () => {
      if (
        selectedFile
      ) {
        return
      }

      setCurrentAvatarUrl(
        normalizeNullableText(
          initialAvatarUrl
        )
      )
    },
    [
      initialAvatarUrl,
      selectedFile,
    ]
  )

  useEffect(
    () => {
      if (
        !selectedFile
      ) {
        setPreviewUrl(
          null
        )

        return
      }

      const objectUrl =
        URL.createObjectURL(
          selectedFile
        )

      setPreviewUrl(
        objectUrl
      )

      return () => {
        URL.revokeObjectURL(
          objectUrl
        )
      }
    },
    [
      selectedFile,
    ]
  )

  const displayedAvatarUrl =
    previewUrl ??
    currentAvatarUrl

  const normalizedDisplayName =
    normalizeNullableText(
      displayName
    )

  const fallbackInitial =
    getFallbackInitial(
      normalizedDisplayName
    )

  function resetFileInput() {
    if (
      inputRef.current
    ) {
      inputRef.current.value =
        ''
    }
  }

  function clearSelection() {
    setSelectedFile(
      null
    )

    setError(
      null
    )

    resetFileInput()
  }

  function handleFileChange(
    event:
      React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0] ??
      null

    setSuccessMessage(
      null
    )

    setError(
      null
    )

    if (!file) {
      setSelectedFile(
        null
      )

      return
    }

    const validationError =
      validateAvatarFile(
        file
      )

    if (
      validationError
    ) {
      setSelectedFile(
        null
      )

      setError(
        validationError
      )

      resetFileInput()

      return
    }

    setSelectedFile(
      file
    )
  }

  async function handleUpload() {
    if (
      !selectedFile ||
      uploading
    ) {
      return
    }

    setUploading(
      true
    )

    setError(
      null
    )

    setSuccessMessage(
      null
    )

    let uploadedPath:
      string | null =
      null

    try {
      const {
        data: {
          user,
        },
        error:
          userError,
      } =
        await supabase.auth.getUser()

      if (
        userError ||
        !user
      ) {
        throw new Error(
          'You must be signed in to update your profile photo.'
        )
      }

      const extension =
        FILE_EXTENSION_BY_MIME_TYPE[
          selectedFile.type
        ]

      if (
        !extension
      ) {
        throw new Error(
          'Choose a JPG, PNG, WEBP, or AVIF image.'
        )
      }

      const fileName =
        `avatar-${Date.now()}.${extension}`

      uploadedPath =
        `${user.id}/${fileName}`

      const {
        error:
          uploadError,
      } =
        await supabase.storage
          .from(
            AVATAR_BUCKET
          )
          .upload(
            uploadedPath,
            selectedFile,
            {
              cacheControl:
                '31536000',

              contentType:
                selectedFile.type,

              upsert:
                false,
            }
          )

      if (
        uploadError
      ) {
        throw uploadError
      }

      const {
        data:
          publicUrlData,
      } =
        supabase.storage
          .from(
            AVATAR_BUCKET
          )
          .getPublicUrl(
            uploadedPath
          )

      const publicUrl =
        normalizeNullableText(
          publicUrlData
            .publicUrl
        )

      if (
        !publicUrl
      ) {
        throw new Error(
          'The profile photo uploaded, but its public URL could not be created.'
        )
      }

      const previousAvatarUrl =
        currentAvatarUrl

      const {
        error:
          profileError,
      } =
        await supabase
          .from(
            'profiles'
          )
          .update({
            avatar_url:
              publicUrl,
          })
          .eq(
            'id',
            user.id
          )

      if (
        profileError
      ) {
        /*
         * The object exists but the profile update failed.
         * Roll back the new upload so Storage does not accumulate
         * an orphaned avatar.
         */
        await supabase.storage
          .from(
            AVATAR_BUCKET
          )
          .remove([
            uploadedPath,
          ])
          .catch(
            (
              cleanupError
            ) => {
              console.warn(
                '[ProfileAvatarUploader] Failed to roll back uploaded avatar:',
                cleanupError
              )
            }
          )

        uploadedPath =
          null

        throw profileError
      }

      setCurrentAvatarUrl(
        publicUrl
      )

      setSelectedFile(
        null
      )

      resetFileInput()

      setSuccessMessage(
        'Profile photo updated.'
      )

      /*
       * Delete the previous object only after profiles.avatar_url
       * has successfully moved to the new one.
       *
       * External/default image URLs are ignored.
       */
      const previousAvatarPath =
        extractAvatarStoragePath(
          previousAvatarUrl
        )

      if (
        previousAvatarPath &&
        previousAvatarPath !==
          uploadedPath
      ) {
        const {
          error:
            cleanupError,
        } =
          await supabase.storage
            .from(
              AVATAR_BUCKET
            )
            .remove([
              previousAvatarPath,
            ])

        if (
          cleanupError
        ) {
          console.warn(
            '[ProfileAvatarUploader] Old avatar cleanup failed:',
            cleanupError
          )
        }
      }

      router.refresh()
    } catch (
      uploadError
    ) {
      console.error(
        '[ProfileAvatarUploader] Avatar update failed:',
        uploadError
      )

      setError(
        getErrorMessage(
          uploadError
        )
      )
    } finally {
      setUploading(
        false
      )
    }
  }

  return (
    <section
      aria-label="Profile photo"
      className={[
        'w-full min-w-0',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex min-w-0 items-center gap-4">
        <div className="relative shrink-0">
          <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-cyan-300/20 via-indigo-400/15 to-transparent blur-md" />

          <div className="relative h-20 w-20 overflow-hidden rounded-full bg-white/[0.04] ring-1 ring-white/[0.09] sm:h-24 sm:w-24">
            {displayedAvatarUrl ? (
              <div
                role="img"
                aria-label={
                  normalizedDisplayName
                    ? `${normalizedDisplayName} profile photo`
                    : 'Profile photo'
                }
                className="h-full w-full bg-cover bg-center"
                style={{
                  backgroundImage:
                    `url("${displayedAvatarUrl}")`,
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/[0.07] to-white/[0.025]">
                <span
                  aria-hidden="true"
                  className="text-2xl font-black uppercase tracking-[-0.04em] text-zinc-500"
                >
                  {
                    fallbackInitial
                  }
                </span>
              </div>
            )}
          </div>

          {selectedFile ? (
            <span className="absolute -bottom-1 -right-1 inline-flex h-7 items-center rounded-full bg-cyan-300 px-2.5 text-[9px] font-black uppercase tracking-[0.1em] text-black shadow-[0_8px_24px_rgba(103,232,249,0.2)]">
              Preview
            </span>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-black tracking-[-0.02em] text-white">
            Your photo
          </p>

          <p className="mt-1 max-w-md text-xs leading-5 text-zinc-600">
            This is how people see you across Roam.
          </p>

          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
            <label
              htmlFor="profile-avatar-upload"
              className={[
                'inline-flex min-h-10 cursor-pointer items-center justify-center rounded-full px-4 text-xs font-black transition',
                uploading
                  ? 'pointer-events-none bg-white/[0.05] text-zinc-700'
                  : 'bg-white text-black hover:bg-cyan-200',
              ].join(
                ' '
              )}
            >
              {currentAvatarUrl
                ? 'Change photo'
                : 'Choose photo'}
            </label>

            {selectedFile ? (
              <>
                <button
                  type="button"
                  disabled={
                    uploading
                  }
                  onClick={
                    handleUpload
                  }
                  className="inline-flex min-h-10 items-center justify-center rounded-full bg-cyan-300/[0.09] px-4 text-xs font-black text-cyan-200 ring-1 ring-cyan-300/15 transition hover:bg-cyan-300/[0.14] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {uploading
                    ? 'Saving…'
                    : 'Save photo'}
                </button>

                <button
                  type="button"
                  disabled={
                    uploading
                  }
                  onClick={
                    clearSelection
                  }
                  className="inline-flex min-h-10 items-center justify-center rounded-full px-3 text-xs font-bold text-zinc-600 transition hover:bg-white/[0.035] hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
              </>
            ) : null}
          </div>

          <input
            ref={
              inputRef
            }
            id="profile-avatar-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            disabled={
              uploading
            }
            onChange={
              handleFileChange
            }
            className="sr-only"
          />
        </div>
      </div>

      <div className="mt-4 border-t border-white/[0.05] pt-3">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] leading-5 text-zinc-700">
            JPG, PNG, WEBP or AVIF · 5 MB max
          </p>

          {selectedFile ? (
            <p className="max-w-[14rem] truncate text-[10px] font-medium text-zinc-600">
              {
                selectedFile.name
              }
            </p>
          ) : null}
        </div>

        <div
          aria-live="polite"
          aria-atomic="true"
        >
          {error ? (
            <div
              role="alert"
              className="mt-3 rounded-[1.1rem] bg-red-400/[0.06] px-3.5 py-3 ring-1 ring-red-400/15"
            >
              <p className="text-xs font-bold text-red-200">
                {error}
              </p>
            </div>
          ) : null}

          {!error &&
          successMessage ? (
            <div
              role="status"
              className="mt-3 flex items-center gap-2 rounded-[1.1rem] bg-emerald-300/[0.055] px-3.5 py-3 ring-1 ring-emerald-300/12"
            >
              <span
                aria-hidden="true"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-300/[0.1] text-[10px] font-black text-emerald-200"
              >
                ✓
              </span>

              <p className="text-xs font-bold text-emerald-200">
                {
                  successMessage
                }
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

/* =========================================================
 * Validation
 * ======================================================= */

function validateAvatarFile(
  file: File
): string | null {
  if (
    !ALLOWED_MIME_TYPES.has(
      file.type
    )
  ) {
    return 'Choose a JPG, PNG, WEBP, or AVIF image.'
  }

  if (
    file.size <=
    0
  ) {
    return 'That image appears to be empty. Choose another photo.'
  }

  if (
    file.size >
    MAX_FILE_SIZE_BYTES
  ) {
    return 'Profile photos must be 5 MB or smaller.'
  }

  return null
}

/* =========================================================
 * Storage helpers
 * ======================================================= */

function extractAvatarStoragePath(
  avatarUrl:
    | string
    | null
    | undefined
): string | null {
  const normalizedUrl =
    normalizeNullableText(
      avatarUrl
    )

  if (
    !normalizedUrl
  ) {
    return null
  }

  try {
    const url =
      new URL(
        normalizedUrl
      )

    const marker =
      `/storage/v1/object/public/${AVATAR_BUCKET}/`

    const markerIndex =
      url.pathname.indexOf(
        marker
      )

    if (
      markerIndex ===
      -1
    ) {
      return null
    }

    const encodedPath =
      url.pathname.slice(
        markerIndex +
          marker.length
      )

    if (
      !encodedPath
    ) {
      return null
    }

    return decodeURIComponent(
      encodedPath
    )
  } catch {
    return null
  }
}

/* =========================================================
 * Primitive helpers
 * ======================================================= */

function normalizeNullableText(
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

  return normalized.length >
    0
    ? normalized
    : null
}

function getFallbackInitial(
  displayName:
    | string
    | null
): string {
  if (
    !displayName
  ) {
    return 'R'
  }

  return (
    displayName
      .charAt(0)
      .toUpperCase() ||
    'R'
  )
}

function getErrorMessage(
  error: unknown
): string {
  if (
    error instanceof
    Error &&
    error.message.trim()
      .length >
      0
  ) {
    return error.message
  }

  if (
    typeof error ===
      'object' &&
    error !== null &&
    'message' in error &&
    typeof (
      error as {
        message?:
          unknown
      }
    ).message ===
      'string'
  ) {
    const message =
      (
        error as {
          message:
            string
        }
      ).message.trim()

    if (
      message
    ) {
      return message
    }
  }

  return 'Could not update your profile photo. Please try again.'
}