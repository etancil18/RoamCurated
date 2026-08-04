// lib/creator-onboarding/constants.ts

/**
 * Canonical creator-onboarding configuration.
 *
 * This file owns:
 * - supported prompt keys;
 * - exact prompt wording;
 * - prompt versions;
 * - UI guidance and placeholders;
 * - onboarding completion requirements;
 * - answer-length limits;
 * - public/private defaults.
 *
 * API routes and database services should use these constants instead of
 * trusting prompt text, versions, or limits supplied by the client.
 */

export const CREATOR_ONBOARDING_PROMPT_KEYS = [
  'first_time_visitors',
  'best_known_neighborhood',
  'rainy_sunday',
  'affordable_meal',
  'parents_visit',
  'repeat_venue',
  'overrated_place',
  'underrated_place',
  'first_date',
  'remote_work',
  'perfect_saturday',
  'hidden_gem',
] as const

export type CreatorOnboardingPromptKey =
  (typeof CREATOR_ONBOARDING_PROMPT_KEYS)[number]

export type CreatorOnboardingPromptDefinition = {
  key: CreatorOnboardingPromptKey

  /**
   * Small UI label shown above the question.
   */
  eyebrow: string

  /**
   * Human-readable section title.
   */
  title: string

  /**
   * Canonical question stored with the answer.
   *
   * The server should persist this value instead of accepting arbitrary
   * prompt text from the browser.
   */
  promptText: string

  /**
   * Placeholder used by the onboarding interface.
   */
  placeholder: string

  /**
   * Supporting instructions shown beneath the prompt.
   */
  guidance: string

  /**
   * Increment this whenever the meaning or wording of the prompt changes
   * materially enough that historical answers need to remain distinguishable.
   */
  version: number

  /**
   * Whether new answers should default to public eligibility.
   *
   * This does not make the answer anonymously readable by itself. Public
   * exposure must still be handled through a safe projection, RPC, or
   * server-side loader.
   */
  defaultIsPublic: boolean

  /**
   * Minimum accepted creator-answer length for this prompt.
   */
  minimumAnswerLength: number

  /**
   * Maximum accepted creator-answer length for this prompt.
   */
  maximumAnswerLength: number
}

export const DEFAULT_CREATOR_ONBOARDING_PROMPT_VERSION = 1

export const DEFAULT_CREATOR_ONBOARDING_IS_PUBLIC = true

export const CREATOR_ONBOARDING_MIN_ANSWER_LENGTH = 10

export const CREATOR_ONBOARDING_MAX_ANSWER_LENGTH = 4_000

/**
 * Minimum number of creator-confirmed answers required before onboarding
 * may be marked complete.
 *
 * This must be enforced by the server. The client may display the value,
 * but it must not be allowed to override it.
 */
export const MIN_CONFIRMED_CREATOR_ONBOARDING_ANSWERS = 5

/**
 * Maximum number of onboarding answers supported by the current prompt set.
 */
export const TOTAL_CREATOR_ONBOARDING_PROMPTS =
  CREATOR_ONBOARDING_PROMPT_KEYS.length

/**
 * Stable schema version for the overall onboarding interview.
 *
 * This is separate from individual prompt versions. Increase this when the
 * broader onboarding structure or completion rules change materially.
 */
export const CREATOR_ONBOARDING_SCHEMA_VERSION = 1

