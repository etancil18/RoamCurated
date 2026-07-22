'use client'

import {
  useMemo,
  useState,
  useTransition,
  type FormEvent,
} from 'react'
import { useRouter } from 'next/navigation'
import {
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  GripVertical,
  Link2,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react'

import {
  saveCreatorSettingsAction,
  type SaveCreatorSettingsResult,
} from '@/app/profile/creator/actions'

import {
  COLLABORATION_CATEGORY_OPTIONS,
  CREATOR_FIELD_LIMITS,
  CREATOR_MODE_DEFAULTS,
  CREATOR_SOCIAL_PLATFORM_DEFINITIONS,
  CREATOR_SOCIAL_PLATFORM_OPTIONS,
} from '@/lib/creator/constants'

import type {
  CollaborationTag,
  CollaborationTagCategory,
  CreatorSettingsData,
  CreatorSocialLinkInput,
  CreatorSocialPlatform,
} from '@/lib/creator/types'

/* =========================================================
 * Public component contract
 * ======================================================= */

type Props = {
  settings: CreatorSettingsData
}

type EditableSocialLink = CreatorSocialLinkInput & {
  clientId: string
}

type FormFieldErrors = NonNullable<
  Extract<
    SaveCreatorSettingsResult,
    { success: false }
  >['fieldErrors']
>

/* =========================================================
 * Main form
 * ======================================================= */

export default function CreatorModeForm({
  settings,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] =
    useTransition()

  const creatorProfile = settings.creatorProfile

  const [creatorModeEnabled, setCreatorModeEnabled] =
    useState(
      settings.baseProfile.creator_mode_enabled === true
    )

  const [creatorHeadline, setCreatorHeadline] =
    useState(
      settings.baseProfile.creator_headline ?? ''
    )

  const [creatorBio, setCreatorBio] =
    useState(creatorProfile?.creator_bio ?? '')

  const [primaryCity, setPrimaryCity] =
    useState(creatorProfile?.primary_city ?? '')

  const [
    availableForTravel,
    setAvailableForTravel,
  ] = useState(
    creatorProfile?.available_for_travel ??
      CREATOR_MODE_DEFAULTS.availableForTravel
  )

  const [
    acceptingCollaborations,
    setAcceptingCollaborations,
  ] = useState(
    creatorProfile?.accepting_collaborations ??
      CREATOR_MODE_DEFAULTS.acceptingCollaborations
  )

  const [publicEmail, setPublicEmail] =
    useState(creatorProfile?.public_email ?? '')

  const [socialLinks, setSocialLinks] = useState<
    EditableSocialLink[]
  >(() =>
    settings.socialLinks.map((link, index) => ({
      id: link.id,
      platform: link.platform,
      url: link.url,
      handle: link.handle,
      sort_order: index,
      is_public: link.is_public,
      clientId: link.id,
    }))
  )

  const [
    selectedCollaborationTagIds,
    setSelectedCollaborationTagIds,
  ] = useState<number[]>(
    settings.selectedTagIds
  )

  const [result, setResult] =
    useState<SaveCreatorSettingsResult | null>(
      null
    )

  const [showDisableConfirmation, setShowDisableConfirmation] =
    useState(false)

  const selectedTagIdSet = useMemo(
    () =>
      new Set(selectedCollaborationTagIds),
    [selectedCollaborationTagIds]
  )

  const availableSocialPlatforms =
    useMemo(() => {
      const usedPlatforms = new Set(
        socialLinks.map(
          (link) => link.platform
        )
      )

      return CREATOR_SOCIAL_PLATFORM_OPTIONS.filter(
        (option) =>
          !usedPlatforms.has(option.value)
      )
    }, [socialLinks])

  const collaborationTagsByCategory =
    useMemo(() => {
      return groupTagsByCategory(
        settings.availableTags
      )
    }, [settings.availableTags])

  const fieldErrors =
    result && !result.success
      ? result.fieldErrors
      : undefined

  const canAddSocialLink =
    socialLinks.length <
      CREATOR_FIELD_LIMITS.socialLinksPerCreator &&
    availableSocialPlatforms.length > 0

  function clearResult() {
    if (result) {
      setResult(null)
    }
  }

  function requestCreatorModeChange(
    enabled: boolean
  ) {
    clearResult()

    if (!enabled && creatorModeEnabled) {
      setShowDisableConfirmation(true)
      return
    }

    setCreatorModeEnabled(enabled)
  }

  function confirmDisableCreatorMode() {
    setCreatorModeEnabled(false)
    setShowDisableConfirmation(false)
  }

  function addSocialLink() {
    if (!canAddSocialLink) {
      return
    }

    clearResult()

    const nextPlatform =
      availableSocialPlatforms[0]?.value

    if (!nextPlatform) {
      return
    }

    setSocialLinks((current) => [
      ...current,
      {
        clientId: createClientId(),
        platform: nextPlatform,
        url: '',
        handle: null,
        sort_order: current.length,
        is_public:
          CREATOR_MODE_DEFAULTS.socialLinksPublic,
      },
    ])
  }

  function updateSocialLink(
    clientId: string,
    updates: Partial<EditableSocialLink>
  ) {
    clearResult()

    setSocialLinks((current) =>
      current.map((link) =>
        link.clientId === clientId
          ? {
              ...link,
              ...updates,
            }
          : link
      )
    )
  }

  function changeSocialPlatform(
    clientId: string,
    platform: CreatorSocialPlatform
  ) {
    const definition =
      CREATOR_SOCIAL_PLATFORM_DEFINITIONS[
        platform
      ]

    updateSocialLink(clientId, {
      platform,
      handle: definition.supportsHandle
        ? null
        : null,
      url: '',
    })
  }

  function removeSocialLink(clientId: string) {
    clearResult()

    setSocialLinks((current) =>
      normalizeSocialLinkOrder(
        current.filter(
          (link) =>
            link.clientId !== clientId
        )
      )
    )
  }

  function moveSocialLink(
    clientId: string,
    direction: 'up' | 'down'
  ) {
    clearResult()

    setSocialLinks((current) => {
      const currentIndex =
        current.findIndex(
          (link) =>
            link.clientId === clientId
        )

      if (currentIndex < 0) {
        return current
      }

      const targetIndex =
        direction === 'up'
          ? currentIndex - 1
          : currentIndex + 1

      if (
        targetIndex < 0 ||
        targetIndex >= current.length
      ) {
        return current
      }

      const next = [...current]

      const [movedLink] = next.splice(
        currentIndex,
        1
      )

      if (!movedLink) {
        return current
      }

      next.splice(targetIndex, 0, movedLink)

      return normalizeSocialLinkOrder(next)
    })
  }

  function toggleCollaborationTag(
    tagId: number
  ) {
    clearResult()

    setSelectedCollaborationTagIds(
      (current) => {
        if (current.includes(tagId)) {
          return current.filter(
            (currentId) =>
              currentId !== tagId
          )
        }

        if (
          current.length >=
          CREATOR_FIELD_LIMITS
            .collaborationTagsPerCreator
        ) {
          return current
        }

        return [...current, tagId]
      }
    )
  }

  function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    setResult(null)

    const payload = {
      creatorModeEnabled,
      creatorHeadline:
        nullableTrimmedString(
          creatorHeadline
        ),
      creatorBio:
        nullableTrimmedString(creatorBio),
      primaryCity:
        nullableTrimmedString(primaryCity),
      availableForTravel,
      acceptingCollaborations,
      publicEmail:
        nullableTrimmedString(publicEmail),
      socialLinks:
        normalizeSocialLinkOrder(
          socialLinks
        ).map(
          ({
            clientId: _clientId,
            ...link
          }) => ({
            ...link,
            handle:
              nullableTrimmedString(
                link.handle
              ),
          })
        ),
      collaborationTagIds:
        selectedCollaborationTagIds,
    }

    startTransition(async () => {
      const actionResult =
        await saveCreatorSettingsAction(
          payload
        )

      setResult(actionResult)

      if (actionResult.success) {
        router.refresh()
        scrollToFormTop()
      }
    })
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="w-full min-w-0 space-y-6"
        noValidate
      >
        <CreatorModeToggleSection
          enabled={creatorModeEnabled}
          disabled={isPending}
          onChange={
            requestCreatorModeChange
          }
          error={getFirstFieldError(
            fieldErrors,
            'creatorModeEnabled'
          )}
        />

        <CreatorIdentitySection
          creatorHeadline={creatorHeadline}
          creatorBio={creatorBio}
          primaryCity={primaryCity}
          publicEmail={publicEmail}
          availableForTravel={
            availableForTravel
          }
          acceptingCollaborations={
            acceptingCollaborations
          }
          disabled={isPending}
          errors={fieldErrors}
          onCreatorHeadlineChange={
            setCreatorHeadline
          }
          onCreatorBioChange={setCreatorBio}
          onPrimaryCityChange={setPrimaryCity}
          onPublicEmailChange={setPublicEmail}
          onAvailableForTravelChange={
            setAvailableForTravel
          }
          onAcceptingCollaborationsChange={
            setAcceptingCollaborations
          }
          onInteraction={clearResult}
        />

        <CreatorSocialLinksSection
          links={socialLinks}
          availablePlatforms={
            availableSocialPlatforms.map(
              (option) => option.value
            )
          }
          disabled={isPending}
          canAdd={canAddSocialLink}
          error={getFirstFieldError(
            fieldErrors,
            'socialLinks'
          )}
          onAdd={addSocialLink}
          onRemove={removeSocialLink}
          onMove={moveSocialLink}
          onPlatformChange={
            changeSocialPlatform
          }
          onUpdate={updateSocialLink}
        />

        <CreatorCollaborationTagsSection
          tagsByCategory={
            collaborationTagsByCategory
          }
          selectedTagIds={
            selectedTagIdSet
          }
          disabled={isPending}
          error={getFirstFieldError(
            fieldErrors,
            'collaborationTagIds'
          )}
          onToggle={
            toggleCollaborationTag
          }
        />

        <CreatorModeRequirements
          creatorModeEnabled={
            creatorModeEnabled
          }
          creatorHeadline={
            creatorHeadline
          }
          publicSocialLinkCount={
            socialLinks.filter(
              (link) =>
                link.is_public &&
                link.url.trim().length > 0
            ).length
          }
          collaborationTagCount={
            selectedCollaborationTagIds.length
          }
        />

        <FormResultMessage
          result={result}
        />

        <div className="sticky bottom-3 z-20 rounded-2xl border border-neutral-800 bg-neutral-950/95 p-3 shadow-2xl shadow-black/60 backdrop-blur-xl sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">
              Save Creator Mode settings
            </p>

            <p className="mt-0.5 text-xs leading-5 text-neutral-500">
              Public changes appear after the
              save completes.
            </p>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60 sm:mt-0 sm:w-auto"
          >
            {isPending ? (
              <>
                <Loader2
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin"
                />
                Saving…
              </>
            ) : (
              <>
                <Check
                  aria-hidden="true"
                  className="h-4 w-4"
                />
                Save Creator Mode
              </>
            )}
          </button>
        </div>
      </form>

      {showDisableConfirmation ? (
        <DisableCreatorModeDialog
          disabled={isPending}
          onCancel={() =>
            setShowDisableConfirmation(false)
          }
          onConfirm={
            confirmDisableCreatorMode
          }
        />
      ) : null}
    </>
  )
}

