'use client'

import {
  useMemo,
  useState,
} from 'react'

import Link from 'next/link'

import {
  CREATOR_ONBOARDING_PROMPTS,
  MIN_CONFIRMED_CREATOR_ONBOARDING_ANSWERS,
  type CreatorOnboardingPromptKey,
} from '@/lib/creator-onboarding/constants'

import type {
  CreatorOnboardingAnswer,
  CreatorOnboardingState,
  JsonObject,
  SaveCreatorOnboardingAnswerResponse,
} from '@/lib/creator-onboarding/types'

type EditableAnswer = {
  id: string | null
  promptKey: CreatorOnboardingPromptKey
  answerText: string
  answerMetadata: JsonObject
  answerConfirmed: boolean
  isPublic: boolean

  persistedAnswerText: string
  persistedIsPublic: boolean
  persistedAnswerConfirmed: boolean

  saveStatus:
    | 'idle'
    | 'dirty'
    | 'saving'
    | 'saved'
    | 'error'

  saveError: string | null
}

type Props = {
  initialOnboarding: CreatorOnboardingState | null
}

function normalizeComparableText(
  value: string
) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
}

function createEditableAnswers(
  onboarding: CreatorOnboardingState | null
): EditableAnswer[] {
  const savedByPrompt = new Map(
    onboarding?.answers.map(
      (answer) => [
        answer.promptKey,
        answer,
      ]
    ) ?? []
  )

  return CREATOR_ONBOARDING_PROMPTS.map(
    (prompt) => {
      const saved =
        savedByPrompt.get(prompt.key)

      if (!saved) {
        return {
          id: null,
          promptKey: prompt.key,
          answerText: '',
          answerMetadata: {},
          answerConfirmed: false,
          isPublic:
            prompt.defaultIsPublic,

          persistedAnswerText: '',
          persistedIsPublic:
            prompt.defaultIsPublic,
          persistedAnswerConfirmed:
            false,

          saveStatus: 'idle',
          saveError: null,
        }
      }

      return mapSavedAnswer(saved)
    }
  )
}

function mapSavedAnswer(
  answer: CreatorOnboardingAnswer
): EditableAnswer {
  return {
    id: answer.id,
    promptKey:
      answer.promptKey,
    answerText:
      answer.answerText,
    answerMetadata:
      answer.answerMetadata,
    answerConfirmed:
      answer.answerConfirmed,
    isPublic:
      answer.isPublic,

    persistedAnswerText:
      answer.answerText,
    persistedIsPublic:
      answer.isPublic,
    persistedAnswerConfirmed:
      answer.answerConfirmed,

    saveStatus: 'saved',
    saveError: null,
  }
}

function getErrorMessage(
  value: unknown,
  fallback: string
) {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return fallback
  }

  const record =
    value as Record<
      string,
      unknown
    >

  if (
    typeof record.error ===
      'string' &&
    record.error.trim()
  ) {
    return record.error.trim()
  }

  return fallback
}