export const CREATOR_ONBOARDING_PROMPTS = [
  {
    key: 'first_time_visitors',
    eyebrow: 'Local introduction',
    title: 'Where do you take first-time visitors?',
    promptText: 'Where do you take first-time visitors to your city?',
    placeholder:
      'I usually start at Ponce City Market, walk the BeltLine, then finish with drinks at Ladybird.',
    guidance:
      'Name specific places, neighborhoods, or a sequence you genuinely recommend.',
    version: DEFAULT_CREATOR_ONBOARDING_PROMPT_VERSION,
    defaultIsPublic: DEFAULT_CREATOR_ONBOARDING_IS_PUBLIC,
    minimumAnswerLength: CREATOR_ONBOARDING_MIN_ANSWER_LENGTH,
    maximumAnswerLength: CREATOR_ONBOARDING_MAX_ANSWER_LENGTH,
  },
  {
    key: 'best_known_neighborhood',
    eyebrow: 'Neighborhood expertise',
    title: 'Which neighborhood do you know best?',
    promptText:
      'Which neighborhood do you know best, and what makes it special to you?',
    placeholder:
      'Old Fourth Ward. I know the coffee shops, patios, walks, and late-night spots better than anywhere else.',
    guidance:
      'Explain what you understand about the neighborhood—not just its name.',
    version: DEFAULT_CREATOR_ONBOARDING_PROMPT_VERSION,
    defaultIsPublic: DEFAULT_CREATOR_ONBOARDING_IS_PUBLIC,
    minimumAnswerLength: CREATOR_ONBOARDING_MIN_ANSWER_LENGTH,
    maximumAnswerLength: CREATOR_ONBOARDING_MAX_ANSWER_LENGTH,
  },
  {
    key: 'rainy_sunday',
    eyebrow: 'Occasion',
    title: 'What is your perfect rainy Sunday?',
    promptText: 'What is your perfect rainy Sunday in your city?',
    placeholder:
      'Coffee somewhere bright, a bookstore, an indoor market, then cocktails at a quiet bar.',
    guidance:
      'Include the mood, pace, and places you would choose.',
    version: DEFAULT_CREATOR_ONBOARDING_PROMPT_VERSION,
    defaultIsPublic: DEFAULT_CREATOR_ONBOARDING_IS_PUBLIC,
    minimumAnswerLength: CREATOR_ONBOARDING_MIN_ANSWER_LENGTH,
    maximumAnswerLength: CREATOR_ONBOARDING_MAX_ANSWER_LENGTH,
  },
  {
    key: 'affordable_meal',
    eyebrow: 'Value',
    title: 'What is your favorite affordable meal?',
    promptText: 'What is your favorite affordable meal, and where do you get it?',
    placeholder:
      'The lunch special at my favorite neighborhood spot is the best meal under $20.',
    guidance:
      'Name the venue and include an approximate budget when possible.',
    version: DEFAULT_CREATOR_ONBOARDING_PROMPT_VERSION,
    defaultIsPublic: DEFAULT_CREATOR_ONBOARDING_IS_PUBLIC,
    minimumAnswerLength: CREATOR_ONBOARDING_MIN_ANSWER_LENGTH,
    maximumAnswerLength: CREATOR_ONBOARDING_MAX_ANSWER_LENGTH,
  },
  {
    key: 'parents_visit',
    eyebrow: 'Hosting',
    title: 'Where would you take your parents?',
    promptText:
      'Where would you take your parents or older family members visiting the city?',
    placeholder:
      'I would choose somewhere calm, comfortable, and easy to reach, then add a scenic walk nearby.',
    guidance:
      'Think about comfort, accessibility, atmosphere, and pacing.',
    version: DEFAULT_CREATOR_ONBOARDING_PROMPT_VERSION,
    defaultIsPublic: DEFAULT_CREATOR_ONBOARDING_IS_PUBLIC,
    minimumAnswerLength: CREATOR_ONBOARDING_MIN_ANSWER_LENGTH,
    maximumAnswerLength: CREATOR_ONBOARDING_MAX_ANSWER_LENGTH,
  },
  {
    key: 'repeat_venue',
    eyebrow: 'Repeat behavior',
    title: 'What venue do you return to most?',
    promptText: 'What venue do you return to most, and why do you keep going back?',
    placeholder:
      'I return for the consistent coffee, natural light, familiar staff, and easy weekday atmosphere.',
    guidance:
      'Repeat visits are one of Roam’s strongest indicators of genuine familiarity.',
    version: DEFAULT_CREATOR_ONBOARDING_PROMPT_VERSION,
    defaultIsPublic: DEFAULT_CREATOR_ONBOARDING_IS_PUBLIC,
    minimumAnswerLength: CREATOR_ONBOARDING_MIN_ANSWER_LENGTH,
    maximumAnswerLength: CREATOR_ONBOARDING_MAX_ANSWER_LENGTH,
  },
  {
    key: 'overrated_place',
    eyebrow: 'Judgment',
    title: 'What place is overrated?',
    promptText:
      'What place, neighborhood, or experience do you think is overrated, and why?',
    placeholder:
      'It looks great online, but I think the experience is expensive, crowded, and inconsistent.',
    guidance:
      'Be constructive. Explain your reasoning instead of attacking a person or business.',
    version: DEFAULT_CREATOR_ONBOARDING_PROMPT_VERSION,
    defaultIsPublic: DEFAULT_CREATOR_ONBOARDING_IS_PUBLIC,
    minimumAnswerLength: CREATOR_ONBOARDING_MIN_ANSWER_LENGTH,
    maximumAnswerLength: CREATOR_ONBOARDING_MAX_ANSWER_LENGTH,
  },
  {
    key: 'underrated_place',
    eyebrow: 'Discovery',
    title: 'What place deserves more attention?',
    promptText:
      'What place deserves more attention, and what makes it worth visiting?',
    placeholder:
      'It has excellent food, thoughtful service, and almost never gets mentioned in mainstream guides.',
    guidance:
      'Explain the audience, mood, or occasion that makes the place valuable.',
    version: DEFAULT_CREATOR_ONBOARDING_PROMPT_VERSION,
    defaultIsPublic: DEFAULT_CREATOR_ONBOARDING_IS_PUBLIC,
    minimumAnswerLength: CREATOR_ONBOARDING_MIN_ANSWER_LENGTH,
    maximumAnswerLength: CREATOR_ONBOARDING_MAX_ANSWER_LENGTH,
  },
  {
    key: 'first_date',
    eyebrow: 'Occasion',
    title: 'What is your ideal first date?',
    promptText: 'What is your ideal first-date plan in your city?',
    placeholder:
      'Start with drinks somewhere quiet, walk to dinner, then end at a low-pressure late-night spot.',
    guidance:
      'Describe one venue or a multi-stop route, including the atmosphere you are trying to create.',
    version: DEFAULT_CREATOR_ONBOARDING_PROMPT_VERSION,
    defaultIsPublic: DEFAULT_CREATOR_ONBOARDING_IS_PUBLIC,
    minimumAnswerLength: CREATOR_ONBOARDING_MIN_ANSWER_LENGTH,
    maximumAnswerLength: CREATOR_ONBOARDING_MAX_ANSWER_LENGTH,
  },
  {
    key: 'remote_work',
    eyebrow: 'Utility',
    title: 'Where do you work remotely?',
    promptText:
      'Where do you prefer to work remotely, and what makes those places work?',
    placeholder:
      'I look for reliable Wi-Fi, natural light, outlets, comfortable seating, and staff who do not rush you.',
    guidance:
      'Mention specific venues and the practical attributes that matter.',
    version: DEFAULT_CREATOR_ONBOARDING_PROMPT_VERSION,
    defaultIsPublic: DEFAULT_CREATOR_ONBOARDING_IS_PUBLIC,
    minimumAnswerLength: CREATOR_ONBOARDING_MIN_ANSWER_LENGTH,
    maximumAnswerLength: CREATOR_ONBOARDING_MAX_ANSWER_LENGTH,
  },
  {
    key: 'perfect_saturday',
    eyebrow: 'Lifestyle',
    title: 'What is your perfect Saturday?',
    promptText: 'Describe your perfect Saturday in your city.',
    placeholder:
      'Coffee, a long walk, lunch somewhere casual, an afternoon gallery, then dinner and cocktails.',
    guidance:
      'Describe the sequence, pace, neighborhoods, and places that make the day feel like yours.',
    version: DEFAULT_CREATOR_ONBOARDING_PROMPT_VERSION,
    defaultIsPublic: DEFAULT_CREATOR_ONBOARDING_IS_PUBLIC,
    minimumAnswerLength: CREATOR_ONBOARDING_MIN_ANSWER_LENGTH,
    maximumAnswerLength: CREATOR_ONBOARDING_MAX_ANSWER_LENGTH,
  },
  {
    key: 'hidden_gem',
    eyebrow: 'Taste',
    title: 'What is your favorite hidden gem?',
    promptText: 'What is your favorite hidden gem, and who is it best for?',
    placeholder:
      'A small neighborhood spot that is ideal for people who value atmosphere over hype.',
    guidance:
      'Explain who would appreciate it, when they should go, and what makes it special.',
    version: DEFAULT_CREATOR_ONBOARDING_PROMPT_VERSION,
    defaultIsPublic: DEFAULT_CREATOR_ONBOARDING_IS_PUBLIC,
    minimumAnswerLength: CREATOR_ONBOARDING_MIN_ANSWER_LENGTH,
    maximumAnswerLength: CREATOR_ONBOARDING_MAX_ANSWER_LENGTH,
  },
] as const satisfies readonly CreatorOnboardingPromptDefinition[]