/* =========================================================
 * Creator Mode toggle
 * ======================================================= */

function CreatorModeToggleSection({
  enabled,
  disabled,
  error,
  onChange,
}: {
  enabled: boolean
  disabled: boolean
  error?: string
  onChange: (enabled: boolean) => void
}) {
  return (
    <section
      aria-labelledby="creator-mode-toggle-title"
      className="w-full min-w-0 rounded-2xl border border-neutral-800 bg-black/25 p-4 sm:p-5"
    >
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Visibility
          </p>

          <h3
            id="creator-mode-toggle-title"
            className="mt-2 text-base font-semibold text-white"
          >
            Enable Creator Mode
          </h3>

          <p className="mt-1 max-w-xl text-sm leading-6 text-neutral-400">
            When enabled, your creator identity,
            public social links, collaboration
            tags, local footprint, and featured
            collections can appear on your public
            Roam profile.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={
            enabled
              ? 'Disable Creator Mode'
              : 'Enable Creator Mode'
          }
          disabled={disabled}
          onClick={() =>
            onChange(!enabled)
          }
          className={[
            'relative mt-1 h-7 w-12 shrink-0 rounded-full border transition disabled:cursor-not-allowed disabled:opacity-60',
            enabled
              ? 'border-cyan-300 bg-cyan-400'
              : 'border-neutral-700 bg-neutral-900',
          ].join(' ')}
        >
          <span
            aria-hidden="true"
            className={[
              'absolute top-1 h-5 w-5 rounded-full shadow transition',
              enabled
                ? 'left-6 bg-black'
                : 'left-1 bg-neutral-500',
            ].join(' ')}
          />
        </button>
      </div>

      <div
        className={[
          'mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold',
          enabled
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
            : 'border-neutral-700 bg-neutral-900 text-neutral-500',
        ].join(' ')}
      >
        <span
          aria-hidden="true"
          className={[
            'h-2 w-2 rounded-full',
            enabled
              ? 'bg-emerald-400'
              : 'bg-neutral-600',
          ].join(' ')}
        />

        {enabled
          ? 'Creator Mode will be public after saving'
          : 'Creator Mode is hidden'}
      </div>

      <FieldError message={error} />
    </section>
  )
}

