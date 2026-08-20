'use server'

// app/venue-admin/relay/actions.ts

import {
  revalidatePath,
} from 'next/cache'

import {
  createServerClient,
} from '@/lib/supabase/server'

import type {
  RelayAuthoringInput,
} from '@/components/venue-admin/relay/RelayAuthoringForm'

import type {
  RelaySlotEditorValue,
} from '@/components/venue-admin/relay/RelaySlotEditor'

import {
  RELAY_MAX_SLOT_COUNT,
  RELAY_MIN_SLOT_COUNT,
  normalizeRelaySlotBuilderValue,
  validateRelaySlotBuilderValue,
} from '@/components/venue-admin/relay/RelaySlotBuilder'

import {
  validateRelayRewardPolicyEditorValue,
} from '@/components/venue-admin/relay/RelayRewardPolicyEditor'

import type {
  RelayId,
  RelayRewardMode,
  RelaySlotSelectionMode,
  VenueId,
} from '@/lib/relay/types'


/* ============================================================
 * PUBLIC INPUT / RESULT CONTRACTS
 * ============================================================
 */

export type RelayAdminSaveInput = {
  definition:
    RelayAuthoringInput

  slots:
    RelaySlotEditorValue[]
}


export type RelayAdminSaveResult = {
  relayId:
    RelayId
}


/* ============================================================
 * DATABASE RPC CONTRACT
 * ============================================================
 *
 * This action layer intentionally calls exactly one transactional
 * RPC.
 *
 * Expected database function:
 *
 *   public.admin_save_roam_relay(
 *     p_relay_id uuid,
 *     p_definition jsonb,
 *     p_slots jsonb
 *   ) returns uuid
 *
 * p_relay_id:
 *   null  -> create
 *   uuid  -> update
 *
 * The RPC MUST:
 *
 *   - require auth.uid()
 *   - independently verify Venue Admin authority
 *   - serialize/update the target Relay
 *   - validate Relay lifecycle rules
 *   - insert/update roam_relays
 *   - persist Relay competition reward policy
 *   - atomically replace/upsert the complete slot template
 *   - reject illegal structural edits
 *   - enforce 3–5 contiguous slots
 *   - enforce required_geo_verified = true
 *   - validate selection-mode payloads
 *   - commit everything in one transaction
 *
 * Do not replace this RPC with several client-visible DML calls.
 * ============================================================
 */

type AdminSaveRelayRpcDefinition = {
  title: string

  description:
    string | null

  city:
    string | null

  theme:
    string | null

  starts_at:
    string | null

  ends_at:
    string | null

  min_team_size:
    number

  max_team_size:
    number

  visibility:
    'public'

  relay_reward_mode:
    RelayRewardMode

  xp_reward:
    number
}


type AdminSaveRelayRpcSlot = {
  id:
    RelayId | null

  slot_index:
    number

  label:
    string

  prompt:
    string | null

  selection_mode:
    RelaySlotSelectionMode

  category_constraint:
    string | null

  exact_venue_id:
    VenueId | null

  eligible_venue_ids:
    VenueId[]

  required_geo_verified:
    true
}


/* ============================================================
 * ERROR
 * ============================================================
 */

export class RelayAdminActionError extends Error {
  readonly code:
    string

  constructor(
    code: string,
    message: string
  ) {
    super(
      message
    )

    this.name =
      'RelayAdminActionError'

    this.code =
      code
  }
}


/* ============================================================
 * BASIC NORMALIZATION
 * ============================================================
 */

function normalizeRequiredText(
  value: string,
  fieldName: string
): string {
  const normalized =
    value.trim()

  if (!normalized) {
    throw new RelayAdminActionError(
      'invalid_input',
      `${fieldName} is required.`
    )
  }

  return normalized
}


function normalizeNullableText(
  value:
    string | null
): string | null {
  if (
    value ===
    null
  ) {
    return null
  }

  const normalized =
    value.trim()

  return normalized ||
    null
}


function assertStringLength(
  value:
    string | null,
  maximum:
    number,
  fieldName:
    string
): void {
  if (
    value !==
      null &&
    value.length >
      maximum
  ) {
    throw new RelayAdminActionError(
      'invalid_input',
      `${fieldName} must be ${maximum} characters or fewer.`
    )
  }
}


