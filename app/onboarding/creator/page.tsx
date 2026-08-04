// app/onboarding/creator/page.tsx

'use client'

import type {
  FormEvent,
  ReactNode,
} from 'react'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'

import {
  CREATOR_ONBOARDING_MAX_ANSWER_LENGTH,
  CREATOR_ONBOARDING_PROMPTS,
  MIN_CONFIRMED_CREATOR_ONBOARDING_ANSWERS,
} from '@/lib/creator-onboarding/constants'

import type {
  CreatorOnboardingPromptKey,
} from '@/lib/creator-onboarding/constants'

import type {
  CompleteCreatorOnboardingResponse,
  CreatorOnboardingAnswer,
  CreatorOnboardingState,
  GetCreatorOnboardingResponse,
  JsonObject,
  SaveCreatorOnboardingAnswerResponse,
} from '@/lib/creator-onboarding/types'

type SaveStatus =
  | 'idle'
  | 'dirty'
  | 'saving'
  | 'saved'
  | 'error'

type CreatorInterviewAnswer = {
  promptKey: CreatorOnboardingPromptKey
  answerText: string
  answerMetadata: JsonObject
  answerConfirmed: boolean
  isPublic: boolean

  persistedAnswerText: string
  persistedIsPublic: boolean
  persistedConfirmed: boolean

  saveStatus: SaveStatus
  saveError: string | null
}

const CREATOR_ONBOARDING_API =
  '/api/creator/onboarding'

const CREATOR_ONBOARDING_COMPLETE_API =
  '/api/creator/onboarding/complete'

function createInitialAnswers(): CreatorInterviewAnswer[] {
  return CREATOR_ONBOARDING_PROMPTS.map((prompt) => ({
    promptKey: prompt.key,
    answerText: '',
    answerMetadata: {},
    answerConfirmed: false,
    isPublic: prompt.defaultIsPublic,

    persistedAnswerText: '',
    persistedIsPublic: prompt.defaultIsPublic,
    persistedConfirmed: false,

    saveStatus: 'idle',
    saveError: null,
  }))
}

function mapSavedAnswer(
  answer: CreatorOnboardingAnswer
): CreatorInterviewAnswer {
  return {
    promptKey: answer.promptKey,
    answerText: answer.answerText,
    answerMetadata: answer.answerMetadata,
    answerConfirmed: answer.answerConfirmed,
    isPublic: answer.isPublic,

    persistedAnswerText: answer.answerText,
    persistedIsPublic: answer.isPublic,
    persistedConfirmed: answer.answerConfirmed,

    saveStatus: 'saved',
    saveError: null,
  }
}

function mergeSavedAnswers(
  onboarding: CreatorOnboardingState
): CreatorInterviewAnswer[] {
  const savedByPrompt = new Map(
    onboarding.answers.map((answer) => [
      answer.promptKey,
      answer,
    ])
  )

  return CREATOR_ONBOARDING_PROMPTS.map((prompt) => {
    const saved = savedByPrompt.get(prompt.key)

    if (!saved) {
      return {
        promptKey: prompt.key,
        answerText: '',
        answerMetadata: {},
        answerConfirmed: false,
        isPublic: prompt.defaultIsPublic,

        persistedAnswerText: '',
        persistedIsPublic: prompt.defaultIsPublic,
        persistedConfirmed: false,

        saveStatus: 'idle',
        saveError: null,
      }
    }

    return mapSavedAnswer(saved)
  })
}

function normalizeComparableText(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
}

function isAnswerDirty(
  answer: CreatorInterviewAnswer
): boolean {
  return (
    normalizeComparableText(answer.answerText) !==
      normalizeComparableText(answer.persistedAnswerText) ||
    answer.isPublic !== answer.persistedIsPublic ||
    answer.answerConfirmed !== answer.persistedConfirmed
  )
}

function getApiErrorMessage(
  value: unknown,
  fallback: string
): string {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return fallback
  }

  const record = value as Record<string, unknown>

  if (
    typeof record.error === 'string' &&
    record.error.trim()
  ) {
    return record.error.trim()
  }

  return fallback
}