/* =========================================================
 * Creator identity
 * ======================================================= */

function CreatorIdentitySection({
  creatorHeadline,
  creatorBio,
  primaryCity,
  publicEmail,
  availableForTravel,
  acceptingCollaborations,
  disabled,
  errors,
  onCreatorHeadlineChange,
  onCreatorBioChange,
  onPrimaryCityChange,
  onPublicEmailChange,
  onAvailableForTravelChange,
  onAcceptingCollaborationsChange,
  onInteraction,
}: {
  creatorHeadline: string
  creatorBio: string
  primaryCity: string
  publicEmail: string
  availableForTravel: boolean
  acceptingCollaborations: boolean
  disabled: boolean
  errors?: FormFieldErrors
  onCreatorHeadlineChange: (
    value: string
  ) => void
  onCreatorBioChange: (
    value: string
  ) => void
  onPrimaryCityChange: (
    value: string
  ) => void
  onPublicEmailChange: (
    value: string
  ) => void
  onAvailableForTravelChange: (
    value: boolean
  ) => void
  onAcceptingCollaborationsChange: (
    value: boolean
  ) => void
  onInteraction: () => void
}) {
  return (
    <section
      aria-labelledby="creator-identity-title"
      className="w-full min-w-0 rounded-2xl border border-neutral-800 bg-black/25 p-4 sm:p-5"
    >
      <SectionHeading
        eyebrow="Identity"
        title="How collaborators see you"
        description="Use a clear headline and bio that describe your niche, location, and creative value."
        id="creator-identity-title"
      />

      <div className="mt-5 space-y-5">
        <TextField
          id="creator-headline"
          label="Creator headline"
          value={creatorHeadline}
          placeholder="Chicago food and hospitality creator"
          maxLength={
            CREATOR_FIELD_LIMITS.headline
          }
          required
          disabled={disabled}
          error={getFirstFieldError(
            errors,
            'creatorHeadline'
          )}
          onChange={(value) => {
            onInteraction()
            onCreatorHeadlineChange(value)
          }}
        />

        <TextAreaField
          id="creator-bio"
          label="Creator bio"
          value={creatorBio}
          placeholder="I create short-form content for restaurants, hotels, and local experiences."
          maxLength={CREATOR_FIELD_LIMITS.bio}
          rows={5}
          disabled={disabled}
          error={getFirstFieldError(
            errors,
            'creatorBio'
          )}
          onChange={(value) => {
            onInteraction()
            onCreatorBioChange(value)
          }}
        />

        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <TextField
            id="creator-primary-city"
            label="Primary city"
            value={primaryCity}
            placeholder="Chicago"
            maxLength={
              CREATOR_FIELD_LIMITS.primaryCity
            }
            disabled={disabled}
            error={getFirstFieldError(
              errors,
              'primaryCity'
            )}
            onChange={(value) => {
              onInteraction()
              onPrimaryCityChange(value)
            }}
          />

          <TextField
            id="creator-public-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            label="Public contact email"
            value={publicEmail}
            placeholder="hello@example.com"
            maxLength={
              CREATOR_FIELD_LIMITS.publicEmail
            }
            disabled={disabled}
            error={getFirstFieldError(
              errors,
              'publicEmail'
            )}
            description="Only add an email you are comfortable displaying publicly."
            onChange={(value) => {
              onInteraction()
              onPublicEmailChange(value)
            }}
          />
        </div>

        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <BooleanPreferenceCard
            checked={acceptingCollaborations}
            disabled={disabled}
            title="Accepting collaborations"
            description="Show visitors that you are open to brand and venue opportunities."
            error={getFirstFieldError(
              errors,
              'acceptingCollaborations'
            )}
            onChange={(value) => {
              onInteraction()
              onAcceptingCollaborationsChange(
                value
              )
            }}
          />

          <BooleanPreferenceCard
            checked={availableForTravel}
            disabled={disabled}
            title="Available for travel"
            description="Signal that you may accept opportunities outside your primary city."
            error={getFirstFieldError(
              errors,
              'availableForTravel'
            )}
            onChange={(value) => {
              onInteraction()
              onAvailableForTravelChange(value)
            }}
          />
        </div>
      </div>
    </section>
  )
}