function assertIntegerInRange(
  value:
    number,
  minimum:
    number,
  maximum:
    number,
  fieldName:
    string
): void {
  if (
    !Number.isInteger(
      value
    ) ||
    value <
      minimum ||
    value >
      maximum
  ) {
    throw new RelayAdminActionError(
      'invalid_input',
      `${fieldName} must be a whole number between ${minimum} and ${maximum}.`
    )
  }
}


function normalizeOptionalIsoDate(
  value:
    string | null,
  fieldName:
    string
): string | null {
  if (!value) {
    return null
  }

  const date =
    new Date(
      value
    )

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw new RelayAdminActionError(
      'invalid_input',
      `${fieldName} is invalid.`
    )
  }

  return date.toISOString()
}


/* ============================================================
 * DEFINITION VALIDATION
 * ============================================================
 */

function normalizeDefinition(
  definition:
    RelayAuthoringInput
): AdminSaveRelayRpcDefinition {
  const title =
    normalizeRequiredText(
      definition.title,
      'Relay title'
    )

  const description =
    normalizeNullableText(
      definition.description
    )

  const city =
    normalizeNullableText(
      definition.city
    )

  const theme =
    normalizeNullableText(
      definition.theme
    )

  assertStringLength(
    title,
    120,
    'Relay title'
  )

  assertStringLength(
    description,
    1000,
    'Description'
  )

  assertStringLength(
    city,
    120,
    'City'
  )

  assertStringLength(
    theme,
    120,
    'Theme'
  )


  assertIntegerInRange(
    definition.minTeamSize,
    3,
    5,
    'Minimum team size'
  )

  assertIntegerInRange(
    definition.maxTeamSize,
    3,
    5,
    'Maximum team size'
  )

  if (
    definition.minTeamSize >
    definition.maxTeamSize
  ) {
    throw new RelayAdminActionError(
      'invalid_input',
      'Maximum team size cannot be smaller than minimum team size.'
    )
  }


  /*
   * Current canonical Relay v1 policy.
   *
   * Do not silently accept a future visibility value before the
   * database/RLS contract supports it.
   */
  if (
    definition.visibility !==
    'public'
  ) {
    throw new RelayAdminActionError(
      'unsupported_visibility',
      'Relay v1 currently supports public visibility only.'
    )
  }


  const rewardErrors =
    validateRelayRewardPolicyEditorValue({
      rewardMode:
        definition.rewardMode,

      xpReward:
        definition.xpReward,
    })

  if (
    Object.keys(
      rewardErrors
    ).length >
    0
  ) {
    throw new RelayAdminActionError(
      'invalid_reward_policy',
      rewardErrors.rewardMode ??
        rewardErrors.xpReward ??
        'Relay reward policy is invalid.'
    )
  }


  const startsAt =
    normalizeOptionalIsoDate(
      definition.startsAt,
      'Relay start time'
    )

  const endsAt =
    normalizeOptionalIsoDate(
      definition.endsAt,
      'Relay end time'
    )

  if (
    startsAt &&
    endsAt &&
    new Date(
      endsAt
    ).getTime() <=
      new Date(
        startsAt
      ).getTime()
  ) {
    throw new RelayAdminActionError(
      'invalid_window',
      'Relay end time must be after Relay start time.'
    )
  }


  return {
    title,

    description,

    city,

    theme,

    starts_at:
      startsAt,

    ends_at:
      endsAt,

    min_team_size:
      definition.minTeamSize,

    max_team_size:
      definition.maxTeamSize,

    visibility:
      'public',

    relay_reward_mode:
      definition.rewardMode,

    xp_reward:
      definition.xpReward,
  }
}


/* ============================================================
 * SLOT NORMALIZATION
 * ============================================================
 */

function normalizeSlotText(
  value: string
): string | null {
  const normalized =
    value.trim()

  return normalized ||
    null
}


function normalizeVenueIds(
  venueIds:
    VenueId[]
): VenueId[] {
  return [
    ...new Set(
      venueIds
        .map(
          (venueId) =>
            venueId.trim()
        )
        .filter(Boolean)
    ),
  ]
}