export default function CreatorKnowledgeAnswersEditor({
  initialOnboarding,
}: Props) {
  const [
    answers,
    setAnswers,
  ] = useState<
    EditableAnswer[]
  >(() =>
    createEditableAnswers(
      initialOnboarding
    )
  )

  const [
    expandedPromptKey,
    setExpandedPromptKey,
  ] = useState<
    CreatorOnboardingPromptKey | null
  >(
    () =>
      initialOnboarding
        ?.answers[0]
        ?.promptKey ??
      null
  )

  const [
    globalMessage,
    setGlobalMessage,
  ] = useState<
    string | null
  >(null)

  const confirmedCount =
    answers.filter(
      (answer) =>
        answer.answerConfirmed
    ).length

  const answeredCount =
    answers.filter(
      (answer) =>
        answer.answerText
          .trim()
          .length > 0
    ).length

  const completionPercent =
    Math.min(
      100,
      Math.round(
        (
          confirmedCount /
          CREATOR_ONBOARDING_PROMPTS.length
        ) *
          100
      )
    )

  const promptByKey =
    useMemo(
      () =>
        new Map(
          CREATOR_ONBOARDING_PROMPTS.map(
            (prompt) => [
              prompt.key,
              prompt,
            ]
          )
        ),
      []
    )

  function updateAnswer(
    promptKey:
      CreatorOnboardingPromptKey,
    updater: (
      answer: EditableAnswer
    ) => EditableAnswer
  ) {
    setAnswers(
      (current) =>
        current.map(
          (answer) =>
            answer.promptKey ===
            promptKey
              ? updater(answer)
              : answer
        )
    )
  }

  function updateAnswerText(
    promptKey:
      CreatorOnboardingPromptKey,
    value: string
  ) {
    updateAnswer(
      promptKey,
      (answer) => {
        const changed =
          normalizeComparableText(
            value
          ) !==
          normalizeComparableText(
            answer.persistedAnswerText
          )

        return {
          ...answer,
          answerText: value,

          answerConfirmed:
            changed
              ? false
              : answer
                  .persistedAnswerConfirmed,

          saveStatus:
            changed
              ? 'dirty'
              : 'saved',

          saveError: null,
        }
      }
    )

    setGlobalMessage(null)
  }

  function updateVisibility(
    promptKey:
      CreatorOnboardingPromptKey,
    isPublic: boolean
  ) {
    updateAnswer(
      promptKey,
      (answer) => ({
        ...answer,
        isPublic,
        saveStatus: 'dirty',
        saveError: null,
      })
    )

    setGlobalMessage(null)
  }

  async function saveAnswer({
    promptKey,
    confirm,
  }: {
    promptKey:
      CreatorOnboardingPromptKey
    confirm: boolean
  }) {
    const answer =
      answers.find(
        (item) =>
          item.promptKey ===
          promptKey
      )

    const prompt =
      promptByKey.get(
        promptKey
      )

    if (!answer || !prompt) {
      return
    }

    const normalizedAnswer =
      answer.answerText.trim()

    if (
      normalizedAnswer.length <
      prompt.minimumAnswerLength
    ) {
      updateAnswer(
        promptKey,
        (current) => ({
          ...current,
          saveStatus: 'error',
          saveError:
            `Write at least ${prompt.minimumAnswerLength} characters before saving.`,
        })
      )

      return
    }

    if (
      normalizedAnswer.length >
      prompt.maximumAnswerLength
    ) {
      updateAnswer(
        promptKey,
        (current) => ({
          ...current,
          saveStatus: 'error',
          saveError:
            `Answers may not exceed ${prompt.maximumAnswerLength} characters.`,
        })
      )

      return
    }

    updateAnswer(
      promptKey,
      (current) => ({
        ...current,
        saveStatus: 'saving',
        saveError: null,
      })
    )

    setGlobalMessage(null)

    try {
      let saved =
        await saveAnswerRequest({
          promptKey,
          answerText:
            normalizedAnswer,
          answerMetadata:
            answer.answerMetadata,
          answerConfirmed:
            confirm,
          isPublic:
            answer.isPublic,
        })

      /**
       * Editing the source answer intentionally revokes
       * confirmation on the first write. Confirm the newly
       * persisted text through a second explicit write.
       */
      if (
        confirm &&
        !saved.answerConfirmed
      ) {
        saved =
          await saveAnswerRequest({
            promptKey,
            answerText:
              saved.answerText,
            answerMetadata:
              saved.answerMetadata,
            answerConfirmed:
              true,
            isPublic:
              saved.isPublic,
          })
      }

      updateAnswer(
        promptKey,
        () =>
          mapSavedAnswer(
            saved
          )
      )

      setGlobalMessage(
        confirm
          ? 'Knowledge answer confirmed and saved.'
          : 'Knowledge answer saved.'
      )
    } catch (error) {
      updateAnswer(
        promptKey,
        (current) => ({
          ...current,
          saveStatus: 'error',
          saveError:
            error instanceof Error
              ? error.message
              : 'This answer could not be saved.',
        })
      )
    }
  }

  async function saveAnswerRequest({
    promptKey,
    answerText,
    answerMetadata,
    answerConfirmed,
    isPublic,
  }: {
    promptKey:
      CreatorOnboardingPromptKey
    answerText: string
    answerMetadata:
      JsonObject
    answerConfirmed:
      boolean
    isPublic: boolean
  }): Promise<CreatorOnboardingAnswer> {
    const response =
      await fetch(
        '/api/creator/onboarding',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
            Accept:
              'application/json',
          },
          body:
            JSON.stringify({
              promptKey,
              answerText,
              answerMetadata,
              answerConfirmed,
              isPublic,
            }),
        }
      )

    const json =
      (await response
        .json()
        .catch(
          () => null
        )) as
        | SaveCreatorOnboardingAnswerResponse
        | null

    if (
      !response.ok ||
      !json ||
      json.success !== true
    ) {
      throw new Error(
        getErrorMessage(
          json,
          'This answer could not be saved.'
        )
      )
    }

    return json.answer
  }

  return (
    <section className="relative w-full min-w-0 overflow-hidden rounded-[1.75rem] border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.06] via-neutral-950 to-black shadow-2xl shadow-black/20 sm:rounded-[2rem]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent"
      />

      <div className="relative z-10 border-b border-neutral-800/80 px-4 py-5 sm:px-6">
        <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">
              Creator knowledge
            </p>

            <p className="mt-1 max-w-2xl text-xs leading-5 text-neutral-500">
              Keep the answers that define
              your local perspective accurate,
              useful, and intentional.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-neutral-800 bg-black/35 px-4 py-3">
            <div>
              <p className="text-lg font-semibold leading-none text-white">
                {confirmedCount}/
                {
                  CREATOR_ONBOARDING_PROMPTS.length
                }
              </p>

              <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                Confirmed
              </p>
            </div>

            <div
              className="relative h-10 w-10 shrink-0 rounded-full"
              style={{
                background:
                  `conic-gradient(rgb(34 211 238) ${completionPercent}%, rgb(38 38 38) ${completionPercent}% 100%)`,
              }}
              aria-label={`${completionPercent}% confirmed`}
            >
              <div className="absolute inset-[4px] flex items-center justify-center rounded-full bg-black text-[9px] font-semibold text-neutral-300">
                {completionPercent}%
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex min-w-0 flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-neutral-800 bg-black/30 px-3 py-1.5 text-neutral-400">
            {answeredCount}{' '}
            answered
          </span>

          <span className="rounded-full border border-neutral-800 bg-black/30 px-3 py-1.5 text-neutral-400">
            {confirmedCount}{' '}
            confirmed
          </span>

          {confirmedCount >=
          MIN_CONFIRMED_CREATOR_ONBOARDING_ANSWERS ? (
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-emerald-300">
              Initial knowledge complete
            </span>
          ) : (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-amber-200">
              Confirm{' '}
              {Math.max(
                0,
                MIN_CONFIRMED_CREATOR_ONBOARDING_ANSWERS -
                  confirmedCount
              )}{' '}
              more
            </span>
          )}
        </div>
      </div>

      <div className="relative z-10 p-3 sm:p-5">
        {globalMessage ? (
          <div
            role="status"
            className="mb-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
          >
            {globalMessage}
          </div>
        ) : null}

        {answeredCount === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-700 bg-black/25 p-5">
            <p className="text-sm font-semibold text-white">
              Your creator knowledge interview
              is not started.
            </p>

            <p className="mt-2 max-w-xl text-xs leading-5 text-neutral-500">
              Answer a few high-signal
              questions so Roam can preserve
              your recommendations, routines,
              and local perspective.
            </p>

            <Link
              href="/onboarding/creator"
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-200 transition hover:border-cyan-400/60 hover:bg-cyan-500/20 hover:text-white"
            >
              Start creator interview
              <span
                aria-hidden="true"
                className="ml-2"
              >
                →
              </span>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {CREATOR_ONBOARDING_PROMPTS.map(
              (prompt) => {
                const answer =
                  answers.find(
                    (item) =>
                      item.promptKey ===
                      prompt.key
                  )

                if (!answer) {
                  return null
                }

                const isExpanded =
                  expandedPromptKey ===
                  prompt.key

                const isSaving =
                  answer.saveStatus ===
                  'saving'

                return (
                  <article
                    key={
                      prompt.key
                    }
                    className="overflow-hidden rounded-2xl border border-neutral-800 bg-black/25"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedPromptKey(
                          isExpanded
                            ? null
                            : prompt.key
                        )
                      }
                      aria-expanded={
                        isExpanded
                      }
                      className="flex w-full min-w-0 items-start justify-between gap-4 px-4 py-4 text-left transition hover:bg-white/[0.025] sm:px-5"
                    >
                      <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400">
                            {
                              prompt.eyebrow
                            }
                          </p>

                          {answer.answerConfirmed ? (
                            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-300">
                              Confirmed
                            </span>
                          ) : null}

                          <span
                            className={[
                              'rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em]',
                              answer.isPublic
                                ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-200'
                                : 'border-neutral-700 bg-neutral-900 text-neutral-500',
                            ].join(
                              ' '
                            )}
                          >
                            {answer.isPublic
                              ? 'Public eligible'
                              : 'Private'}
                          </span>
                        </div>

                        <h3 className="mt-2 text-sm font-semibold text-white sm:text-base">
                          {
                            prompt.title
                          }
                        </h3>

                        {!isExpanded &&
                        answer.answerText ? (
                          <p className="mt-2 line-clamp-2 text-xs leading-5 text-neutral-500">
                            {
                              answer.answerText
                            }
                          </p>
                        ) : null}
                      </div>

                      <span
                        aria-hidden="true"
                        className={[
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-800 bg-neutral-950 text-neutral-400 transition',
                          isExpanded
                            ? 'rotate-45 border-cyan-500/30 text-cyan-300'
                            : '',
                        ].join(
                          ' '
                        )}
                      >
                        +
                      </span>
                    </button>

                    {isExpanded ? (
                      <div className="border-t border-neutral-800/80 px-4 py-5 sm:px-5">
                        <p className="text-xs leading-5 text-neutral-500">
                          {
                            prompt.guidance
                          }
                        </p>

                        <textarea
                          value={
                            answer.answerText
                          }
                          onChange={(
                            event
                          ) =>
                            updateAnswerText(
                              prompt.key,
                              event.target
                                .value
                            )
                          }
                          rows={6}
                          maxLength={
                            prompt.maximumAnswerLength
                          }
                          placeholder={
                            prompt.placeholder
                          }
                          className="mt-4 w-full resize-y rounded-2xl border border-neutral-800 bg-black/50 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-neutral-700 focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/10"
                        />

                        <div className="mt-2 flex items-start justify-between gap-4 text-[11px] text-neutral-600">
                          <span>
                            Editing your
                            answer requires
                            confirmation again.
                          </span>

                          <span className="shrink-0">
                            {
                              answer
                                .answerText
                                .length
                            }
                            /
                            {
                              prompt.maximumAnswerLength
                            }
                          </span>
                        </div>

                        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-neutral-800 bg-neutral-950/70 p-4">
                          <input
                            type="checkbox"
                            checked={
                              answer.isPublic
                            }
                            onChange={(
                              event
                            ) =>
                              updateVisibility(
                                prompt.key,
                                event.target
                                  .checked
                              )
                            }
                            className="mt-0.5 h-4 w-4 shrink-0 accent-cyan-400"
                          />

                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-neutral-200">
                              Allow future
                              public use
                            </span>

                            <span className="mt-1 block text-xs leading-5 text-neutral-500">
                              Public answers may
                              later support your
                              creator profile or
                              Creator Agent.
                            </span>
                          </span>
                        </label>

                        {answer.saveError ? (
                          <p
                            role="alert"
                            className="mt-4 rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-xs text-red-200"
                          >
                            {
                              answer.saveError
                            }
                          </p>
                        ) : null}

                        {answer.persistedAnswerConfirmed &&
                        !answer.answerConfirmed ? (
                          <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-amber-200">
                            This answer was
                            previously confirmed.
                            Your edits must be
                            confirmed again.
                          </p>
                        ) : null}

                        <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap">
                          <button
                            type="button"
                            disabled={
                              isSaving ||
                              answer.answerText
                                .trim()
                                .length <
                                prompt.minimumAnswerLength
                            }
                            onClick={() =>
                              void saveAnswer({
                                promptKey:
                                  prompt.key,
                                confirm:
                                  false,
                              })
                            }
                            className="inline-flex min-h-11 items-center justify-center rounded-full border border-neutral-700 bg-neutral-950 px-4 py-2.5 text-sm font-medium text-neutral-300 transition hover:border-neutral-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isSaving
                              ? 'Saving…'
                              : 'Save draft'}
                          </button>

                          <button
                            type="button"
                            disabled={
                              isSaving ||
                              answer.answerText
                                .trim()
                                .length <
                                prompt.minimumAnswerLength
                            }
                            onClick={() =>
                              void saveAnswer({
                                promptKey:
                                  prompt.key,
                                confirm:
                                  true,
                              })
                            }
                            className="inline-flex min-h-11 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-200 transition hover:border-emerald-400/60 hover:bg-emerald-500/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isSaving
                              ? 'Saving…'
                              : answer.answerConfirmed
                                ? 'Save confirmed answer'
                                : 'Confirm answer'}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                )
              }
            )}
          </div>
        )}
      </div>
    </section>
  )
}