/* =========================================================
 * Social links
 * ======================================================= */

function CreatorSocialLinksSection({
  links,
  availablePlatforms,
  disabled,
  canAdd,
  error,
  onAdd,
  onRemove,
  onMove,
  onPlatformChange,
  onUpdate,
}: {
  links: EditableSocialLink[]
  availablePlatforms: CreatorSocialPlatform[]
  disabled: boolean
  canAdd: boolean
  error?: string
  onAdd: () => void
  onRemove: (clientId: string) => void
  onMove: (
    clientId: string,
    direction: 'up' | 'down'
  ) => void
  onPlatformChange: (
    clientId: string,
    platform: CreatorSocialPlatform
  ) => void
  onUpdate: (
    clientId: string,
    updates: Partial<EditableSocialLink>
  ) => void
}) {
  return (
    <section
      aria-labelledby="creator-social-links-title"
      className="w-full min-w-0 rounded-2xl border border-neutral-800 bg-black/25 p-4 sm:p-5"
    >
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeading
          eyebrow="Social presence"
          title="Public social links"
          description="Connect the platforms where brands and collaborators can review your work."
          id="creator-social-links-title"
        />

        <button
          type="button"
          disabled={disabled || !canAdd}
          onClick={onAdd}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:border-cyan-400/60 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus
            aria-hidden="true"
            className="h-4 w-4"
          />
          Add Social Link
        </button>
      </div>

      <FieldError message={error} />

      {links.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-neutral-800 bg-neutral-950/50 px-5 py-8 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-900 text-neutral-400">
            <Link2
              aria-hidden="true"
              className="h-5 w-5"
            />
          </div>

          <p className="mt-4 text-sm font-semibold text-white">
            No social links yet
          </p>

          <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-neutral-500">
            Add at least one public social link
            before enabling Creator Mode.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {links.map((link, index) => (
            <SocialLinkEditor
              key={link.clientId}
              link={link}
              index={index}
              totalLinks={links.length}
              availablePlatforms={
                availablePlatforms
              }
              disabled={disabled}
              onRemove={() =>
                onRemove(link.clientId)
              }
              onMove={(direction) =>
                onMove(
                  link.clientId,
                  direction
                )
              }
              onPlatformChange={(platform) =>
                onPlatformChange(
                  link.clientId,
                  platform
                )
              }
              onUpdate={(updates) =>
                onUpdate(
                  link.clientId,
                  updates
                )
              }
            />
          ))}
        </div>
      )}

      <p className="mt-3 text-xs text-neutral-600">
        {links.length.toLocaleString()}/
        {CREATOR_FIELD_LIMITS.socialLinksPerCreator.toLocaleString()}{' '}
        social links
      </p>
    </section>
  )
}