function normalizeSlotForRpc(
  slot:
    RelaySlotEditorValue
): AdminSaveRelayRpcSlot {
  const label =
    slot.label.trim()

  if (!label) {
    throw new RelayAdminActionError(
      'invalid_slot',
      `Relay leg ${slot.slotIndex} requires a label.`
    )
  }

  const prompt =
    normalizeSlotText(
      slot.prompt
    )

  const category =
    normalizeSlotText(
      slot.categoryConstraint
    )

  const exactVenueId =
    slot.exactVenueId
      ?.trim() ||
    null

  const eligibleVenueIds =
    normalizeVenueIds(
      slot.eligibleVenueIds
    )


  /*
   * Defense-in-depth normalization.
   *
   * Only the payload belonging to the selected mode survives.
   */
  switch (
    slot.selectionMode
  ) {
    case 'open':
      return {
        id:
          slot.id,

        slot_index:
          slot.slotIndex,

        label,

        prompt,

        selection_mode:
          'open',

        category_constraint:
          null,

        exact_venue_id:
          null,

        eligible_venue_ids:
          [],

        required_geo_verified:
          true,
      }


    case 'category':
      if (!category) {
        throw new RelayAdminActionError(
          'invalid_slot',
          `Relay leg ${slot.slotIndex} requires a category.`
        )
      }

      return {
        id:
          slot.id,

        slot_index:
          slot.slotIndex,

        label,

        prompt,

        selection_mode:
          'category',

        category_constraint:
          category,

        exact_venue_id:
          null,

        eligible_venue_ids:
          [],

        required_geo_verified:
          true,
      }


    case 'venue_pool':
      if (
        eligibleVenueIds.length ===
        0
      ) {
        throw new RelayAdminActionError(
          'invalid_slot',
          `Relay leg ${slot.slotIndex} requires at least one eligible venue.`
        )
      }

      return {
        id:
          slot.id,

        slot_index:
          slot.slotIndex,

        label,

        prompt,

        selection_mode:
          'venue_pool',

        category_constraint:
          null,

        exact_venue_id:
          null,

        eligible_venue_ids:
          eligibleVenueIds,

        required_geo_verified:
          true,
      }


    case 'exact_venue':
      if (!exactVenueId) {
        throw new RelayAdminActionError(
          'invalid_slot',
          `Relay leg ${slot.slotIndex} requires an exact venue.`
        )
      }

      return {
        id:
          slot.id,

        slot_index:
          slot.slotIndex,

        label,

        prompt,

        selection_mode:
          'exact_venue',

        category_constraint:
          null,

        exact_venue_id:
          exactVenueId,

        eligible_venue_ids:
          [],

        required_geo_verified:
          true,
      }
  }
}


/* ============================================================
 * TEMPLATE VALIDATION
 * ============================================================
 */

function normalizeSlots(
  slots:
    RelaySlotEditorValue[]
): AdminSaveRelayRpcSlot[] {
  const normalized =
    normalizeRelaySlotBuilderValue(
      slots
    )

  const validation =
    validateRelaySlotBuilderValue(
      normalized,
      {
        minSlots:
          RELAY_MIN_SLOT_COUNT,

        maxSlots:
          RELAY_MAX_SLOT_COUNT,
      }
    )

  if (
    !validation.isValid
  ) {
    throw new RelayAdminActionError(
      'invalid_template',
      validation.errors[0]
        ?.message ??
        'Relay route template is invalid.'
    )
  }


  /*
   * A Relay v1 contributor owns one required leg.
   *
   * Therefore team-size bounds cannot describe a team that cannot
   * map one-to-one onto the canonical template.
   *
   * The RPC must repeat this check.
   */
  return normalized.map(
    normalizeSlotForRpc
  )
}


/* ============================================================
 * CROSS-DOCUMENT VALIDATION
 * ============================================================
 */

function validateTeamSizeAgainstTemplate(
  definition:
    AdminSaveRelayRpcDefinition,
  slots:
    AdminSaveRelayRpcSlot[]
): void {
  const slotCount =
    slots.length

  if (
    definition.min_team_size >
    slotCount
  ) {
    throw new RelayAdminActionError(
      'team_template_mismatch',
      'Minimum team size cannot exceed the Relay slot count.'
    )
  }

  if (
    definition.max_team_size <
    slotCount
  ) {
    throw new RelayAdminActionError(
      'team_template_mismatch',
      'Maximum team size cannot be smaller than the Relay slot count.'
    )
  }


  /*
   * Relay v1 requires exactly one joined contributor per required
   * slot before a team becomes ready.
   *
   * To keep the authoring contract unambiguous, the authored team
   * size must therefore resolve to the number of route legs.
   */
  if (
    definition.min_team_size !==
      slotCount ||
    definition.max_team_size !==
      slotCount
  ) {
    throw new RelayAdminActionError(
      'team_template_mismatch',
      `Relay v1 requires team size to equal the ${slotCount}-leg route template.`
    )
  }
}