export default function CreatorOnboardingPage() {
  const router = useRouter()

  const [answers, setAnswers] = useState<
    CreatorInterviewAnswer[]
  >(createInitialAnswers)

  const [activeIndex, setActiveIndex] =
    useState(0)

  const [isLoading, setIsLoading] =
    useState(true)

  const [isCompleting, setIsCompleting] =
    useState(false)

  const [pageError, setPageError] =
    useState<string | null>(null)

  const [statusMessage, setStatusMessage] =
    useState<string | null>(null)

  const activePrompt =
    CREATOR_ONBOARDING_PROMPTS[activeIndex]

  const activeAnswer =
    answers[activeIndex]

  const answeredCount = answers.filter(
    (answer) =>
      answer.answerText.trim().length > 0
  ).length

  const confirmedCount = answers.filter(
    (answer) => answer.answerConfirmed
  ).length

  const progressPercent = Math.min(
    100,
    Math.round(
      (confirmedCount /
        CREATOR_ONBOARDING_PROMPTS.length) *
        100
    )
  )

  const canComplete =
    confirmedCount >=
    MIN_CONFIRMED_CREATOR_ONBOARDING_ANSWERS

  const currentStepLabel = useMemo(
    () =>
      `${activeIndex + 1} of ${
        CREATOR_ONBOARDING_PROMPTS.length
      }`,
    [activeIndex]
  )

  const loadOnboarding = useCallback(async () => {
    setIsLoading(true)
    setPageError(null)

    try {
      const response = await fetch(
        CREATOR_ONBOARDING_API,
        {
          method: 'GET',
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
          },
        }
      )

      const json = (await response
        .json()
        .catch(
          () => null
        )) as GetCreatorOnboardingResponse | null

      if (
        !response.ok ||
        !json ||
        json.success !== true
      ) {
        throw new Error(
          getApiErrorMessage(
            json,
            'Creator onboarding could not be loaded.'
          )
        )
      }

      if (json.onboarding.isComplete) {
        router.replace('/profile/creator')
        router.refresh()
        return
      }

      const nextAnswers = mergeSavedAnswers(
        json.onboarding
      )

      setAnswers(nextAnswers)

      const firstIncompleteIndex =
        nextAnswers.findIndex(
          (answer) =>
            !answer.answerConfirmed
        )

      setActiveIndex(
        firstIncompleteIndex >= 0
          ? firstIncompleteIndex
          : 0
      )
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : 'Creator onboarding could not be loaded.'
      )
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    void loadOnboarding()
  }, [loadOnboarding])

  function updateAnswerAtIndex(
    index: number,
    updater: (
      answer: CreatorInterviewAnswer
    ) => CreatorInterviewAnswer
  ) {
    setAnswers((current) =>
      current.map((answer, answerIndex) =>
        answerIndex === index
          ? updater(answer)
          : answer
      )
    )
  }

  function updateActiveAnswer(
    updater: (
      answer: CreatorInterviewAnswer
    ) => CreatorInterviewAnswer
  ) {
    updateAnswerAtIndex(activeIndex, updater)
  }

  function setAnswerText(value: string) {
    updateActiveAnswer((answer) => {
      const changed =
        normalizeComparableText(value) !==
        normalizeComparableText(
          answer.persistedAnswerText
        )

      return {
        ...answer,
        answerText: value,

        // Editing source knowledge revokes local confirmation.
        answerConfirmed: changed
          ? false
          : answer.persistedConfirmed,

        saveStatus: changed
          ? 'dirty'
          : 'saved',

        saveError: null,
      }
    })

    setPageError(null)
    setStatusMessage(null)
  }

  function setAnswerVisibility(
    isPublic: boolean
  ) {
    updateActiveAnswer((answer) => ({
      ...answer,
      isPublic,
      saveStatus: 'dirty',
      saveError: null,
    }))

    setPageError(null)
    setStatusMessage(null)
  }

  async function persistAnswer({
    index,
    confirm,
  }: {
    index: number
    confirm: boolean
  }): Promise<CreatorInterviewAnswer | null> {
    const answer = answers[index]
    const prompt =
      CREATOR_ONBOARDING_PROMPTS[index]

    if (!answer || !prompt) {
      return null
    }

    const normalizedAnswer =
      answer.answerText.trim()

    if (!normalizedAnswer) {
      updateAnswerAtIndex(index, (current) => ({
        ...current,
        saveStatus: 'error',
        saveError:
          'Write an answer before saving.',
      }))

      return null
    }

    if (
      normalizedAnswer.length <
      prompt.minimumAnswerLength
    ) {
      updateAnswerAtIndex(index, (current) => ({
        ...current,
        saveStatus: 'error',
        saveError:
          `Write at least ${prompt.minimumAnswerLength} characters before saving.`,
      }))

      return null
    }

    if (
      normalizedAnswer.length >
      prompt.maximumAnswerLength
    ) {
      updateAnswerAtIndex(index, (current) => ({
        ...current,
        saveStatus: 'error',
        saveError:
          `Answers may not exceed ${prompt.maximumAnswerLength} characters.`,
      }))

      return null
    }

    updateAnswerAtIndex(index, (current) => ({
      ...current,
      saveStatus: 'saving',
      saveError: null,
    }))

    setPageError(null)

    try {
      const firstSave = await saveAnswerRequest({
        promptKey: answer.promptKey,
        answerText: normalizedAnswer,
        answerMetadata: answer.answerMetadata,
        answerConfirmed: confirm,
        isPublic: answer.isPublic,
      })

      let savedAnswer = firstSave.answer

      /**
       * The service intentionally revokes confirmation when source text
       * changes. In that case, submit a second request with the now-persisted
       * text to record explicit creator confirmation.
       */
      if (
        confirm &&
        !savedAnswer.answerConfirmed
      ) {
        const confirmationSave =
          await saveAnswerRequest({
            promptKey: answer.promptKey,
            answerText:
              savedAnswer.answerText,
            answerMetadata:
              savedAnswer.answerMetadata,
            answerConfirmed: true,
            isPublic:
              savedAnswer.isPublic,
          })

        savedAnswer =
          confirmationSave.answer
      }

      const nextAnswer =
        mapSavedAnswer(savedAnswer)

      updateAnswerAtIndex(
        index,
        () => nextAnswer
      )

      setStatusMessage(
        confirm
          ? 'Answer confirmed and saved.'
          : 'Draft saved.'
      )

      window.setTimeout(() => {
        setStatusMessage(null)
      }, 2400)

      return nextAnswer
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'This answer could not be saved.'

      updateAnswerAtIndex(index, (current) => ({
        ...current,
        saveStatus: 'error',
        saveError: message,
      }))

      return null
    }
  }

  async function saveAnswerRequest({
    promptKey,
    answerText,
    answerMetadata,
    answerConfirmed,
    isPublic,
  }: {
    promptKey: CreatorOnboardingPromptKey
    answerText: string
    answerMetadata: JsonObject
    answerConfirmed: boolean
    isPublic: boolean
  }): Promise<{
    answer: CreatorOnboardingAnswer
  }> {
    const response = await fetch(
      CREATOR_ONBOARDING_API,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          promptKey,
          answerText,
          answerMetadata,
          answerConfirmed,
          isPublic,
        }),
      }
    )

    const json = (await response
      .json()
      .catch(
        () => null
      )) as SaveCreatorOnboardingAnswerResponse | null

    if (
      !response.ok ||
      !json ||
      json.success !== true
    ) {
      throw new Error(
        getApiErrorMessage(
          json,
          'This answer could not be saved.'
        )
      )
    }

    return {
      answer: json.answer,
    }
  }

  async function handleSaveDraft() {
    await persistAnswer({
      index: activeIndex,
      confirm: false,
    })
  }

  async function handleConfirmAnswer() {
    const saved = await persistAnswer({
      index: activeIndex,
      confirm: true,
    })

    if (
      saved?.answerConfirmed &&
      activeIndex <
        CREATOR_ONBOARDING_PROMPTS.length -
          1
    ) {
      setActiveIndex(
        (current) => current + 1
      )
    }
  }

  async function navigateToPrompt(
    nextIndex: number
  ) {
    if (
      nextIndex < 0 ||
      nextIndex >=
        CREATOR_ONBOARDING_PROMPTS.length
    ) {
      return
    }

    const currentAnswer = answers[activeIndex]

    if (
      currentAnswer.answerText.trim() &&
      isAnswerDirty(currentAnswer)
    ) {
      const saved = await persistAnswer({
        index: activeIndex,
        confirm: false,
      })

      if (!saved) {
        return
      }
    }

    setActiveIndex(nextIndex)
    setPageError(null)
    setStatusMessage(null)
  }

  async function handleComplete(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (!canComplete) {
      setPageError(
        `Confirm at least ${MIN_CONFIRMED_CREATOR_ONBOARDING_ANSWERS} answers before completing creator onboarding.`
      )
      return
    }

    const dirtyConfirmedAnswer =
      answers.findIndex(
        (answer) =>
          answer.answerConfirmed &&
          isAnswerDirty(answer)
      )

    if (dirtyConfirmedAnswer >= 0) {
      setPageError(
        'Save your latest answer changes before completing onboarding.'
      )
      setActiveIndex(dirtyConfirmedAnswer)
      return
    }

    setIsCompleting(true)
    setPageError(null)

    try {
      const response = await fetch(
        CREATOR_ONBOARDING_COMPLETE_API,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({}),
        }
      )

      const json = (await response
        .json()
        .catch(
          () => null
        )) as CompleteCreatorOnboardingResponse | null

      if (
        !response.ok ||
        !json ||
        json.success !== true
      ) {
        throw new Error(
          getApiErrorMessage(
            json,
            'Creator onboarding could not be completed.'
          )
        )
      }

      router.replace(json.redirectTo)
      router.refresh()
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : 'Creator onboarding could not be completed.'
      )
    } finally {
      setIsCompleting(false)
    }
  }

  if (
    isLoading ||
    !activePrompt ||
    !activeAnswer
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#05060a] px-4 text-white">
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-6 py-5 text-sm text-neutral-300">
          Loading creator onboarding…
        </div>
      </main>
    )
  }

  const activeAnswerLength =
    activeAnswer.answerText.length

  const activeAnswerIsValid =
    activeAnswer.answerText.trim().length >=
      activePrompt.minimumAnswerLength &&
    activeAnswer.answerText.trim().length <=
      activePrompt.maximumAnswerLength

  const activeAnswerIsSaving =
    activeAnswer.saveStatus === 'saving'

  const remainingRequiredAnswers =
    Math.max(
      0,
      MIN_CONFIRMED_CREATOR_ONBOARDING_ANSWERS -
        confirmedCount
    )

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05060a] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.22),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(99,102,241,0.28),_transparent_34%),linear-gradient(135deg,_#05060a_0%,_#09090f_45%,_#020617_100%)]" />

      <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.7)_1px,transparent_1px)] [background-size:44px_44px]" />

      <div className="relative mx-auto grid min-h-screen w-full max-w-7xl gap-8 px-4 py-24 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
        <aside className="lg:sticky lg:top-24">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.08] p-6 shadow-2xl backdrop-blur-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
              Creator Knowledge Setup
            </p>

            <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight">
              Teach Roam your point of view.
            </h1>

            <p className="mt-4 text-sm leading-7 text-neutral-300">
              Share the places, neighborhoods, and
              experiences that define your perspective.
              These original answers remain yours and can
              later power your Creator Agent only with your
              permission.
            </p>

            <div className="mt-8 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span>Confirmed knowledge</span>

                <span>
                  {confirmedCount}/
                  {CREATOR_ONBOARDING_PROMPTS.length}
                </span>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500 transition-all duration-300"
                  style={{
                    width: `${progressPercent}%`,
                  }}
                />
              </div>

              <p className="mt-3 text-xs leading-5 text-neutral-500">
                {answeredCount} answered ·{' '}
                {confirmedCount} confirmed
              </p>
            </div>

            <div className="mt-6 space-y-2">
              {CREATOR_ONBOARDING_PROMPTS.map(
                (prompt, index) => {
                  const answer = answers[index]
                  const isActive =
                    index === activeIndex

                  return (
                    <button
                      key={prompt.key}
                      type="button"
                      disabled={
                        activeAnswerIsSaving
                      }
                      onClick={() =>
                        void navigateToPrompt(index)
                      }
                      className={[
                        'flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-60',
                        isActive
                          ? 'border-cyan-300/50 bg-cyan-400/10 text-white'
                          : 'border-white/10 bg-black/20 text-neutral-400 hover:border-white/20 hover:text-white',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                          answer.answerConfirmed
                            ? 'bg-emerald-400 text-black'
                            : answer.answerText.trim()
                                .length > 0
                              ? 'bg-indigo-400 text-black'
                              : 'bg-white/10 text-neutral-500',
                        ].join(' ')}
                      >
                        {answer.answerConfirmed
                          ? '✓'
                          : index + 1}
                      </span>

                      <span className="min-w-0">
                        <span className="line-clamp-1 block font-medium">
                          {prompt.title}
                        </span>

                        {answer.saveStatus ===
                        'dirty' ? (
                          <span className="mt-0.5 block text-[11px] text-amber-300">
                            Unsaved changes
                          </span>
                        ) : null}

                        {answer.saveStatus ===
                        'saving' ? (
                          <span className="mt-0.5 block text-[11px] text-cyan-300">
                            Saving…
                          </span>
                        ) : null}
                      </span>
                    </button>
                  )
                }
              )}
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          {pageError ? (
            <div
              role="alert"
              className="mb-5 rounded-2xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200"
            >
              {pageError}
            </div>
          ) : null}

          {statusMessage ? (
            <div
              role="status"
              className="mb-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
            >
              {statusMessage}
            </div>
          ) : null}

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.08] p-5 shadow-2xl backdrop-blur-xl sm:p-8">
            <div className="flex flex-col gap-5 border-b border-white/10 pb-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-cyan-300">
                  {activePrompt.eyebrow}
                </p>

                <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
                  {activePrompt.title}
                </h2>

                <p className="mt-3 max-w-2xl text-sm leading-7 text-neutral-400">
                  {activePrompt.guidance}
                </p>
              </div>

              <span className="w-fit shrink-0 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs font-semibold text-neutral-400">
                {currentStepLabel}
              </span>
            </div>

            <div className="mt-6 space-y-6">
              <Field label="Your answer">
                <textarea
                  value={activeAnswer.answerText}
                  onChange={(event) =>
                    setAnswerText(event.target.value)
                  }
                  rows={8}
                  maxLength={
                    CREATOR_ONBOARDING_MAX_ANSWER_LENGTH
                  }
                  placeholder={
                    activePrompt.placeholder
                  }
                  className="field-input resize-y leading-7"
                />

                <div className="mt-2 flex items-start justify-between gap-4 text-xs text-neutral-500">
                  <span>
                    Write naturally and be specific.
                    Roam preserves this original answer as
                    your source material.
                  </span>

                  <span className="shrink-0">
                    {activeAnswerLength}/
                    {
                      activePrompt.maximumAnswerLength
                    }
                  </span>
                </div>
              </Field>

              <section className="rounded-[1.5rem] border border-white/10 bg-black/25 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                      Knowledge visibility
                    </p>

                    <h3 className="mt-2 text-base font-bold text-white">
                      Allow future public use
                    </h3>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
                      Public answers may later support your
                      public creator profile or Creator Agent.
                      Private answers remain visible only to
                      you and still count toward onboarding.
                    </p>
                  </div>

                  <label className="flex w-fit cursor-pointer items-center gap-3 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2.5 text-xs font-semibold text-neutral-300">
                    <input
                      type="checkbox"
                      checked={activeAnswer.isPublic}
                      onChange={(event) =>
                        setAnswerVisibility(
                          event.target.checked
                        )
                      }
                      className="h-4 w-4 accent-cyan-400"
                    />

                    {activeAnswer.isPublic
                      ? 'Public eligible'
                      : 'Private'}
                  </label>
                </div>
              </section>

              {activeAnswer.saveError ? (
                <p
                  role="alert"
                  className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200"
                >
                  {activeAnswer.saveError}
                </p>
              ) : null}

              {activeAnswer.answerConfirmed ? (
                <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
                  ✓ You confirmed this answer as accurate
                  and intentional.
                </div>
              ) : activeAnswer.persistedConfirmed ? (
                <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                  This answer was previously confirmed, but
                  your new edits must be reviewed and
                  confirmed again.
                </div>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  disabled={
                    !activeAnswerIsValid ||
                    activeAnswerIsSaving
                  }
                  onClick={() =>
                    void handleSaveDraft()
                  }
                  className="inline-flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3.5 text-sm font-bold text-neutral-200 transition hover:border-white/20 hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {activeAnswerIsSaving
                    ? 'Saving…'
                    : 'Save draft'}
                </button>

                <button
                  type="button"
                  disabled={
                    !activeAnswerIsValid ||
                    activeAnswerIsSaving
                  }
                  onClick={() =>
                    void handleConfirmAnswer()
                  }
                  className="inline-flex flex-[1.4] items-center justify-center rounded-2xl bg-emerald-400 px-5 py-3.5 text-sm font-black text-black transition hover:-translate-y-0.5 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {activeAnswerIsSaving
                    ? 'Saving…'
                    : activeAnswer.answerConfirmed
                      ? 'Save confirmed answer'
                      : 'Confirm and continue →'}
                </button>
              </div>

              <div className="flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  disabled={
                    activeIndex === 0 ||
                    activeAnswerIsSaving
                  }
                  onClick={() =>
                    void navigateToPrompt(
                      activeIndex - 1
                    )
                  }
                  className="inline-flex items-center justify-center rounded-full border border-white/10 bg-black/25 px-5 py-2.5 text-sm font-semibold text-neutral-300 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ← Previous
                </button>

                <button
                  type="button"
                  disabled={
                    activeIndex ===
                      CREATOR_ONBOARDING_PROMPTS.length -
                        1 ||
                    activeAnswerIsSaving
                  }
                  onClick={() =>
                    void navigateToPrompt(
                      activeIndex + 1
                    )
                  }
                  className="inline-flex items-center justify-center rounded-full border border-white/10 bg-black/25 px-5 py-2.5 text-sm font-semibold text-neutral-300 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleComplete}
            className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.07] p-5 shadow-xl backdrop-blur-xl sm:p-6"
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
                  Complete onboarding
                </p>

                <p className="mt-2 text-sm leading-6 text-neutral-300">
                  {canComplete
                    ? 'You have confirmed enough knowledge to complete your initial creator profile.'
                    : `Confirm ${remainingRequiredAnswers} more ${
                        remainingRequiredAnswers === 1
                          ? 'answer'
                          : 'answers'
                      } to complete creator onboarding.`}
                </p>
              </div>

              <button
                type="submit"
                disabled={
                  !canComplete ||
                  isCompleting ||
                  activeAnswerIsSaving
                }
                className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-6 py-4 text-sm font-black text-white shadow-lg shadow-cyan-500/20 transition hover:-translate-y-0.5 hover:from-cyan-400 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCompleting
                  ? 'Completing setup…'
                  : 'Finish Creator Setup →'}
              </button>
            </div>
          </form>
        </section>
      </div>

      <style jsx>{`
        .field-input {
          width: 100%;
          border-radius: 0.875rem;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(0, 0, 0, 0.34);
          padding: 0.85rem 0.95rem;
          color: white;
          outline: none;
          transition:
            border-color 160ms ease,
            box-shadow 160ms ease;
        }

        .field-input:focus {
          border-color: rgba(34, 211, 238, 0.8);
          box-shadow: 0 0 0 3px
            rgba(34, 211, 238, 0.14);
        }

        .field-input::placeholder {
          color: rgba(212, 212, 216, 0.48);
        }
      `}</style>
    </main>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-neutral-200">
        {label}
      </label>

      {children}
    </div>
  )
}