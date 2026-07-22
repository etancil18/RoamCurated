'use client'

import {
  useMemo,
  useState,
  useTransition,
} from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  ImageIcon,
  Loader2,
  Lock,
  Save,
  Sparkles,
} from 'lucide-react'

import {
  createCreatorCollectionAction,
  updateCreatorCollectionAction,
  type CollectionActionFailure,
  type CollectionActionFieldErrors,
  type CreatorCollectionActionRecord,
} from '@/app/profile/creator/collections/actions'

/* =========================================================
 * Public contracts
 * ======================================================= */

export type CollectionFormMode =
  | 'create'
  | 'edit'

export type CollectionFormInitialValue = {
  id: string
  title: string
  slug: string
  description: string | null
  cover_image_url: string | null
  city: string | null
  category: string | null
  visibility: 'public' | 'private'
  featured: boolean
  sort_order: number
  created_at?: string
  updated_at?: string
}

export type CollectionFormProps = {
  /**
   * Determines whether the form creates a new collection or
   * updates an existing collection.
   */
  mode: CollectionFormMode

  /**
   * Required when `mode="edit"`.
   */
  initialCollection?: CollectionFormInitialValue | null

  /**
   * Initial sort order used when creating a collection.
   *
   * The server action still validates and normalizes this value.
   */
  initialSortOrder?: number

  /**
   * Destination used after a successful create.
   *
   * Supported tokens:
   * - `[collectionId]`
   * - `[slug]`
   *
   * Defaults to the newly created collection editor route.
   */
  createSuccessHref?:
    | string
    | null

  /**
   * Destination used after a successful update.
   *
   * When omitted, the current route is refreshed in place.
   */
  updateSuccessHref?:
    | string
    | null

  /**
   * Called after a successful mutation.
   */
  onSuccess?: (
    collection: CreatorCollectionActionRecord
  ) => void

  /**
   * Called when the server action returns a failure.
   */
  onError?: (
    failure: CollectionActionFailure
  ) => void

  /**
   * Optional submit-label override.
   */
  submitLabel?: string

  /**
   * Controls whether visibility controls are shown.
   */
  showVisibility?: boolean

  /**
   * Controls whether the featured toggle is shown.
   */
  showFeatured?: boolean

  /**
   * Controls whether the image preview is rendered.
   */
  showCoverPreview?: boolean

  /**
   * Disables all fields and submission.
   */
  disabled?: boolean

  /**
   * Optional wrapper classes.
   */
  className?: string
}

/* =========================================================
 * Internal state
 * ======================================================= */

type CollectionFormValues = {
  title: string
  description: string
  coverImageUrl: string
  city: string
  category: string
  visibility: 'public' | 'private'
  featured: boolean
  sortOrder: number
}

type FormFeedback =
  | {
      type: 'success'
      message: string
    }
  | {
      type: 'error'
      message: string
    }
  | null

/* =========================================================
 * Main component
 * ======================================================= */