function SocialLinkEditor({
  link,
  index,
  totalLinks,
  availablePlatforms,
  disabled,
  onRemove,
  onMove,
  onPlatformChange,
  onUpdate,
}: {
  link: EditableSocialLink
  index: number
  totalLinks: number
  availablePlatforms: CreatorSocialPlatform[]
  disabled: boolean
  onRemove: () => void
  onMove: (
    direction: 'up' | 'down'
  ) => void
  onPlatformChange: (
    platform: CreatorSocialPlatform
  ) => void
  onUpdate: (
    updates: Partial<EditableSocialLink>
  ) => void
}) {
  const definition =
    CREATOR_SOCIAL_PLATFORM_DEFINITIONS[
      link.platform
    ]

  const platformOptions = [
    link.platform,
    ...availablePlatforms.filter(
      (platform) =>
        platform !== link.platform
    ),
  ]

  return (
    <article className="w-full min-w-0 rounded-2xl border border-neutral-800 bg-neutral-950/70 p-3 sm:p-4">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <GripVertical
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-neutral-700"
          />

          <p className="truncate text-sm font-semibold text-white">
            {definition.label}
          </p>

          <span
            className={[
              'shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]',
              link.is_public
                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                : 'border-neutral-700 bg-neutral-900 text-neutral-500',
            ].join(' ')}
          >
            {link.is_public
              ? 'Public'
              : 'Hidden'}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={`Move ${definition.label} up`}
            disabled={
              disabled || index === 0
            }
            onClick={() => onMove('up')}
            className="rounded-lg border border-neutral-800 px-2 py-1 text-xs text-neutral-400 transition hover:border-neutral-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            ↑
          </button>

          <button
            type="button"
            aria-label={`Move ${definition.label} down`}
            disabled={
              disabled ||
              index === totalLinks - 1
            }
            onClick={() => onMove('down')}
            className="rounded-lg border border-neutral-800 px-2 py-1 text-xs text-neutral-400 transition hover:border-neutral-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            ↓
          </button>

          <button
            type="button"
            aria-label={`Remove ${definition.label}`}
            disabled={disabled}
            onClick={onRemove}
            className="rounded-lg border border-red-900/50 bg-red-950/20 p-1.5 text-red-300 transition hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2
              aria-hidden="true"
              className="h-4 w-4"
            />
          </button>
        </div>
      </div>

      <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
        <label className="block min-w-0">
          <span className="text-xs font-medium text-neutral-300">
            Platform
          </span>

          <select
            value={link.platform}
            disabled={disabled}
            onChange={(event) =>
              onPlatformChange(
                event.target
                  .value as CreatorSocialPlatform
              )
            }
            className="mt-2 w-full min-w-0 rounded-xl border border-neutral-800 bg-black px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {platformOptions.map(
              (platform) => (
                <option
                  key={platform}
                  value={platform}
                >
                  {
                    CREATOR_SOCIAL_PLATFORM_DEFINITIONS[
                      platform
                    ].label
                  }
                </option>
              )
            )}
          </select>
        </label>

        {definition.supportsHandle ? (
          <label className="block min-w-0">
            <span className="text-xs font-medium text-neutral-300">
              Display handle
            </span>

            <input
              type="text"
              value={link.handle ?? ''}
              disabled={disabled}
              maxLength={
                CREATOR_FIELD_LIMITS.socialHandle
              }
              placeholder={
                definition.handlePlaceholder
              }
              onChange={(event) =>
                onUpdate({
                  handle:
                    event.target.value,
                })
              }
              className="mt-2 w-full min-w-0 rounded-xl border border-neutral-800 bg-black px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-neutral-700 focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>
        ) : (
          <div className="hidden sm:block" />
        )}
      </div>

      <label className="mt-4 block min-w-0">
        <span className="text-xs font-medium text-neutral-300">
          Profile URL
        </span>

        <div className="relative mt-2">
          <input
            type="url"
            inputMode="url"
            value={link.url}
            disabled={disabled}
            maxLength={
              CREATOR_FIELD_LIMITS.socialUrl
            }
            placeholder={definition.placeholder}
            onChange={(event) =>
              onUpdate({
                url: event.target.value,
              })
            }
            className="w-full min-w-0 rounded-xl border border-neutral-800 bg-black py-2.5 pl-3 pr-10 text-sm text-white outline-none transition placeholder:text-neutral-700 focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
          />

          {link.url.trim() ? (
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${definition.label} URL`}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 transition hover:text-cyan-300"
            >
              <ExternalLink
                aria-hidden="true"
                className="h-4 w-4"
              />
            </a>
          ) : null}
        </div>
      </label>

      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-800 bg-black/40 p-3">
        <input
          type="checkbox"
          checked={link.is_public}
          disabled={disabled}
          onChange={(event) =>
            onUpdate({
              is_public:
                event.target.checked,
            })
          }
          className="mt-0.5 h-4 w-4 shrink-0 accent-cyan-400"
        />

        <span className="min-w-0">
          <span className="flex items-center gap-2 text-sm font-medium text-neutral-200">
            {link.is_public ? (
              <Eye
                aria-hidden="true"
                className="h-4 w-4 text-emerald-400"
              />
            ) : (
              <EyeOff
                aria-hidden="true"
                className="h-4 w-4 text-neutral-500"
              />
            )}

            Show publicly
          </span>

          <span className="mt-1 block text-xs leading-5 text-neutral-500">
            Hidden links remain saved but do
            not appear on your public creator
            profile.
          </span>
        </span>
      </label>
    </article>
  )
}

/* =========================================================
 * Collaboration tags
 * ======================================================= */

function CreatorCollaborationTagsSection({
  tagsByCategory,
  selectedTagIds,
  disabled,
  error,
  onToggle,
}: {
  tagsByCategory: Record<
    CollaborationTagCategory,
    CollaborationTag[]
  >
  selectedTagIds: Set<number>
  disabled: boolean
  error?: string
  onToggle: (tagId: number) => void
}) {
  const selectionCount =
    selectedTagIds.size

  const selectionLimitReached =
    selectionCount >=
    CREATOR_FIELD_LIMITS
      .collaborationTagsPerCreator

  return (
    <section
      aria-labelledby="creator-collaboration-tags-title"
      className="w-full min-w-0 rounded-2xl border border-neutral-800 bg-black/25 p-4 sm:p-5"
    >
      <SectionHeading
        eyebrow="Available for"
        title="Collaboration preferences"
        description="Choose the campaign types, deliverables, and industries that match your actual work."
        id="creator-collaboration-tags-title"
      />

      <FieldError message={error} />

      <div className="mt-5 space-y-6">
        {COLLABORATION_CATEGORY_OPTIONS.map(
          (category) => {
            const tags =
              tagsByCategory[
                category.value
              ]

            if (tags.length === 0) {
              return null
            }

            return (
              <div key={category.value}>
                <div>
                  <p className="text-sm font-semibold text-neutral-200">
                    {category.label}
                  </p>

                  <p className="mt-1 text-xs leading-5 text-neutral-500">
                    {category.description}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {tags.map((tag) => {
                    const selected =
                      selectedTagIds.has(
                        tag.id
                      )

                    const unavailable =
                      disabled ||
                      (!selected &&
                        selectionLimitReached)

                    return (
                      <button
                        key={tag.id}
                        type="button"
                        aria-pressed={selected}
                        disabled={unavailable}
                        onClick={() =>
                          onToggle(tag.id)
                        }
                        className={[
                          'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40',
                          selected
                            ? 'border-cyan-400 bg-cyan-400 text-black'
                            : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-cyan-500/40 hover:text-cyan-200',
                        ].join(' ')}
                      >
                        {selected ? (
                          <Check
                            aria-hidden="true"
                            className="h-3.5 w-3.5"
                          />
                        ) : null}

                        {tag.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          }
        )}
      </div>

      <p className="mt-5 text-xs text-neutral-600">
        {selectionCount.toLocaleString()}/
        {CREATOR_FIELD_LIMITS.collaborationTagsPerCreator.toLocaleString()}{' '}
        selected
      </p>
    </section>
  )
}

/* =========================================================
 * Enablement requirements
 * ======================================================= */

function CreatorModeRequirements({
  creatorModeEnabled,
  creatorHeadline,
  publicSocialLinkCount,
  collaborationTagCount,
}: {
  creatorModeEnabled: boolean
  creatorHeadline: string
  publicSocialLinkCount: number
  collaborationTagCount: number
}) {
  if (!creatorModeEnabled) {
    return null
  }

  const requirements = [
    {
      label: 'Creator headline',
      complete:
        creatorHeadline.trim().length > 0,
    },
    {
      label: 'Public social link',
      complete: publicSocialLinkCount > 0,
    },
    {
      label: 'Collaboration tag',
      complete: collaborationTagCount > 0,
    },
  ]

  const allComplete = requirements.every(
    (requirement) =>
      requirement.complete
  )

  return (
    <section
      aria-label="Creator Mode requirements"
      className={[
        'rounded-2xl border p-4',
        allComplete
          ? 'border-emerald-500/25 bg-emerald-500/10'
          : 'border-amber-500/25 bg-amber-500/10',
      ].join(' ')}
    >
      <p
        className={[
          'text-sm font-semibold',
          allComplete
            ? 'text-emerald-200'
            : 'text-amber-200',
        ].join(' ')}
      >
        {allComplete
          ? 'Ready to publish'
          : 'Complete the required fields'}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {requirements.map(
          (requirement) => (
            <span
              key={requirement.label}
              className={[
                'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium',
                requirement.complete
                  ? 'border-emerald-500/30 bg-emerald-950/40 text-emerald-300'
                  : 'border-amber-500/30 bg-amber-950/40 text-amber-300',
              ].join(' ')}
            >
              <span aria-hidden="true">
                {requirement.complete
                  ? '✓'
                  : '·'}
              </span>

              {requirement.label}
            </span>
          )
        )}
      </div>
    </section>
  )
}

/* =========================================================
 * Shared fields
 * ======================================================= */

function SectionHeading({
  eyebrow,
  title,
  description,
  id,
}: {
  eyebrow: string
  title: string
  description: string
  id: string
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
        {eyebrow}
      </p>

      <h3
        id={id}
        className="mt-2 text-base font-semibold text-white"
      >
        {title}
      </h3>

      <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-400">
        {description}
      </p>
    </div>
  )
}

function TextField({
  id,
  label,
  value,
  placeholder,
  maxLength,
  required = false,
  disabled,
  type = 'text',
  inputMode,
  autoComplete,
  description,
  error,
  onChange,
}: {
  id: string
  label: string
  value: string
  placeholder?: string
  maxLength: number
  required?: boolean
  disabled: boolean
  type?: 'text' | 'email' | 'url'
  inputMode?:
    | 'text'
    | 'email'
    | 'url'
  autoComplete?: string
  description?: string
  error?: string
  onChange: (value: string) => void
}) {
  const descriptionId = `${id}-description`
  const errorId = `${id}-error`

  return (
    <label
      htmlFor={id}
      className="block min-w-0"
    >
      <span className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-neutral-200">
          {label}
          {required ? (
            <span className="text-cyan-400">
              {' '}
              *
            </span>
          ) : null}
        </span>

        <CharacterCount
          current={value.length}
          maximum={maxLength}
        />
      </span>

      <input
        id={id}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        value={value}
        required={required}
        disabled={disabled}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={[
          description
            ? descriptionId
            : null,
          error ? errorId : null,
        ]
          .filter(Boolean)
          .join(' ') || undefined}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className={[
          'mt-2 w-full min-w-0 rounded-xl border bg-black px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-60',
          error
            ? 'border-red-500/70 focus:border-red-400'
            : 'border-neutral-800 focus:border-cyan-500',
        ].join(' ')}
      />

      {description ? (
        <span
          id={descriptionId}
          className="mt-1.5 block text-xs leading-5 text-neutral-600"
        >
          {description}
        </span>
      ) : null}

      <FieldError
        id={errorId}
        message={error}
      />
    </label>
  )
}

function TextAreaField({
  id,
  label,
  value,
  placeholder,
  maxLength,
  rows,
  disabled,
  error,
  onChange,
}: {
  id: string
  label: string
  value: string
  placeholder?: string
  maxLength: number
  rows: number
  disabled: boolean
  error?: string
  onChange: (value: string) => void
}) {
  const errorId = `${id}-error`

  return (
    <label
      htmlFor={id}
      className="block min-w-0"
    >
      <span className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-neutral-200">
          {label}
        </span>

        <CharacterCount
          current={value.length}
          maximum={maxLength}
        />
      </span>

      <textarea
        id={id}
        value={value}
        rows={rows}
        disabled={disabled}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={
          error ? errorId : undefined
        }
        onChange={(event) =>
          onChange(event.target.value)
        }
        className={[
          'mt-2 w-full min-w-0 resize-y rounded-xl border bg-black px-3 py-2.5 text-sm leading-6 text-white outline-none transition placeholder:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-60',
          error
            ? 'border-red-500/70 focus:border-red-400'
            : 'border-neutral-800 focus:border-cyan-500',
        ].join(' ')}
      />

      <FieldError
        id={errorId}
        message={error}
      />
    </label>
  )
}

function BooleanPreferenceCard({
  checked,
  disabled,
  title,
  description,
  error,
  onChange,
}: {
  checked: boolean
  disabled: boolean
  title: string
  description: string
  error?: string
  onChange: (value: boolean) => void
}) {
  return (
    <div className="min-w-0">
      <label className="flex h-full cursor-pointer items-start gap-3 rounded-2xl border border-neutral-800 bg-neutral-950/70 p-4">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) =>
            onChange(event.target.checked)
          }
          className="mt-0.5 h-4 w-4 shrink-0 accent-cyan-400"
        />

        <span className="min-w-0">
          <span className="block text-sm font-semibold text-white">
            {title}
          </span>

          <span className="mt-1 block text-xs leading-5 text-neutral-500">
            {description}
          </span>
        </span>
      </label>

      <FieldError message={error} />
    </div>
  )
}

function CharacterCount({
  current,
  maximum,
}: {
  current: number
  maximum: number
}) {
  const nearLimit =
    current >= maximum * 0.9

  return (
    <span
      className={[
        'shrink-0 text-[11px]',
        nearLimit
          ? 'text-amber-300'
          : 'text-neutral-600',
      ].join(' ')}
    >
      {current.toLocaleString()}/
      {maximum.toLocaleString()}
    </span>
  )
}

function FieldError({
  id,
  message,
}: {
  id?: string
  message?: string
}) {
  if (!message) {
    return null
  }

  return (
    <p
      id={id}
      role="alert"
      className="mt-2 text-xs leading-5 text-red-300"
    >
      {message}
    </p>
  )
}

/* =========================================================
 * Result messages
 * ======================================================= */

function FormResultMessage({
  result,
}: {
  result: SaveCreatorSettingsResult | null
}) {
  if (!result) {
    return null
  }

  if (result.success) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3"
      >
        <p className="text-sm font-semibold text-emerald-200">
          Creator Mode settings saved
        </p>

        <p className="mt-1 text-xs leading-5 text-emerald-300/80">
          Your creator profile has been
          updated successfully.
        </p>
      </div>
    )
  }

  return (
    <div
      role="alert"
      className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3"
    >
      <p className="text-sm font-semibold text-red-200">
        Creator Mode could not be saved
      </p>

      <p className="mt-1 text-xs leading-5 text-red-300/80">
        {result.error}
      </p>
    </div>
  )
}

/* =========================================================
 * Disable confirmation
 * ======================================================= */

function DisableCreatorModeDialog({
  disabled,
  onCancel,
  onConfirm,
}: {
  disabled: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="disable-creator-mode-title"
      aria-describedby="disable-creator-mode-description"
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/85 p-4 text-white"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-[2rem] border border-neutral-800 bg-neutral-950 p-5 shadow-2xl"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <p
          id="disable-creator-mode-title"
          className="text-lg font-semibold text-white"
        >
          Disable Creator Mode?
        </p>

        <p
          id="disable-creator-mode-description"
          className="mt-2 text-sm leading-6 text-neutral-400"
        >
          Your creator details, social links,
          tags, and collections will remain
          saved, but the Creator Mode layer will
          be hidden from your public profile
          after you save.
        </p>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={disabled}
            onClick={onCancel}
            className="rounded-full border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-300 transition hover:border-neutral-500 hover:text-white disabled:opacity-50"
          >
            Keep Enabled
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={onConfirm}
            className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-400 disabled:opacity-50"
          >
            Disable Creator Mode
          </button>
        </div>
      </div>
    </div>
  )
}

/* =========================================================
 * Utilities
 * ======================================================= */

function groupTagsByCategory(
  tags: CollaborationTag[]
): Record<
  CollaborationTagCategory,
  CollaborationTag[]
> {
  const grouped: Record<
    CollaborationTagCategory,
    CollaborationTag[]
  > = {
    campaign: [],
    deliverable: [],
    industry: [],
  }

  for (const tag of tags) {
    grouped[tag.category].push(tag)
  }

  return grouped
}

function normalizeSocialLinkOrder(
  links: EditableSocialLink[]
): EditableSocialLink[] {
  return links.map((link, index) => ({
    ...link,
    sort_order: index,
  }))
}

function nullableTrimmedString(
  value: string | null | undefined
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

function getFirstFieldError(
  errors: FormFieldErrors | undefined,
  field: keyof FormFieldErrors
): string | undefined {
  return errors?.[field]?.[0]
}

function createClientId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }

  return [
    Date.now().toString(36),
    Math.random().toString(36).slice(2),
  ].join('-')
}

function scrollToFormTop() {
  if (typeof window === 'undefined') {
    return
  }

  window.requestAnimationFrame(() => {
    document
      .getElementById(
        'creator-settings-form-title'
      )
      ?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
  })
}