/**
 * O(1) lookup used by API routes and database services.
 *
 * Example:
 *
 * const prompt = CREATOR_ONBOARDING_PROMPT_BY_KEY[input.prompt_key]
 */
export const CREATOR_ONBOARDING_PROMPT_BY_KEY = Object.freeze(
  Object.fromEntries(
    CREATOR_ONBOARDING_PROMPTS.map((prompt) => [prompt.key, prompt])
  )
) as Readonly<
  Record<CreatorOnboardingPromptKey, CreatorOnboardingPromptDefinition>
>

/**
 * Runtime prompt-key guard for untrusted API input.
 */
export function isCreatorOnboardingPromptKey(
  value: unknown
): value is CreatorOnboardingPromptKey {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(CREATOR_ONBOARDING_PROMPT_BY_KEY, value)
  )
}

/**
 * Returns a canonical prompt definition for untrusted input.
 */
export function getCreatorOnboardingPrompt(
  value: unknown
): CreatorOnboardingPromptDefinition | null {
  if (!isCreatorOnboardingPromptKey(value)) {
    return null
  }

  return CREATOR_ONBOARDING_PROMPT_BY_KEY[value]
}

/**
 * Returns the canonical zero-based display position for a prompt.
 */
export function getCreatorOnboardingPromptIndex(
  key: CreatorOnboardingPromptKey
): number {
  return CREATOR_ONBOARDING_PROMPTS.findIndex((prompt) => prompt.key === key)
}

/**
 * Returns the canonical one-based step number shown in the UI.
 */
export function getCreatorOnboardingPromptStep(
  key: CreatorOnboardingPromptKey
): number {
  const index = getCreatorOnboardingPromptIndex(key)

  if (index < 0) {
    throw new Error(`Unknown creator onboarding prompt key: ${key}`)
  }

  return index + 1
}