export default function CollectionForm({
  mode,
  initialCollection = null,
  initialSortOrder = 0,
  createSuccessHref = '/profile/creator/collections/[collectionId]',
  updateSuccessHref = null,
  onSuccess,
  onError,
  submitLabel,
  showVisibility = true,
  showFeatured = true,
  showCoverPreview = true,
  disabled = false,
  className = '',
}: CollectionFormProps) {
  const router = useRouter()

  const [
    isPending,
    startTransition,
  ] = useTransition()

  const initialValues =
    useMemo(
      () =>
        buildInitialValues({
          mode,
          collection:
            initialCollection,
          initialSortOrder,
        }),
      [
        mode,
        initialCollection,
        initialSortOrder,
      ]
    )

  const [
    values,
    setValues,
  ] = useState<CollectionFormValues>(
    initialValues
  )

  const [
    fieldErrors,
    setFieldErrors,
  ] = useState<
    CollectionActionFieldErrors
  >({})

  const [
    feedback,
    setFeedback,
  ] = useState<FormFeedback>(null)

  const [
    submittedCollection,
    setSubmittedCollection,
  ] = useState<
    CreatorCollectionActionRecord | null
  >(null)

  const normalizedCoverPreview =
    useMemo(
      () =>
        normalizePreviewImageUrl(
          values.coverImageUrl
        ),
      [values.coverImageUrl]
    )

  const isEditMode =
    mode === 'edit'

  const isDisabled =
    disabled || isPending

  const resolvedSubmitLabel =
    submitLabel ??
    (isEditMode
      ? 'Save Changes'
      : 'Create Collection')

  const hasUnsavedChanges =
    !areCollectionValuesEqual(
      values,
      initialValues
    )

  function updateValue<
    Key extends keyof CollectionFormValues,
  >(
    key: Key,
    value: CollectionFormValues[Key]
  ) {
    setValues((current) => ({
      ...current,
      [key]: value,
    }))

    clearFieldError(
      keyToActionField(key)
    )

    if (feedback?.type === 'error') {
      setFeedback(null)
    }
  }

  function clearFieldError(
    field:
      | keyof CollectionActionFieldErrors
      | null
  ) {
    if (!field) {
      return
    }

    setFieldErrors((current) => {
      if (!current[field]) {
        return current
      }

      const next = {
        ...current,
      }

      delete next[field]

      return next
    })
  }

  function resetForm() {
    setValues(initialValues)
    setFieldErrors({})
    setFeedback(null)
    setSubmittedCollection(null)
  }

  function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (isDisabled) {
      return
    }

    setFieldErrors({})
    setFeedback(null)

    const clientValidation =
      validateCollectionForm({
        values,
        mode,
        collection:
          initialCollection,
      })

    if (!clientValidation.valid) {
      setFieldErrors(
        clientValidation.fieldErrors
      )

      setFeedback({
        type: 'error',
        message:
          clientValidation.message,
      })

      return
    }

    startTransition(() => {
      void submitCollection({
        mode,
        values,
        initialCollection,
      })
        .then((result) => {
          if (!result.success) {
            setFieldErrors(
              result.fieldErrors ?? {}
            )

            setFeedback({
              type: 'error',
              message:
                normalizeFeedbackMessage(
                  result.error
                ) ??
                'The collection could not be saved.',
            })

            onError?.(result)

            focusFirstInvalidField(
              result.fieldErrors
            )

            return
          }

          const collection =
            result.data.collection

          setSubmittedCollection(
            collection
          )

          setValues(
            collectionToFormValues(
              collection
            )
          )

          setFieldErrors({})

          setFeedback({
            type: 'success',
            message:
              isEditMode
                ? 'Collection updated successfully.'
                : 'Collection created successfully.',
          })

          onSuccess?.(collection)

          if (isEditMode) {
            if (updateSuccessHref) {
              router.push(
                resolveSuccessHref({
                  template:
                    updateSuccessHref,
                  collection,
                })
              )

              return
            }

            router.refresh()
            return
          }

          if (createSuccessHref) {
            router.push(
              resolveSuccessHref({
                template:
                  createSuccessHref,
                collection,
              })
            )

            return
          }

          router.refresh()
        })
        .catch((error: unknown) => {
          console.error(
            '[CollectionForm] Collection submission failed:',
            error
          )

          const failure:
            CollectionActionFailure = {
            success: false,
            error:
              'The collection could not be saved. Refresh the page and try again.',
          }

          setFeedback({
            type: 'error',
            message: failure.error,
          })

          onError?.(failure)
        })
    })
  }

  if (
    mode === 'edit' &&
    !initialCollection
  ) {
    return (
      <InvalidEditState
        className={className}
      />
    )
  }

  return (
    <section
      aria-labelledby="creator-collection-form-title"
      className={[
        'w-full min-w-0 overflow-hidden rounded-[1.75rem] border border-neutral-800/90 bg-neutral-950/75 text-white shadow-2xl shadow-black/20',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <CollectionFormHeader
        mode={mode}
        collection={
          submittedCollection ??
          initialCollection
        }
        hasUnsavedChanges={
          hasUnsavedChanges
        }
      />

      <form
        noValidate
        onSubmit={handleSubmit}
        className="min-w-0"
      >
        <fieldset
          disabled={isDisabled}
          className="min-w-0 disabled:opacity-75"
        >
          <div
            className={[
              'grid min-w-0 gap-6 p-4 sm:p-5',
              showCoverPreview
                ? 'lg:grid-cols-[minmax(0,1fr)_280px]'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="min-w-0 space-y-5">
              <CollectionTextFields
                values={values}
                fieldErrors={
                  fieldErrors
                }
                onChange={
                  updateValue
                }
              />

              {showVisibility ? (
                <CollectionVisibilityField
                  value={
                    values.visibility
                  }
                  error={
                    firstFieldError(
                      fieldErrors.visibility
                    )
                  }
                  onChange={(
                    visibility
                  ) =>
                    updateValue(
                      'visibility',
                      visibility
                    )
                  }
                />
              ) : null}

              {showFeatured ? (
                <CollectionFeaturedField
                  checked={
                    values.featured
                  }
                  disabled={
                    isDisabled
                  }
                  error={
                    firstFieldError(
                      fieldErrors.featured
                    )
                  }
                  onChange={(
                    featured
                  ) =>
                    updateValue(
                      'featured',
                      featured
                    )
                  }
                />
              ) : null}

              <input
                type="hidden"
                name="sort_order"
                value={
                  values.sortOrder
                }
              />
            </div>

            {showCoverPreview ? (
              <CollectionCoverPreview
                title={values.title}
                city={values.city}
                imageUrl={
                  normalizedCoverPreview
                }
                rawImageUrl={
                  values.coverImageUrl
                }
              />
            ) : null}
          </div>

          <CollectionFormFooter
            mode={mode}
            feedback={feedback}
            isPending={isPending}
            disabled={disabled}
            hasUnsavedChanges={
              hasUnsavedChanges
            }
            submitLabel={
              resolvedSubmitLabel
            }
            onReset={resetForm}
          />
        </fieldset>
      </form>
    </section>
  )
}

/* =========================================================
 * Header
 * ======================================================= */

function CollectionFormHeader({
  mode,
  collection,
  hasUnsavedChanges,
}: {
  mode: CollectionFormMode
  collection:
    | CollectionFormInitialValue
    | CreatorCollectionActionRecord
    | null
  hasUnsavedChanges: boolean
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4 border-b border-neutral-800/80 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">
          {mode === 'edit'
            ? 'Collection editor'
            : 'New collection'}
        </p>

        <h2
          id="creator-collection-form-title"
          className="mt-1 break-words text-lg font-semibold text-white"
        >
          {mode === 'edit'
            ? 'Edit collection details'
            : 'Define your collection'}
        </h2>

        <p className="mt-1 max-w-2xl text-xs leading-5 text-neutral-500">
          {mode === 'edit'
            ? 'Update the collection identity and public presentation. The existing URL slug remains unchanged.'
            : 'Create a focused collection. You can add and organize its contents after creation.'}
        </p>

        {mode === 'edit' &&
        collection?.slug ? (
          <p className="mt-2 break-all text-xs text-neutral-700">
            /{collection.slug}
          </p>
        ) : null}
      </div>

      <span
        className={[
          'inline-flex w-fit shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold',
          hasUnsavedChanges
            ? 'border-amber-500/25 bg-amber-500/[0.07] text-amber-200'
            : 'border-neutral-800 bg-black/30 text-neutral-500',
        ].join(' ')}
      >
        <span
          aria-hidden="true"
          className={[
            'h-2 w-2 rounded-full',
            hasUnsavedChanges
              ? 'bg-amber-400'
              : 'bg-neutral-700',
          ].join(' ')}
        />

        {hasUnsavedChanges
          ? 'Unsaved changes'
          : 'No changes'}
      </span>
    </div>
  )
}

/* =========================================================
 * Text fields
 * ======================================================= */

function CollectionTextFields({
  values,
  fieldErrors,
  onChange,
}: {
  values: CollectionFormValues
  fieldErrors:
    CollectionActionFieldErrors
  onChange: <
    Key extends keyof CollectionFormValues,
  >(
    key: Key,
    value: CollectionFormValues[Key]
  ) => void
}) {
  return (
    <>
      <FormField
        id="creator-collection-title"
        label="Title"
        required
        error={firstFieldError(
          fieldErrors.title
        )}
        description="Use a specific title that communicates the collection’s purpose."
      >
        <input
          id="creator-collection-title"
          name="title"
          type="text"
          required
          autoComplete="off"
          maxLength={160}
          value={values.title}
          onChange={(event) =>
            onChange(
              'title',
              event.target.value
            )
          }
          aria-invalid={
            Boolean(
              fieldErrors.title?.length
            )
          }
          aria-describedby={
            getFieldDescriptionIds({
              id:
                'creator-collection-title',
              hasDescription: true,
              hasError: Boolean(
                fieldErrors.title?.length
              ),
            })
          }
          placeholder="Chicago Date Night"
          className={inputClassName}
        />
      </FormField>

      <FormField
        id="creator-collection-description"
        label="Description"
        error={firstFieldError(
          fieldErrors.description
        )}
        description="Explain what the collection contains and why someone should explore it."
      >
        <textarea
          id="creator-collection-description"
          name="description"
          rows={5}
          maxLength={1000}
          value={
            values.description
          }
          onChange={(event) =>
            onChange(
              'description',
              event.target.value
            )
          }
          aria-invalid={
            Boolean(
              fieldErrors.description
                ?.length
            )
          }
          aria-describedby={
            getFieldDescriptionIds({
              id:
                'creator-collection-description',
              hasDescription: true,
              hasError: Boolean(
                fieldErrors.description
                  ?.length
              ),
            })
          }
          placeholder="A curated route through intimate restaurants, cocktail bars, and late-night stops."
          className={`${inputClassName} resize-y leading-6`}
        />

        <CharacterCounter
          current={
            values.description.length
          }
          maximum={1000}
        />
      </FormField>

      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <FormField
          id="creator-collection-city"
          label="City"
          error={firstFieldError(
            fieldErrors.city
          )}
        >
          <input
            id="creator-collection-city"
            name="city"
            type="text"
            autoComplete="address-level2"
            maxLength={160}
            value={values.city}
            onChange={(event) =>
              onChange(
                'city',
                event.target.value
              )
            }
            aria-invalid={
              Boolean(
                fieldErrors.city?.length
              )
            }
            aria-describedby={
              fieldErrors.city?.length
                ? 'creator-collection-city-error'
                : undefined
            }
            placeholder="Chicago"
            className={inputClassName}
          />
        </FormField>

        <FormField
          id="creator-collection-category"
          label="Category"
          error={firstFieldError(
            fieldErrors.category
          )}
        >
          <input
            id="creator-collection-category"
            name="category"
            type="text"
            autoComplete="off"
            maxLength={120}
            value={values.category}
            onChange={(event) =>
              onChange(
                'category',
                event.target.value
              )
            }
            aria-invalid={
              Boolean(
                fieldErrors.category
                  ?.length
              )
            }
            aria-describedby={
              fieldErrors.category
                ?.length
                ? 'creator-collection-category-error'
                : undefined
            }
            placeholder="Date Night"
            className={inputClassName}
          />
        </FormField>
      </div>

      <FormField
        id="creator-collection-cover-image"
        label="Cover image URL"
        error={firstFieldError(
          fieldErrors.cover_image_url
        )}
        description="Use a public http:// or https:// image URL. Local and private-network URLs are rejected by the server."
      >
        <input
          id="creator-collection-cover-image"
          name="cover_image_url"
          type="url"
          inputMode="url"
          autoComplete="url"
          maxLength={2048}
          value={
            values.coverImageUrl
          }
          onChange={(event) =>
            onChange(
              'coverImageUrl',
              event.target.value
            )
          }
          aria-invalid={
            Boolean(
              fieldErrors.cover_image_url
                ?.length
            )
          }
          aria-describedby={
            getFieldDescriptionIds({
              id:
                'creator-collection-cover-image',
              hasDescription: true,
              hasError: Boolean(
                fieldErrors.cover_image_url
                  ?.length
              ),
            })
          }
          placeholder="https://example.com/collection-cover.jpg"
          className={inputClassName}
        />
      </FormField>
    </>
  )
}

/* =========================================================
 * Visibility
 * ======================================================= */

function CollectionVisibilityField({
  value,
  error,
  onChange,
}: {
  value: 'public' | 'private'
  error?: string
  onChange: (
    value: 'public' | 'private'
  ) => void
}) {
  return (
    <fieldset
      aria-invalid={Boolean(error)}
      aria-describedby={
        error
          ? 'creator-collection-visibility-error'
          : 'creator-collection-visibility-description'
      }
      className="min-w-0"
    >
      <legend className="text-sm font-medium text-neutral-200">
        Visibility
      </legend>

      <p
        id="creator-collection-visibility-description"
        className="mt-1 text-xs leading-5 text-neutral-600"
      >
        Private is the safest default.
        Public collections can appear on
        your creator profile.
      </p>

      <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
        <label
          className={[
            'flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition',
            value === 'private'
              ? 'border-cyan-500/35 bg-cyan-500/[0.06]'
              : 'border-neutral-800 bg-black/30 hover:border-neutral-600',
          ].join(' ')}
        >
          <input
            type="radio"
            name="visibility"
            value="private"
            checked={
              value === 'private'
            }
            onChange={() =>
              onChange('private')
            }
            className="mt-0.5 h-4 w-4 shrink-0 accent-cyan-400"
          />

          <span className="min-w-0">
            <span className="flex items-center gap-2 text-sm font-semibold text-white">
              <Lock
                aria-hidden="true"
                className="h-4 w-4 text-neutral-400"
              />

              Private
            </span>

            <span className="mt-1 block text-xs leading-5 text-neutral-500">
              Visible only inside your
              creator collection manager.
            </span>
          </span>
        </label>

        <label
          className={[
            'flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition',
            value === 'public'
              ? 'border-emerald-500/35 bg-emerald-500/[0.06]'
              : 'border-neutral-800 bg-black/30 hover:border-neutral-600',
          ].join(' ')}
        >
          <input
            type="radio"
            name="visibility"
            value="public"
            checked={
              value === 'public'
            }
            onChange={() =>
              onChange('public')
            }
            className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-400"
          />

          <span className="min-w-0">
            <span className="flex items-center gap-2 text-sm font-semibold text-white">
              <Eye
                aria-hidden="true"
                className="h-4 w-4 text-emerald-400"
              />

              Public
            </span>

            <span className="mt-1 block text-xs leading-5 text-neutral-500">
              Eligible for public profile
              and collection routes.
            </span>
          </span>
        </label>
      </div>

      {error ? (
        <p
          id="creator-collection-visibility-error"
          className="mt-2 text-xs leading-5 text-red-300"
        >
          {error}
        </p>
      ) : null}
    </fieldset>
  )
}

/* =========================================================
 * Featured
 * ======================================================= */

function CollectionFeaturedField({
  checked,
  disabled,
  error,
  onChange,
}: {
  checked: boolean
  disabled: boolean
  error?: string
  onChange: (
    checked: boolean
  ) => void
}) {
  return (
    <div>
      <label
        className={[
          'flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition',
          checked
            ? 'border-indigo-500/35 bg-indigo-500/[0.07]'
            : 'border-neutral-800 bg-black/30 hover:border-indigo-500/30',
          disabled
            ? 'cursor-not-allowed'
            : '',
        ].join(' ')}
      >
        <input
          type="checkbox"
          name="featured"
          checked={checked}
          disabled={disabled}
          onChange={(event) =>
            onChange(
              event.target.checked
            )
          }
          aria-invalid={
            Boolean(error)
          }
          aria-describedby={
            error
              ? 'creator-collection-featured-error'
              : 'creator-collection-featured-description'
          }
          className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-400"
        />

        <span className="min-w-0">
          <span className="flex items-center gap-2 text-sm font-semibold text-white">
            <Sparkles
              aria-hidden="true"
              className="h-4 w-4 text-indigo-300"
            />

            Feature this collection
          </span>

          <span
            id="creator-collection-featured-description"
            className="mt-1 block text-xs leading-5 text-neutral-500"
          >
            Featured public collections
            receive priority on your
            creator profile. Private
            collections remain hidden.
          </span>
        </span>
      </label>

      {error ? (
        <p
          id="creator-collection-featured-error"
          className="mt-2 text-xs leading-5 text-red-300"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}

/* =========================================================
 * Cover preview
 * ======================================================= */

function CollectionCoverPreview({
  title,
  city,
  imageUrl,
  rawImageUrl,
}: {
  title: string
  city: string
  imageUrl: string | null
  rawImageUrl: string
}) {
  const hasInvalidPreviewUrl =
    rawImageUrl.trim().length > 0 &&
    imageUrl === null

  return (
    <aside className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
        Cover preview
      </p>

      <div className="mt-3 overflow-hidden rounded-2xl border border-neutral-800 bg-black/30">
        <div className="relative aspect-[4/3] overflow-hidden bg-neutral-900">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              className="h-full w-full object-cover"
              onError={(event) => {
                event.currentTarget.style.display =
                  'none'
              }}
            />
          ) : (
            <CollectionCoverFallback />
          )}

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent"
          />

          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/65 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur-md">
            <Sparkles
              aria-hidden="true"
              className="h-3 w-3 text-indigo-300"
            />

            Collection
          </span>
        </div>

        <div className="p-4">
          <p className="line-clamp-2 break-words text-sm font-semibold text-white">
            {normalizeNullableText(
              title
            ) ?? 'Untitled collection'}
          </p>

          <p className="mt-1 truncate text-xs text-neutral-500">
            {normalizeNullableText(
              city
            ) ?? 'City not specified'}
          </p>
        </div>
      </div>

      {hasInvalidPreviewUrl ? (
        <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-amber-300/80">
          <AlertCircle
            aria-hidden="true"
            className="mt-0.5 h-3.5 w-3.5 shrink-0"
          />

          Enter a valid public http:// or
          https:// image URL to display a
          preview.
        </p>
      ) : (
        <p className="mt-3 text-xs leading-5 text-neutral-600">
          The preview is visual only. The
          server action performs the final
          URL validation.
        </p>
      )}
    </aside>
  )
}

function CollectionCoverFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.25),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(6,182,212,0.18),transparent_42%),#09090b]">
      <div className="text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/25 text-neutral-400">
          <ImageIcon
            aria-hidden="true"
            className="h-5 w-5"
          />
        </span>

        <p className="mt-3 text-xs font-medium text-neutral-600">
          No cover image
        </p>
      </div>
    </div>
  )
}