/* ============================================================
 * AUTHENTICATED CLIENT
 * ============================================================
 */

async function getAuthenticatedClient() {
  const supabase =
    await createServerClient()

  const {
    data: {
      user,
    },
    error,
  } =
    await supabase.auth.getUser()

  if (
    error ||
    !user
  ) {
    throw new RelayAdminActionError(
      'unauthenticated',
      'You must be signed in to manage Relays.'
    )
  }

  return {
    supabase,
    userId:
      user.id,
  }
}


/* ============================================================
 * RPC ERROR NORMALIZATION
 * ============================================================
 */

function normalizeDatabaseError(
  error: {
    message: string
    code?: string | null
    details?: string | null
    hint?: string | null
  }
): RelayAdminActionError {
  const code =
    error.code ??
    'relay_save_failed'

  /*
   * Keep database internals out of the browser-facing message.
   *
   * The RPC should raise intentional, human-readable exceptions
   * for expected admin validation failures.
   */
  const message =
    error.message?.trim() ||
    'Unable to save Relay.'

  return new RelayAdminActionError(
    code,
    message
  )
}


/* ============================================================
 * REVALIDATION
 * ============================================================
 */

function revalidateRelayAdminPaths(
  relayId:
    RelayId
): void {
  revalidatePath(
    '/venue-admin/relay'
  )

  revalidatePath(
    `/venue-admin/relay/${relayId}`
  )

  revalidatePath(
    `/relay/${relayId}`
  )
}


/* ============================================================
 * INTERNAL TRANSACTIONAL SAVE
 * ============================================================
 */

async function saveRelayDocument(
  relayId:
    RelayId | null,
  input:
    RelayAdminSaveInput
): Promise<RelayAdminSaveResult> {
  const definition =
    normalizeDefinition(
      input.definition
    )

  const slots =
    normalizeSlots(
      input.slots
    )

  validateTeamSizeAgainstTemplate(
    definition,
    slots
  )

  const {
    supabase,
  } =
    await getAuthenticatedClient()


  /*
   * PostgreSQL function arguments do not expose nullable argument
   * semantics to Supabase type generation.
   *
   * Therefore creation uses the dedicated two-argument wrapper,
   * while updates use the canonical three-argument transactional
   * function.
   *
   * Both paths execute admin_save_roam_relay internally.
   */
  const result =
    relayId ===
    null
      ? await supabase.rpc(
          'admin_create_roam_relay',
          {
            p_definition:
              definition,

            p_slots:
              slots,
          }
        )
      : await supabase.rpc(
          'admin_save_roam_relay',
          {
            p_relay_id:
              relayId,

            p_definition:
              definition,

            p_slots:
              slots,
          }
        )


  if (
    result.error
  ) {
    throw normalizeDatabaseError(
      result.error
    )
  }


  if (
    typeof result.data !==
      'string' ||
    !result.data.trim()
  ) {
    throw new RelayAdminActionError(
      'invalid_database_response',
      'Relay save completed without returning a Relay ID.'
    )
  }


  const savedRelayId =
    result.data.trim()


  revalidateRelayAdminPaths(
    savedRelayId
  )


  return {
    relayId:
      savedRelayId,
  }
}


/* ============================================================
 * CREATE
 * ============================================================
 */

export async function createRelay(
  input:
    RelayAdminSaveInput
): Promise<RelayAdminSaveResult> {
  return saveRelayDocument(
    null,
    input
  )
}


/* ============================================================
 * UPDATE
 * ============================================================
 */

export async function updateRelay(
  relayId:
    RelayId,
  input:
    RelayAdminSaveInput
): Promise<RelayAdminSaveResult> {
  const normalizedRelayId =
    relayId.trim()

  if (
    !normalizedRelayId
  ) {
    throw new RelayAdminActionError(
      'invalid_relay_id',
      'Relay ID is required.'
    )
  }


  return saveRelayDocument(
    normalizedRelayId,
    input
  )
}