'use client'

import {
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  createBrowserClient,
} from '@supabase/ssr'

import {
  deleteCreatorCollectionMediaAction,
  registerCreatorCollectionMediaAction,
  reorderCreatorCollectionMediaAction,
  setCreatorCollectionCoverMediaAction,
  updateCreatorCollectionMediaAction,
} from '@/app/profile/creator/collections/media-actions'

import {
  buildCreatorCollectionMediaStoragePath,
  CREATOR_COLLECTION_MEDIA_ACCEPT,
  CREATOR_COLLECTION_MEDIA_BUCKET,
  CREATOR_COLLECTION_MEDIA_LIMITS,
  getCreatorCollectionMediaDefinition,
  isCreatorCollectionMediaMimeType,
  type CreatorCollectionMediaMimeType,
  type CreatorCollectionMediaRecord,
} from '@/lib/creator/collectionMedia'

import type {
  Database,
} from '@/types/supabase'

/* =========================================================
 * Public contracts
 * ======================================================= */

export type CollectionMediaManagerProps = {
  collectionId: string

  initialMedia:
    CreatorCollectionMediaRecord[]

  initialCoverMediaId:
  | string
  | null

  className?: string
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

export default function CollectionMediaManager({
  collectionId,
  initialMedia,
  initialCoverMediaId,
  className,
}: CollectionMediaManagerProps) {
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
    media,
    setMedia,
  ] =
    useState<
      CreatorCollectionMediaRecord[]
    >(
      () =>
        sortMedia(
          initialMedia
        )
    )

  const [
  selectedCoverMediaId,
  setSelectedCoverMediaId,
] =
  useState<
    string | null
  >(
    initialCoverMediaId
  )

  const [
    uploading,
    setUploading,
  ] =
    useState(false)

  const [
    busyMediaId,
    setBusyMediaId,
  ] =
    useState<
      string | null
    >(null)

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

  const remainingSlots =
    Math.max(
      0,
      CREATOR_COLLECTION_MEDIA_LIMITS
        .maximumItems -
        media.length
    )

  function resetFileInput() {
    if (
      inputRef.current
    ) {
      inputRef.current.value =
        ''
    }
  }

  async function handleFilesSelected(
    event:
      React.ChangeEvent<HTMLInputElement>
  ) {
    const files =
      Array.from(
        event.target.files ??
        []
      )

    if (
      files.length ===
      0
    ) {
      return
    }

    setError(
      null
    )

    setSuccessMessage(
      null
    )

    if (
      uploading ||
      busyMediaId
    ) {
      resetFileInput()

      return
    }

    if (
      files.length >
      remainingSlots
    ) {
      setError(
        remainingSlots ===
          0
          ? `This collection already has the maximum of ${CREATOR_COLLECTION_MEDIA_LIMITS.maximumItems} media items.`
          : `You can add ${remainingSlots.toLocaleString()} more ${
              remainingSlots ===
              1
                ? 'item'
                : 'items'
            } to this collection.`
      )

      resetFileInput()

      return
    }

    for (
      const file of
        files
    ) {
      const validationError =
        await validateCollectionMediaFile(
          file
        )

      if (
        validationError
      ) {
        setError(
          `${file.name}: ${validationError}`
        )

        resetFileInput()

        return
      }
    }

    setUploading(
      true
    )

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
          'You must be signed in to upload collection media.'
        )
      }

      const uploadedMedia:
        CreatorCollectionMediaRecord[] =
        []

      /*
       * Upload sequentially.
       *
       * Registration calculates collection count and next sort order,
       * so serial execution avoids unnecessary application-level races.
       */
      for (
        const file of
          files
      ) {
        const mediaRecord =
          await uploadAndRegisterFile({
            supabase,
            userId:
              user.id,
            collectionId,
            file,
          })

        uploadedMedia.push(
          mediaRecord
        )

        /*
         * Update progressively so successfully completed uploads remain
         * visible even if a later file fails.
         */
        setMedia(
          (current) =>
            sortMedia([
              ...current,
              mediaRecord,
            ])
        )
      }

      setSuccessMessage(
        uploadedMedia.length ===
          1
          ? 'Media added to the collection.'
          : `${uploadedMedia.length.toLocaleString()} media items added to the collection.`
      )

      resetFileInput()
    } catch (
      uploadError
    ) {
      console.error(
        '[CollectionMediaManager] Media upload failed:',
        uploadError
      )

      setError(
        getErrorMessage(
          uploadError
        )
      )

      resetFileInput()
    } finally {
      setUploading(
        false
      )
    }
  }

  async function uploadAndRegisterFile({
    supabase,
    userId,
    collectionId,
    file,
  }: {
    supabase:
      ReturnType<
        typeof createSupabaseBrowserClient
      >
    userId: string
    collectionId: string
    file: File
  }): Promise<CreatorCollectionMediaRecord> {
    if (
      !isCreatorCollectionMediaMimeType(
        file.type
      )
    ) {
      throw new Error(
        'That file type is not supported.'
      )
    }

    const mimeType =
      file.type

    const definition =
      getCreatorCollectionMediaDefinition(
        mimeType
      )

    const mediaId =
      crypto.randomUUID()

    const storagePath =
      buildCreatorCollectionMediaStoragePath({
        userId,
        collectionId,
        mediaId,
        mimeType,
      })

    const metadata =
      await loadMediaMetadata({
        file,
        mimeType,
      })

    let uploaded =
      false

    try {
      const {
        error:
          uploadError,
      } =
        await supabase.storage
          .from(
            CREATOR_COLLECTION_MEDIA_BUCKET
          )
          .upload(
            storagePath,
            file,
            {
              cacheControl:
                '31536000',

              contentType:
                mimeType,

              upsert:
                false,
            }
          )

      if (
        uploadError
      ) {
        throw uploadError
      }

      uploaded =
        true

      const result =
        await registerCreatorCollectionMediaAction(
          {
            collectionId,
            mediaId,

            mediaType:
              definition.mediaType,

            mimeType,

            caption:
              null,

            altText:
              null,

            width:
              metadata.width,

            height:
              metadata.height,

            durationSeconds:
              metadata.durationSeconds,
          }
        )

      if (
        !result.success
      ) {
        throw new Error(
          result.error
        )
      }

      return result.media
    } catch (
      uploadError
    ) {
      /*
       * Registration failed after Storage succeeded.
       * Roll back only the object created during this operation.
       */
      if (uploaded) {
        const {
          error:
            cleanupError,
        } =
          await supabase.storage
            .from(
              CREATOR_COLLECTION_MEDIA_BUCKET
            )
            .remove([
              storagePath,
            ])

        if (
          cleanupError
        ) {
          console.warn(
            '[CollectionMediaManager] Failed to roll back uploaded media:',
            {
              storagePath,
              error:
                cleanupError,
            }
          )
        }
      }

      throw uploadError
    }
  }

  async function handleMove(
    mediaId: string,
    direction:
      | 'previous'
      | 'next'
  ) {
    if (
      uploading ||
      busyMediaId
    ) {
      return
    }

    const currentIndex =
      media.findIndex(
        (item) =>
          item.id ===
          mediaId
      )

    if (
      currentIndex ===
      -1
    ) {
      return
    }

    const targetIndex =
      direction ===
        'previous'
        ? currentIndex -
          1
        : currentIndex +
          1

    if (
      targetIndex <
        0 ||
      targetIndex >=
        media.length
    ) {
      return
    }

    const previousMedia =
      media

    const nextMedia = [
      ...media,
    ]

    const [
      movedItem,
    ] =
      nextMedia.splice(
        currentIndex,
        1
      )

    if (!movedItem) {
      return
    }

    nextMedia.splice(
      targetIndex,
      0,
      movedItem
    )

    const normalizedNextMedia =
      nextMedia.map(
        (
          item,
          index
        ) => ({
          ...item,
          sort_order:
            index,
        })
      )

    setBusyMediaId(
      mediaId
    )

    setError(
      null
    )

    setSuccessMessage(
      null
    )

    setMedia(
      normalizedNextMedia
    )

    try {
      const result =
        await reorderCreatorCollectionMediaAction(
          {
            collectionId,

            mediaIds:
              normalizedNextMedia.map(
                (item) =>
                  item.id
              ),
          }
        )

      if (
        !result.success
      ) {
        throw new Error(
          result.error
        )
      }

      setSuccessMessage(
        'Media order updated.'
      )
    } catch (
      reorderError
    ) {
      console.error(
        '[CollectionMediaManager] Media reorder failed:',
        reorderError
      )

      setMedia(
        previousMedia
      )

      setError(
        getErrorMessage(
          reorderError
        )
      )
    } finally {
      setBusyMediaId(
        null
      )
    }
  }

  async function handleSetCover(
    mediaId: string
  ) {
    if (
      uploading ||
      busyMediaId ||
      selectedCoverMediaId ===
        mediaId
    ) {
      return
    }

    const item =
      media.find(
        (mediaItem) =>
          mediaItem.id ===
          mediaId
      )

    if (
      !item ||
      item.media_type !==
        'image'
    ) {
      return
    }

    setBusyMediaId(
      mediaId
    )

    setError(
      null
    )

    setSuccessMessage(
      null
    )

    try {
      const result =
        await setCreatorCollectionCoverMediaAction(
          {
            collectionId,
            mediaId,
          }
        )

      if (
        !result.success
      ) {
        throw new Error(
          result.error
        )
      }

      setSelectedCoverMediaId(
        result.mediaId
      )

      setSuccessMessage(
        'Collection cover updated.'
      )
    } catch (
      coverError
    ) {
      console.error(
        '[CollectionMediaManager] Collection cover update failed:',
        coverError
      )

      setError(
        getErrorMessage(
          coverError
        )
      )
    } finally {
      setBusyMediaId(
        null
      )
    }
  }

  async function handleMetadataSave(
    mediaId: string,
    formData: FormData
  ) {
    if (
      uploading ||
      busyMediaId
    ) {
      return
    }

    setBusyMediaId(
      mediaId
    )

    setError(
      null
    )

    setSuccessMessage(
      null
    )

    try {
      const result =
        await updateCreatorCollectionMediaAction(
          {
            collectionId,
            mediaId,

            caption:
              formData.get(
                'caption'
              ),

            altText:
              formData.get(
                'altText'
              ),
          }
        )

      if (
        !result.success
      ) {
        throw new Error(
          result.error
        )
      }

      setMedia(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              mediaId
                ? result.media
                : item
          )
      )

      setSuccessMessage(
        'Media details updated.'
      )
    } catch (
      updateError
    ) {
      console.error(
        '[CollectionMediaManager] Media metadata update failed:',
        updateError
      )

      setError(
        getErrorMessage(
          updateError
        )
      )
    } finally {
      setBusyMediaId(
        null
      )
    }
  }

  async function handleDelete(
    mediaId: string
  ) {
    if (
      uploading ||
      busyMediaId
    ) {
      return
    }

    const item =
      media.find(
        (mediaItem) =>
          mediaItem.id ===
          mediaId
      )

    if (!item) {
      return
    }

    const isSelectedCover =
      selectedCoverMediaId ===
      mediaId

    const confirmed =
      window.confirm(
        isSelectedCover
          ? 'Remove this media item? It is currently the collection cover, so the explicit cover selection will be cleared.'
          : 'Remove this media item from the collection?'
      )

    if (!confirmed) {
      return
    }

    setBusyMediaId(
      mediaId
    )

    setError(
      null
    )

    setSuccessMessage(
      null
    )

    try {
      const result =
        await deleteCreatorCollectionMediaAction(
          {
            collectionId,
            mediaId,
          }
        )

      if (
        !result.success
      ) {
        throw new Error(
          result.error
        )
      }

      setMedia(
        (current) =>
          current
            .filter(
              (mediaItem) =>
                mediaItem.id !==
                mediaId
            )
            .map(
              (
                mediaItem,
                index
              ) => ({
                ...mediaItem,
                sort_order:
                  index,
              })
            )
      )

      if (
        isSelectedCover
      ) {
        setSelectedCoverMediaId(
          null
        )
      }

      setSuccessMessage(
        'Media removed from the collection.'
      )
    } catch (
      deleteError
    ) {
      console.error(
        '[CollectionMediaManager] Media deletion failed:',
        deleteError
      )

      setError(
        getErrorMessage(
          deleteError
        )
      )
    } finally {
      setBusyMediaId(
        null
      )
    }
  }

  return (
    <section
      aria-labelledby="collection-media-title"
      className={[
        'w-full min-w-0 overflow-hidden rounded-[1.75rem] border border-indigo-500/20 bg-neutral-950/75',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="border-b border-neutral-800/80 px-4 py-4 sm:px-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">
          Photos & videos
        </p>

        <div className="mt-1 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h2
              id="collection-media-title"
              className="text-lg font-semibold text-white"
            >
              Tell the story visually
            </h2>

            <p className="mt-1 max-w-2xl text-xs leading-5 text-neutral-500">
              Add up to{' '}
              {
                CREATOR_COLLECTION_MEDIA_LIMITS
                  .maximumItems
              }{' '}
              photos or videos.
              Choose any uploaded
              photo as the
              collection cover.
            </p>
          </div>

          <span className="w-fit shrink-0 rounded-full border border-neutral-800 bg-black/30 px-3 py-1.5 text-xs font-medium text-neutral-400">
            {media.length.toLocaleString()}
            {' / '}
            {
              CREATOR_COLLECTION_MEDIA_LIMITS
                .maximumItems
            }
          </span>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <div className="rounded-2xl border border-neutral-800 bg-black/30 p-4">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">
                Add media
              </p>

              <p className="mt-1 text-xs leading-5 text-neutral-600">
                JPG, PNG, WEBP or
                AVIF up to 15 MB.
                MP4 or WEBM up to
                50 MB and 60
                seconds.
              </p>
            </div>

            <label
              htmlFor={`collection-media-upload-${collectionId}`}
              className={[
                'inline-flex min-h-10 shrink-0 items-center justify-center rounded-full px-4 text-xs font-semibold transition',
                uploading ||
                busyMediaId ||
                remainingSlots ===
                  0
                  ? 'pointer-events-none bg-white/[0.05] text-neutral-700'
                  : 'cursor-pointer bg-white text-black hover:bg-cyan-200',
              ].join(
                ' '
              )}
            >
              {uploading
                ? 'Uploading…'
                : remainingSlots ===
                    0
                  ? 'Collection full'
                  : 'Add photos or videos'}
            </label>

            <input
              ref={
                inputRef
              }
              id={`collection-media-upload-${collectionId}`}
              type="file"
              multiple
              accept={
                CREATOR_COLLECTION_MEDIA_ACCEPT
              }
              disabled={
                uploading ||
                Boolean(
                  busyMediaId
                ) ||
                remainingSlots ===
                  0
              }
              onChange={
                handleFilesSelected
              }
              className="sr-only"
            />
          </div>
        </div>

        <div
          aria-live="polite"
          aria-atomic="true"
        >
          {error ? (
            <div
              role="alert"
              className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3"
            >
              <p className="text-xs font-semibold leading-5 text-red-200">
                {error}
              </p>
            </div>
          ) : null}

          {!error &&
          successMessage ? (
            <div
              role="status"
              className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3"
            >
              <p className="text-xs font-semibold leading-5 text-emerald-200">
                {
                  successMessage
                }
              </p>
            </div>
          ) : null}
        </div>

        {media.length >
        0 ? (
          <div className="space-y-3">
            {media.map(
              (
                item,
                index
              ) => (
                <CollectionMediaCard
                  key={
                    item.id
                  }
                  item={
                    item
                  }
                  index={
                    index
                  }
                  total={
                    media.length
                  }
                  publicUrl={
                    supabase.storage
                      .from(
                        CREATOR_COLLECTION_MEDIA_BUCKET
                      )
                      .getPublicUrl(
                        item.storage_path
                      ).data
                      .publicUrl
                  }
                  isCover={
                    selectedCoverMediaId ===
                    item.id
                  }
                  busy={
                    busyMediaId ===
                    item.id
                  }
                  disabled={
                    uploading ||
                    Boolean(
                      busyMediaId
                    )
                  }
                  onMovePrevious={() =>
                    handleMove(
                      item.id,
                      'previous'
                    )
                  }
                  onMoveNext={() =>
                    handleMove(
                      item.id,
                      'next'
                    )
                  }
                  onSetCover={() =>
                    handleSetCover(
                      item.id
                    )
                  }
                  onSave={(
                    formData
                  ) =>
                    handleMetadataSave(
                      item.id,
                      formData
                    )
                  }
                  onDelete={() =>
                    handleDelete(
                      item.id
                    )
                  }
                />
              )
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-neutral-800 bg-black/20 px-5 py-10 text-center">
            <div
              aria-hidden="true"
              className="text-3xl"
            >
              📸
            </div>

            <p className="mt-3 text-sm font-semibold text-neutral-300">
              No media yet
            </p>

            <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-neutral-600">
              Upload photos or
              videos to tell the
              collection’s story.
              Any uploaded photo
              can be selected as
              its cover.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

/* =========================================================
 * Media card
 * ======================================================= */

function CollectionMediaCard({
  item,
  index,
  total,
  publicUrl,
  isCover,
  busy,
  disabled,
  onMovePrevious,
  onMoveNext,
  onSetCover,
  onSave,
  onDelete,
}: {
  item:
    CreatorCollectionMediaRecord
  index: number
  total: number
  publicUrl: string
  isCover: boolean
  busy: boolean
  disabled: boolean
  onMovePrevious:
    () => void
  onMoveNext:
    () => void
  onSetCover:
    () => void
  onSave:
    (
      formData: FormData
    ) => Promise<void>
  onDelete:
    () => void
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-neutral-800 bg-black/30">
      <div className="grid min-w-0 gap-0 md:grid-cols-[220px_minmax(0,1fr)]">
        <div className="relative aspect-[4/3] overflow-hidden bg-neutral-900 md:aspect-auto md:min-h-[220px]">
          {item.media_type ===
          'image' ? (
            <img
              src={
                publicUrl
              }
              alt={
                item.alt_text ??
                ''
              }
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <video
              src={
                publicUrl
              }
              controls
              preload="metadata"
              playsInline
              className="h-full w-full object-cover"
            />
          )}

          {isCover ? (
            <span className="absolute left-3 top-3 rounded-full bg-black/75 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200 backdrop-blur">
              Cover
            </span>
          ) : null}

          <span className="absolute bottom-3 right-3 rounded-full bg-black/75 px-2.5 py-1 text-[10px] font-semibold text-neutral-300 backdrop-blur">
            {index + 1}
            {' / '}
            {total}
          </span>
        </div>

        <div className="min-w-0 p-4">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-600">
                {
                  item.media_type
                }
              </p>

              {item.width &&
              item.height ? (
                <p className="mt-1 text-[11px] text-neutral-700">
                  {item.width.toLocaleString()}
                  {' × '}
                  {item.height.toLocaleString()}
                  {item.duration_seconds !==
                  null
                    ? ` · ${formatDuration(
                        item.duration_seconds
                      )}`
                    : ''}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {item.media_type ===
              'image' ? (
                <button
                  type="button"
                  disabled={
                    disabled ||
                    isCover
                  }
                  onClick={
                    onSetCover
                  }
                  className={[
                    'inline-flex min-h-9 items-center justify-center rounded-full border px-3 text-xs font-semibold transition disabled:cursor-not-allowed',
                    isCover
                      ? 'border-cyan-500/25 bg-cyan-500/[0.08] text-cyan-200 disabled:opacity-100'
                      : 'border-neutral-800 text-neutral-400 hover:border-cyan-500/40 hover:text-cyan-200 disabled:opacity-30',
                  ].join(
                    ' '
                  )}
                >
                  {isCover
                    ? 'Cover'
                    : busy
                      ? 'Setting cover…'
                      : 'Make cover'}
                </button>
              ) : null}

              <button
                type="button"
                disabled={
                  disabled ||
                  index ===
                    0
                }
                onClick={
                  onMovePrevious
                }
                aria-label="Move media earlier"
                className="inline-flex min-h-9 items-center justify-center rounded-full border border-neutral-800 px-3 text-xs font-semibold text-neutral-400 transition hover:border-neutral-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              >
                ←
              </button>

              <button
                type="button"
                disabled={
                  disabled ||
                  index ===
                    total -
                      1
                }
                onClick={
                  onMoveNext
                }
                aria-label="Move media later"
                className="inline-flex min-h-9 items-center justify-center rounded-full border border-neutral-800 px-3 text-xs font-semibold text-neutral-400 transition hover:border-neutral-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              >
                →
              </button>
            </div>
          </div>

          <form
            action={
              onSave
            }
            className="mt-4 space-y-4"
          >
            <div>
              <label
                htmlFor={`collection-media-caption-${item.id}`}
                className="text-xs font-medium text-neutral-300"
              >
                Caption
              </label>

              <textarea
                id={`collection-media-caption-${item.id}`}
                name="caption"
                rows={2}
                maxLength={
                  CREATOR_COLLECTION_MEDIA_LIMITS
                    .maximumCaptionLength
                }
                defaultValue={
                  item.caption ??
                  ''
                }
                disabled={
                  disabled
                }
                placeholder="Add context to this moment…"
                className={mediaInputClassName}
              />
            </div>

            <div>
              <label
                htmlFor={`collection-media-alt-${item.id}`}
                className="text-xs font-medium text-neutral-300"
              >
                Alt text
              </label>

              <input
                id={`collection-media-alt-${item.id}`}
                name="altText"
                type="text"
                maxLength={
                  CREATOR_COLLECTION_MEDIA_LIMITS
                    .maximumAltTextLength
                }
                defaultValue={
                  item.alt_text ??
                  ''
                }
                disabled={
                  disabled
                }
                placeholder="Describe the image or video for accessibility"
                className={mediaInputClassName}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-800/80 pt-4">
              <button
                type="submit"
                disabled={
                  disabled
                }
                className="inline-flex min-h-9 items-center justify-center rounded-full border border-cyan-500/25 bg-cyan-500/[0.06] px-4 text-xs font-semibold text-cyan-200 transition hover:border-cyan-400/50 hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy
                  ? 'Saving…'
                  : 'Save details'}
              </button>

              <button
                type="button"
                disabled={
                  disabled
                }
                onClick={
                  onDelete
                }
                className="inline-flex min-h-9 items-center justify-center rounded-full px-3 text-xs font-semibold text-red-300 transition hover:bg-red-500/[0.08] hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Remove
              </button>
            </div>
          </form>
        </div>
      </div>
    </article>
  )
}

/* =========================================================
 * Validation
 * ======================================================= */

async function validateCollectionMediaFile(
  file: File
): Promise<string | null> {
  if (
    !isCreatorCollectionMediaMimeType(
      file.type
    )
  ) {
    return 'Choose a JPG, PNG, WEBP, AVIF, MP4, or WEBM file.'
  }

  if (
    file.size <=
    0
  ) {
    return 'That file appears to be empty.'
  }

  const definition =
    getCreatorCollectionMediaDefinition(
      file.type
    )

  if (
    definition.mediaType ===
      'image' &&
    file.size >
      CREATOR_COLLECTION_MEDIA_LIMITS
        .maximumImageBytes
  ) {
    return 'Images must be 15 MB or smaller.'
  }

  if (
    definition.mediaType ===
      'video' &&
    file.size >
      CREATOR_COLLECTION_MEDIA_LIMITS
        .maximumVideoBytes
  ) {
    return 'Videos must be 50 MB or smaller.'
  }

  if (
    definition.mediaType ===
    'video'
  ) {
    try {
      const metadata =
        await loadVideoMetadata(
          file
        )

      if (
        metadata.durationSeconds >
        CREATOR_COLLECTION_MEDIA_LIMITS
          .maximumVideoDurationSeconds
      ) {
        return `Videos must be ${CREATOR_COLLECTION_MEDIA_LIMITS.maximumVideoDurationSeconds} seconds or shorter.`
      }
    } catch {
      return 'That video could not be read. Choose another MP4 or WEBM file.'
    }
  }

  return null
}

/* =========================================================
 * Media metadata
 * ======================================================= */

type MediaMetadata = {
  width:
    | number
    | null
  height:
    | number
    | null
  durationSeconds:
    | number
    | null
}

async function loadMediaMetadata({
  file,
  mimeType,
}: {
  file: File
  mimeType:
    CreatorCollectionMediaMimeType
}): Promise<MediaMetadata> {
  const definition =
    getCreatorCollectionMediaDefinition(
      mimeType
    )

  if (
    definition.mediaType ===
    'image'
  ) {
    const metadata =
      await loadImageMetadata(
        file
      )

    return {
      width:
        metadata.width,

      height:
        metadata.height,

      durationSeconds:
        null,
    }
  }

  const metadata =
    await loadVideoMetadata(
      file
    )

  if (
    metadata.durationSeconds >
    CREATOR_COLLECTION_MEDIA_LIMITS
      .maximumVideoDurationSeconds
  ) {
    throw new Error(
      `Videos must be ${CREATOR_COLLECTION_MEDIA_LIMITS.maximumVideoDurationSeconds} seconds or shorter.`
    )
  }

  return {
    width:
      metadata.width,

    height:
      metadata.height,

    durationSeconds:
      metadata.durationSeconds,
  }
}

function loadImageMetadata(
  file: File
): Promise<{
  width: number
  height: number
}> {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      const objectUrl =
        URL.createObjectURL(
          file
        )

      const image =
        new Image()

      image.onload =
        () => {
          const width =
            image.naturalWidth

          const height =
            image.naturalHeight

          URL.revokeObjectURL(
            objectUrl
          )

          if (
            width <=
              0 ||
            height <=
              0
          ) {
            reject(
              new Error(
                'The image dimensions could not be read.'
              )
            )

            return
          }

          resolve({
            width,
            height,
          })
        }

      image.onerror =
        () => {
          URL.revokeObjectURL(
            objectUrl
          )

          reject(
            new Error(
              'The image could not be read.'
            )
          )
        }

      image.src =
        objectUrl
    }
  )
}

function loadVideoMetadata(
  file: File
): Promise<{
  width: number
  height: number
  durationSeconds: number
}> {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      const objectUrl =
        URL.createObjectURL(
          file
        )

      const video =
        document.createElement(
          'video'
        )

      video.preload =
        'metadata'

      video.onloadedmetadata =
        () => {
          const width =
            video.videoWidth

          const height =
            video.videoHeight

          const durationSeconds =
            video.duration

          URL.revokeObjectURL(
            objectUrl
          )

          video.removeAttribute(
            'src'
          )

          video.load()

          if (
            width <=
              0 ||
            height <=
              0 ||
            !Number.isFinite(
              durationSeconds
            ) ||
            durationSeconds <
              0
          ) {
            reject(
              new Error(
                'The video metadata could not be read.'
              )
            )

            return
          }

          resolve({
            width,
            height,
            durationSeconds,
          })
        }

      video.onerror =
        () => {
          URL.revokeObjectURL(
            objectUrl
          )

          video.removeAttribute(
            'src'
          )

          video.load()

          reject(
            new Error(
              'The video could not be read.'
            )
          )
        }

      video.src =
        objectUrl
    }
  )
}

/* =========================================================
 * Ordering
 * ======================================================= */

function sortMedia(
  media:
    CreatorCollectionMediaRecord[]
): CreatorCollectionMediaRecord[] {
  return [
    ...media,
  ].sort(
    (
      first,
      second
    ) => {
      if (
        first.sort_order !==
        second.sort_order
      ) {
        return (
          first.sort_order -
          second.sort_order
        )
      }

      const createdDifference =
        Date.parse(
          first.created_at
        ) -
        Date.parse(
          second.created_at
        )

      if (
        createdDifference !==
          0 &&
        !Number.isNaN(
          createdDifference
        )
      ) {
        return createdDifference
      }

      return first.id.localeCompare(
        second.id
      )
    }
  )
}

/* =========================================================
 * Display helpers
 * ======================================================= */

function formatDuration(
  durationSeconds: number
): string {
  const totalSeconds =
    Math.max(
      0,
      Math.round(
        durationSeconds
      )
    )

  const minutes =
    Math.floor(
      totalSeconds /
        60
    )

  const seconds =
    totalSeconds %
    60

  return `${minutes}:${seconds
    .toString()
    .padStart(
      2,
      '0'
    )}`
}

const mediaInputClassName = [
  'mt-2 w-full min-w-0 rounded-xl border border-neutral-800 bg-black px-3 py-2.5 text-sm text-white outline-none transition',
  'placeholder:text-neutral-700',
  'focus:border-cyan-500 focus-visible:ring-2 focus-visible:ring-cyan-400/40',
  'disabled:cursor-not-allowed disabled:opacity-50',
].join(' ')

/* =========================================================
 * Errors
 * ======================================================= */

function getErrorMessage(
  error: unknown
): string {
  if (
    error instanceof
      Error &&
    error.message
      .trim()
      .length >
      0
  ) {
    return error.message
  }

  if (
    typeof error ===
      'object' &&
    error !==
      null &&
    'message' in
      error &&
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

    if (message) {
      return message
    }
  }

  return 'The collection media could not be updated. Please try again.'
}