/* =========================================================
 * Footer
 * ======================================================= */

function CollectionFormFooter({
  mode,
  feedback,
  isPending,
  disabled,
  hasUnsavedChanges,
  submitLabel,
  onReset,
}: {
  mode: CollectionFormMode
  feedback: FormFeedback
  isPending: boolean
  disabled: boolean
  hasUnsavedChanges: boolean
  submitLabel: string
  onReset: () => void
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4 border-t border-neutral-800/80 bg-black/15 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div
        aria-live="polite"
        className="min-w-0 flex-1"
      >
        {feedback ? (
          <FormFeedbackMessage
            feedback={feedback}
          />
        ) : (
          <p className="text-xs leading-5 text-neutral-600">
            {mode === 'edit'
              ? 'Saving preserves the existing collection URL slug.'
              : 'New collections use the title to generate their initial URL slug.'}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row">
        <button
          type="button"
          disabled={
            disabled ||
            isPending ||
            !hasUnsavedChanges
          }
          onClick={onReset}
          className="inline-flex items-center justify-center rounded-full border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm font-medium text-neutral-300 transition hover:border-neutral-600 hover:bg-neutral-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Reset
        </button>

        <button
          type="submit"
          disabled={
            disabled || isPending
          }
          className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? (
            <Loader2
              aria-hidden="true"
              className="h-4 w-4 animate-spin"
            />
          ) : (
            <Save
              aria-hidden="true"
              className="h-4 w-4"
            />
          )}

          {isPending
            ? 'Saving…'
            : submitLabel}
        </button>
      </div>
    </div>
  )
}

function FormFeedbackMessage({
  feedback,
}: {
  feedback: Exclude<
    FormFeedback,
    null
  >
}) {
  const isError =
    feedback.type === 'error'

  return (
    <div
      role={
        isError
          ? 'alert'
          : 'status'
      }
      className={[
        'flex min-w-0 items-start gap-2 text-xs leading-5',
        isError
          ? 'text-red-300'
          : 'text-emerald-300',
      ].join(' ')}
    >
      {isError ? (
        <AlertCircle
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 shrink-0"
        />
      ) : (
        <CheckCircle2
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 shrink-0"
        />
      )}

      <span className="break-words">
        {feedback.message}
      </span>
    </div>
  )
}

/* =========================================================
 * Generic form field
 * ======================================================= */

function FormField({
  id,
  label,
  required = false,
  description,
  error,
  children,
}: {
  id: string
  label: string
  required?: boolean
  description?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className="text-sm font-medium text-neutral-200"
      >
        {label}

        {required ? (
          <span className="text-cyan-400">
            {' '}
            *
          </span>
        ) : null}
      </label>

      <div className="mt-2">
        {children}
      </div>

      {description ? (
        <p
          id={`${id}-description`}
          className="mt-1.5 text-xs leading-5 text-neutral-600"
        >
          {description}
        </p>
      ) : null}

      {error ? (
        <p
          id={`${id}-error`}
          className="mt-1.5 text-xs leading-5 text-red-300"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}

function CharacterCounter({
  current,
  maximum,
}: {
  current: number
  maximum: number
}) {
  const nearingLimit =
    current >= maximum * 0.9

  return (
    <p
      className={[
        'mt-1.5 text-right text-[11px]',
        nearingLimit
          ? 'text-amber-300'
          : 'text-neutral-700',
      ].join(' ')}
    >
      {current.toLocaleString()}
      {' / '}
      {maximum.toLocaleString()}
    </p>
  )
}

/* =========================================================
 * Invalid state
 * ======================================================= */

function InvalidEditState({
  className,
}: {
  className: string
}) {
  return (
    <section
      role="alert"
      className={[
        'w-full min-w-0 rounded-[1.75rem] border border-red-500/30 bg-red-500/10 p-5 text-white',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex items-start gap-3">
        <AlertCircle
          aria-hidden="true"
          className="mt-0.5 h-5 w-5 shrink-0 text-red-300"
        />

        <div className="min-w-0">
          <h2 className="text-base font-semibold text-red-100">
            Collection data missing
          </h2>

          <p className="mt-1 text-sm leading-6 text-red-200/75">
            Edit mode requires a valid
            initial collection. The form
            has not been rendered to
            prevent an accidental create
            or malformed update.
          </p>
        </div>
      </div>
    </section>
  )
}

/* =========================================================
 * Action submission
 * ======================================================= */

async function submitCollection({
  mode,
  values,
  initialCollection,
}: {
  mode: CollectionFormMode
  values: CollectionFormValues
  initialCollection:
    | CollectionFormInitialValue
    | null
}) {
  if (mode === 'create') {
    return createCreatorCollectionAction({
      title: values.title,
      description:
        emptyStringToNull(
          values.description
        ),
      cover_image_url:
        emptyStringToNull(
          values.coverImageUrl
        ),
      city:
        emptyStringToNull(
          values.city
        ),
      category:
        emptyStringToNull(
          values.category
        ),
      visibility:
        values.visibility,
      featured:
        values.featured,
      sort_order:
        values.sortOrder,
    })
  }

  if (!initialCollection) {
    const failure:
      CollectionActionFailure = {
      success: false,
      error:
        'The collection could not be updated because its identifier is missing.',
      fieldErrors: {
        collectionId: [
          'Collection ID is required.',
        ],
      },
    }

    return failure
  }

  return updateCreatorCollectionAction({
    collectionId:
      initialCollection.id,
    title: values.title,
    description:
      emptyStringToNull(
        values.description
      ),
    cover_image_url:
      emptyStringToNull(
        values.coverImageUrl
      ),
    city:
      emptyStringToNull(
        values.city
      ),
    category:
      emptyStringToNull(
        values.category
      ),
    visibility:
      values.visibility,
    featured:
      values.featured,
    sort_order:
      values.sortOrder,
  })
}

/* =========================================================
 * Client validation
 * ======================================================= */

type ClientValidationResult =
  | {
      valid: true
    }
  | {
      valid: false
      message: string
      fieldErrors:
        CollectionActionFieldErrors
    }

function validateCollectionForm({
  values,
  mode,
  collection,
}: {
  values: CollectionFormValues
  mode: CollectionFormMode
  collection:
    | CollectionFormInitialValue
    | null
}): ClientValidationResult {
  const errors:
    CollectionActionFieldErrors = {}

  const normalizedTitle =
    normalizeNullableText(
      values.title
    )

  if (!normalizedTitle) {
    errors.title = [
      'Collection title is required.',
    ]
  } else if (
    normalizedTitle.length > 160
  ) {
    errors.title = [
      'Collection title must be 160 characters or fewer.',
    ]
  }

  if (
    values.description.length > 1000
  ) {
    errors.description = [
      'Description must be 1,000 characters or fewer.',
    ]
  }

  if (
    values.city.length > 160
  ) {
    errors.city = [
      'City must be 160 characters or fewer.',
    ]
  }

  if (
    values.category.length > 120
  ) {
    errors.category = [
      'Category must be 120 characters or fewer.',
    ]
  }

  if (
    values.coverImageUrl.length > 2048
  ) {
    errors.cover_image_url = [
      'Cover image URL must be 2,048 characters or fewer.',
    ]
  } else if (
    values.coverImageUrl.trim() &&
    !normalizePreviewImageUrl(
      values.coverImageUrl
    )
  ) {
    errors.cover_image_url = [
      'Enter a valid public http:// or https:// image URL.',
    ]
  }

  if (
    !Number.isInteger(
      values.sortOrder
    ) ||
    values.sortOrder < 0
  ) {
    errors.sort_order = [
      'Sort order must be a non-negative whole number.',
    ]
  }

  if (
    mode === 'edit' &&
    !collection?.id
  ) {
    errors.collectionId = [
      'Collection ID is required.',
    ]
  }

  if (
    Object.keys(errors).length >
    0
  ) {
    return {
      valid: false,
      message:
        getFirstFieldError(
          errors
        ) ??
        'One or more collection fields are invalid.',
      fieldErrors: errors,
    }
  }

  return {
    valid: true,
  }
}

/* =========================================================
 * Initial values
 * ======================================================= */

function buildInitialValues({
  mode,
  collection,
  initialSortOrder,
}: {
  mode: CollectionFormMode
  collection:
    | CollectionFormInitialValue
    | null
  initialSortOrder: number
}): CollectionFormValues {
  if (
    mode === 'edit' &&
    collection
  ) {
    return {
      title:
        collection.title ?? '',
      description:
        collection.description ?? '',
      coverImageUrl:
        collection.cover_image_url ??
        '',
      city:
        collection.city ?? '',
      category:
        collection.category ?? '',
      visibility:
        collection.visibility,
      featured:
        collection.featured === true,
      sortOrder:
        normalizeSortOrder(
          collection.sort_order
        ),
    }
  }

  return {
    title: '',
    description: '',
    coverImageUrl: '',
    city: '',
    category: '',
    visibility: 'private',
    featured: false,
    sortOrder:
      normalizeSortOrder(
        initialSortOrder
      ),
  }
}

function collectionToFormValues(
  collection:
    CreatorCollectionActionRecord
): CollectionFormValues {
  return {
    title: collection.title,
    description:
      collection.description ?? '',
    coverImageUrl:
      collection.cover_image_url ??
      '',
    city:
      collection.city ?? '',
    category:
      collection.category ?? '',
    visibility:
      collection.visibility,
    featured:
      collection.featured,
    sortOrder:
      collection.sort_order,
  }
}

/* =========================================================
 * Navigation
 * ======================================================= */

function resolveSuccessHref({
  template,
  collection,
}: {
  template: string
  collection:
    CreatorCollectionActionRecord
}): string {
  const normalized =
    normalizeInternalHref(template)

  if (!normalized) {
    return '/profile/creator/collections'
  }

  return normalized
    .replace(
      /\[collectionId\]/g,
      encodeURIComponent(
        collection.id
      )
    )
    .replace(
      /\[slug\]/g,
      encodeURIComponent(
        collection.slug
      )
    )
}

function normalizeInternalHref(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized =
    value.trim()

  if (
    !normalized ||
    !normalized.startsWith('/') ||
    normalized.startsWith('//') ||
    normalized.includes('\\') ||
    /[\r\n]/.test(normalized)
  ) {
    return null
  }

  return normalized
}

/* =========================================================
 * Field-error helpers
 * ======================================================= */

function getFirstFieldError(
  fieldErrors:
    CollectionActionFieldErrors
): string | null {
  const preferredOrder: Array<
    keyof CollectionActionFieldErrors
  > = [
    'collectionId',
    'title',
    'description',
    'cover_image_url',
    'city',
    'category',
    'visibility',
    'featured',
    'sort_order',
  ]

  for (
    const field of preferredOrder
  ) {
    const message =
      firstFieldError(
        fieldErrors[field]
      )

    if (message) {
      return message
    }
  }

  return null
}

function firstFieldError(
  messages:
    | string[]
    | undefined
): string | undefined {
  if (!Array.isArray(messages)) {
    return undefined
  }

  return messages.find(
    (message) =>
      typeof message === 'string' &&
      message.trim().length > 0
  )
}

function focusFirstInvalidField(
  errors:
    | CollectionActionFieldErrors
    | undefined
) {
  if (!errors) {
    return
  }

  const selectors: Partial<
    Record<
      keyof CollectionActionFieldErrors,
      string
    >
  > = {
    title:
      '#creator-collection-title',
    description:
      '#creator-collection-description',
    cover_image_url:
      '#creator-collection-cover-image',
    city:
      '#creator-collection-city',
    category:
      '#creator-collection-category',
    visibility:
      'input[name="visibility"]',
    featured:
      'input[name="featured"]',
  }

  const order: Array<
    keyof CollectionActionFieldErrors
  > = [
    'title',
    'description',
    'cover_image_url',
    'city',
    'category',
    'visibility',
    'featured',
  ]

  for (const field of order) {
    if (!errors[field]?.length) {
      continue
    }

    const selector =
      selectors[field]

    if (!selector) {
      continue
    }

    const element =
      document.querySelector<
        HTMLElement
      >(selector)

    element?.focus()

    break
  }
}

function keyToActionField(
  key: keyof CollectionFormValues
):
  | keyof CollectionActionFieldErrors
  | null {
  switch (key) {
    case 'title':
      return 'title'

    case 'description':
      return 'description'

    case 'coverImageUrl':
      return 'cover_image_url'

    case 'city':
      return 'city'

    case 'category':
      return 'category'

    case 'visibility':
      return 'visibility'

    case 'featured':
      return 'featured'

    case 'sortOrder':
      return 'sort_order'
  }
}

/* =========================================================
 * Primitive helpers
 * ======================================================= */

const inputClassName = [
  'w-full min-w-0 rounded-xl border border-neutral-800 bg-black px-3 py-2.5 text-sm text-white outline-none transition',
  'placeholder:text-neutral-700',
  'focus:border-cyan-500 focus-visible:ring-2 focus-visible:ring-cyan-400/40',
  'aria-[invalid=true]:border-red-500/60 aria-[invalid=true]:focus-visible:ring-red-400/30',
  'disabled:cursor-not-allowed disabled:opacity-60',
].join(' ')

function getFieldDescriptionIds({
  id,
  hasDescription,
  hasError,
}: {
  id: string
  hasDescription: boolean
  hasError: boolean
}): string | undefined {
  const ids: string[] = []

  if (hasDescription) {
    ids.push(`${id}-description`)
  }

  if (hasError) {
    ids.push(`${id}-error`)
  }

  return ids.length > 0
    ? ids.join(' ')
    : undefined
}

function areCollectionValuesEqual(
  first: CollectionFormValues,
  second: CollectionFormValues
): boolean {
  return (
    first.title === second.title &&
    first.description ===
      second.description &&
    first.coverImageUrl ===
      second.coverImageUrl &&
    first.city === second.city &&
    first.category ===
      second.category &&
    first.visibility ===
      second.visibility &&
    first.featured ===
      second.featured &&
    first.sortOrder ===
      second.sortOrder
  )
}

function normalizeSortOrder(
  value: unknown
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value)
  ) {
    return 0
  }

  return Math.max(
    0,
    Math.trunc(value)
  )
}

function normalizePreviewImageUrl(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized =
    value.trim()

  if (!normalized) {
    return null
  }

  try {
    const parsed =
      new URL(normalized)

    if (
      parsed.protocol !== 'https:' &&
      parsed.protocol !== 'http:'
    ) {
      return null
    }

    if (
      parsed.username ||
      parsed.password ||
      !parsed.hostname
    ) {
      return null
    }

    if (
      isLocalOrPrivateHostname(
        parsed.hostname
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

function isLocalOrPrivateHostname(
  hostname: string
): boolean {
  const normalized = hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '')

  if (
    !normalized ||
    normalized === 'localhost' ||
    normalized.endsWith(
      '.localhost'
    ) ||
    normalized.endsWith('.local')
  ) {
    return true
  }

  if (
    /^10\./.test(normalized) ||
    /^127\./.test(normalized) ||
    /^169\.254\./.test(
      normalized
    ) ||
    /^192\.168\./.test(
      normalized
    ) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(
      normalized
    )
  ) {
    return true
  }

  if (
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80')
  ) {
    return true
  }

  return false
}

function emptyStringToNull(
  value: string
): string | null {
  const normalized =
    value.trim()

  return normalized.length > 0
    ? normalized
    : null
}

function normalizeNullableText(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value
    .trim()
    .replace(/\s+/g, ' ')

  return normalized.length > 0
    ? normalized
    : null
}

function normalizeFeedbackMessage(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 300)

  return normalized.length > 0
    ? normalized
    : null
}