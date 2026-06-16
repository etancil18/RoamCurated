'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const VIBE_OPTIONS = [
  'rooftops',
  'cocktails',
  'coffee',
  'live music',
  'art',
  'fitness',
  'food',
  'hidden gems',
  'networking',
  'wellness',
]

const INTEREST_OPTIONS = [
  'restaurants',
  'bars',
  'events',
  'social sports',
  'music',
  'art',
  'fitness',
  'networking',
  'dating',
  'new friends',
]

const DAY_OPTIONS = [
  'weekdays',
  'fridays',
  'saturdays',
  'sundays',
]

export default function OnboardingProfilePage() {
  const router = useRouter()

  const [form, setForm] = useState({
    full_name: '',
    username: '',
    instagram_handle: '',
    age_range: '',
    home_neighborhood: '',
    preferred_vibes: [] as string[],
    interest_categories: [] as string[],
    frequency: '',
    crawl_type: '',
    days_out: [] as string[],
    intent_level: '',
    personality_style: '',
    social_comfort: '',
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function normalizeUsername(value: string) {
    return value
      .toLowerCase()
      .replace(/^@+/, '')
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 30)
  }

  function toggleArrayField(
    field: 'preferred_vibes' | 'interest_categories' | 'days_out',
    value: string
  ) {
    setForm((prev) => {
      const current = prev[field]
      const next = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]

      return {
        ...prev,
        [field]: next,
      }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (form.username.trim().length < 3) {
      setError('Username must be at least 3 characters.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/profile/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.details || json.error || 'Failed to save profile')
        return
      }

      router.replace('/profile')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setLoading(false)
    }
  }

  const completedSignals =
    Number(Boolean(form.full_name.trim())) +
    Number(Boolean(form.username.trim())) +
    Number(Boolean(form.home_neighborhood.trim())) +
    Number(form.preferred_vibes.length > 0) +
    Number(form.interest_categories.length > 0) +
    Number(Boolean(form.frequency)) +
    Number(Boolean(form.crawl_type))

  const progressPercent = Math.min(100, Math.round((completedSignals / 7) * 100))

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05060a] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.28),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(99,102,241,0.3),_transparent_34%),linear-gradient(135deg,_#05060a_0%,_#09090f_45%,_#020617_100%)]" />
      <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.7)_1px,transparent_1px)] [background-size:44px_44px]" />

      <div className="relative mx-auto grid min-h-screen max-w-6xl gap-8 px-4 py-24 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <aside className="lg:sticky lg:top-24">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.08] p-6 shadow-2xl backdrop-blur-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
              Roam Passport Setup
            </p>

            <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl">
              Build your city profile.
            </h1>

            <p className="mt-4 text-sm leading-7 text-neutral-300">
              Tell Roam what you like, how you move, and what kind of nights you want.
              Your Passport gets smarter from here.
            </p>

            <div className="mt-8 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="mb-2 flex items-center justify-between text-xs text-neutral-400">
                <span>Profile signal</span>
                <span>{progressPercent}%</span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500 transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            <div className="mt-6 grid gap-3 text-sm text-neutral-300">
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                🎯 Better event and Flow recommendations
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                🧭 Personalized city discovery
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                ⚡ Passport XP and preference tracking
              </div>
            </div>
          </div>
        </aside>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.08] p-5 shadow-2xl backdrop-blur-xl sm:p-8">
          {error && (
            <p className="mb-5 rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            <FormSection eyebrow="Identity" title="Who is this Passport for?">
              <Field label="Full Name">
                <input
                  required
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="field-input"
                  placeholder="Your name"
                />
              </Field>

              <Field label="Username">
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500">
                    @
                  </span>
                  <input
                    required
                    type="text"
                    minLength={3}
                    maxLength={30}
                    value={form.username}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        username: normalizeUsername(e.target.value),
                      })
                    }
                    className="field-input pl-8"
                    placeholder="citycurator"
                  />
                </div>
                <p className="mt-2 text-xs text-neutral-500">
                  3–30 characters. Letters, numbers, and underscores only.
                </p>
              </Field>

              <Field label="Instagram optional">
                <input
                  type="text"
                  value={form.instagram_handle}
                  onChange={(e) =>
                    setForm({ ...form, instagram_handle: e.target.value })
                  }
                  className="field-input"
                  placeholder="@yourhandle"
                />
              </Field>

              <Field label="Home Neighborhood">
                <input
                  type="text"
                  value={form.home_neighborhood}
                  onChange={(e) =>
                    setForm({ ...form, home_neighborhood: e.target.value })
                  }
                  className="field-input"
                  placeholder="Midtown, Buckhead, Williamsburg..."
                />
              </Field>

              <Field label="Age Range">
                <select
                  value={form.age_range}
                  onChange={(e) => setForm({ ...form, age_range: e.target.value })}
                  className="field-input"
                >
                  <option value="">Select age range</option>
                  <option value="18-24">18–24</option>
                  <option value="25-34">25–34</option>
                  <option value="35-44">35–44</option>
                  <option value="45-54">45–54</option>
                  <option value="55+">55+</option>
                </select>
              </Field>
            </FormSection>

            <FormSection eyebrow="Taste" title="What kind of city energy do you like?">
              <ChipSection
                title="Preferred Vibes"
                options={VIBE_OPTIONS}
                selected={form.preferred_vibes}
                onToggle={(value) => toggleArrayField('preferred_vibes', value)}
              />

              <ChipSection
                title="Interests"
                options={INTEREST_OPTIONS}
                selected={form.interest_categories}
                onToggle={(value) => toggleArrayField('interest_categories', value)}
              />
            </FormSection>

            <FormSection eyebrow="Rhythm" title="How do you like to roam?">
              <Field label="How often do you go out?">
                <select
                  value={form.frequency}
                  onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                  className="field-input"
                >
                  <option value="">Select frequency</option>
                  <option value="rarely">Rarely</option>
                  <option value="monthly">A few times a month</option>
                  <option value="weekly">Weekly</option>
                  <option value="multiple_weekly">Multiple times a week</option>
                </select>
              </Field>

              <Field label="Ideal Roam Style">
                <select
                  value={form.crawl_type}
                  onChange={(e) => setForm({ ...form, crawl_type: e.target.value })}
                  className="field-input"
                >
                  <option value="">Select style</option>
                  <option value="low_key">Low-key</option>
                  <option value="curated">Curated and polished</option>
                  <option value="social">Social and lively</option>
                  <option value="adventurous">Adventurous</option>
                </select>
              </Field>

              <ChipSection
                title="Best Days Out"
                options={DAY_OPTIONS}
                selected={form.days_out}
                onToggle={(value) => toggleArrayField('days_out', value)}
              />
            </FormSection>

            <FormSection eyebrow="Social Mode" title="What are you here for?">
              <Field label="Intent Level">
                <select
                  value={form.intent_level}
                  onChange={(e) => setForm({ ...form, intent_level: e.target.value })}
                  className="field-input"
                >
                  <option value="">Select intent</option>
                  <option value="browse">Just browsing</option>
                  <option value="plan_soon">Planning something soon</option>
                  <option value="meet_people">Trying to meet people</option>
                  <option value="host">Interested in hosting</option>
                </select>
              </Field>

              <Field label="Personality Style">
                <select
                  value={form.personality_style}
                  onChange={(e) =>
                    setForm({ ...form, personality_style: e.target.value })
                  }
                  className="field-input"
                >
                  <option value="">Select personality style</option>
                  <option value="planner">Planner</option>
                  <option value="spontaneous">Spontaneous</option>
                  <option value="curator">Curator</option>
                  <option value="connector">Connector</option>
                </select>
              </Field>

              <Field label="Social Comfort">
                <select
                  value={form.social_comfort}
                  onChange={(e) =>
                    setForm({ ...form, social_comfort: e.target.value })
                  }
                  className="field-input"
                >
                  <option value="">Select comfort level</option>
                  <option value="solo">I usually go solo</option>
                  <option value="small_group">Small groups</option>
                  <option value="large_group">Large groups</option>
                  <option value="open_to_new_people">Open to meeting new people</option>
                </select>
              </Field>
            </FormSection>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 transition hover:-translate-y-0.5 hover:from-cyan-400 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Saving your Passport…' : 'Finish Setup →'}
            </button>
          </form>
        </section>
      </div>

      <style jsx>{`
        .field-input {
          width: 100%;
          border-radius: 0.875rem;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(0, 0, 0, 0.34);
          padding: 0.75rem 0.875rem;
          color: white;
          outline: none;
        }

        .field-input:focus {
          border-color: rgba(34, 211, 238, 0.8);
          box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.14);
        }

        .field-input::placeholder {
          color: rgba(212, 212, 216, 0.55);
        }

        .field-input option {
          color: black;
        }
      `}</style>
    </main>
  )
}

function FormSection({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-black/25 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-xl font-bold">{title}</h2>
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-neutral-200">
        {label}
      </label>
      {children}
    </div>
  )
}

function ChipSection({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string
  options: string[]
  selected: string[]
  onToggle: (value: string) => void
}) {
  return (
    <div>
      <p className="mb-3 text-sm font-medium text-neutral-200">{title}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected.includes(option)

          return (
            <button
              key={option}
              type="button"
              onClick={() => onToggle(option)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                active
                  ? 'border-cyan-300 bg-cyan-300 text-black shadow-lg shadow-cyan-500/20'
                  : 'border-white/10 bg-white/[0.06] text-neutral-300 hover:border-cyan-300/60 hover:text-white'
              }`}
            >
              {active ? '✓ ' : ''}
              {option}
            </button>
          )
        })}
      </div>
    </div>
  )
}