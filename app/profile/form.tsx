"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import ProfileAvatarUploader from "@/components/profile/ProfileAvatarUploader"
import PreferredVibes from "@/app/profile/fields/PreferredVibes"
import InterestCategories from "@/app/profile/fields/InterestCategories"
import Frequency from "@/app/profile/fields/Frequency"
import AgeRange from "@/app/profile/fields/AgeRange"
import PersonalityStyle from "@/app/profile/fields/PersonalityStyle"
import CrawlType from "@/app/profile/fields/CrawlType"
import IntentLevel from "@/app/profile/fields/IntentLevel"
import DaysOut from "@/app/profile/fields/DaysOut"

export default function ProfileForm() {
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [fullName, setFullName] = useState<string>("")
  const [username, setUsername] = useState<string>("")
  const [instagramHandle, setInstagramHandle] = useState<string>("")
  const [preferredVibes, setPreferredVibes] = useState<string[]>([])
  const [interests, setInterests] = useState<string[]>([])
  const [frequency, setFrequency] = useState<string>("")
  const [ageRange, setAgeRange] = useState<string>("")
  const [personality, setPersonality] = useState<string>("")
  const [crawlType, setCrawlType] = useState<string>("")
  const [homeNeighborhood, setHomeNeighborhood] = useState<string>("")
  const [intentLevel, setIntentLevel] = useState<string>("")
  const [socialComfort, setSocialComfort] = useState<string>("")
  const [daysOut, setDaysOut] = useState<string[]>([])

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      if (error) {
        console.warn("Failed to load profile:", error.message)
      } else if (data) {
        setAvatarUrl(data.avatar_url ?? null)
        setFullName(data.full_name ?? "")
        setUsername(data.username ?? "")
        setInstagramHandle(data.instagram_handle ?? "")
        setPreferredVibes(data.preferred_vibes ?? [])
        setInterests(data.interest_categories ?? [])
        setFrequency(data.frequency ?? "")
        setAgeRange(data.age_range ?? "")
        setPersonality(data.personality_style ?? "")
        setCrawlType(data.crawl_type ?? "")
        setHomeNeighborhood(data.home_neighborhood ?? "")
        setIntentLevel(data.intent_level ?? "")
        setSocialComfort(data.social_comfort ?? "")
        setDaysOut(data.days_out ?? [])
      }

      setLoading(false)
    }

    loadProfile()
  }, [])

  const onSave = async () => {
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError("User not authenticated")
      setLoading(false)
      return
    }

    const normalizedUsername = normalizeUsername(username)

    if (normalizedUsername.length < 3) {
      setError("Username must be at least 3 characters.")
      setLoading(false)
      return
    }

    const updates = {
      id: user.id,
      username: normalizedUsername,
      full_name: fullName,
      instagram_handle: instagramHandle,
      preferred_vibes: preferredVibes,
      interest_categories: interests,
      frequency,
      age_range: ageRange,
      personality_style: personality,
      crawl_type: crawlType,
      home_neighborhood: homeNeighborhood,
      intent_level: intentLevel,
      social_comfort: socialComfort,
      days_out: daysOut,
      has_seen_roam_intro: true,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from("profiles").upsert(updates)

    if (error) {
      if (error.code === "23505") {
        setError("That username is already taken.")
      } else {
        setError(error.message)
      }
    } else {
      setUsername(normalizedUsername)
      router.refresh()
    }

    setLoading(false)
  }

  const deleteProfile = async () => {
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError("User not authenticated")
      setLoading(false)
      return
    }

    const { error } = await supabase.rpc("anonymize_profile", {
      target_user: user.id,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    await supabase.auth.signOut()
    router.push("/")
  }

  return (
    <div className="space-y-6">
      <SettingsSection title="Identity">
        <div className="space-y-5">
          <ProfileAvatarUploader
            initialAvatarUrl={avatarUrl}
            displayName={fullName || username || null}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full Name">
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Jordan Smith"
                className="border-neutral-800 bg-black/40 text-white placeholder:text-neutral-600"
              />
            </Field>

            <Field label="Username" help="Used for your public profile URL.">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500">
                  @
                </span>
                <Input
                  required
                  value={username}
                  onChange={(e) => setUsername(normalizeUsername(e.target.value))}
                  placeholder="citycurator"
                  className="border-neutral-800 bg-black/40 pl-7 text-white placeholder:text-neutral-600"
                  minLength={3}
                  maxLength={30}
                />
              </div>
            </Field>

            <Field label="Instagram Handle">
              <Input
                value={instagramHandle}
                onChange={(e) => setInstagramHandle(e.target.value)}
                placeholder="@yourhandle"
                className="border-neutral-800 bg-black/40 text-white placeholder:text-neutral-600"
              />
            </Field>

            <Field label="Home City">
              <Input
                value={homeNeighborhood}
                onChange={(e) => setHomeNeighborhood(e.target.value)}
                placeholder="London, New York City, Atlanta, etc."
                className="border-neutral-800 bg-black/40 text-white placeholder:text-neutral-600"
              />
            </Field>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Preferences">
        <div className="space-y-5">
          <PreferredVibes value={preferredVibes} onChange={setPreferredVibes} />
          <InterestCategories value={interests} onChange={setInterests} />
          <Frequency value={frequency} onChange={setFrequency} />
          <AgeRange value={ageRange} onChange={setAgeRange} />
          <PersonalityStyle value={personality} onChange={setPersonality} />
          <CrawlType value={crawlType} onChange={setCrawlType} />
        </div>
      </SettingsSection>

      <SettingsSection title="Social Style">
        <div className="space-y-5">
          <IntentLevel value={intentLevel} onChange={setIntentLevel} />
          <DaysOut value={daysOut} onChange={setDaysOut} />

          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300">
              Social Comfort
            </label>

            <div className="flex flex-wrap gap-2">
              {["introvert", "ambivert", "extrovert"].map((s) => (
                <Button
                  key={s}
                  variant={socialComfort === s ? "default" : "outline"}
                  onClick={() => setSocialComfort(s)}
                  className={
                    socialComfort === s
                      ? "rounded-full"
                      : "rounded-full border-neutral-700 bg-black/30 text-neutral-300 hover:bg-neutral-900 hover:text-white"
                  }
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </SettingsSection>

      {error && (
        <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <Button
        className="h-11 w-full rounded-full bg-white font-semibold text-black hover:bg-neutral-200"
        onClick={onSave}
        disabled={loading}
      >
        {loading ? "Saving..." : "Save Profile"}
      </Button>

      <div className="border-t border-neutral-900 pt-5">
        {!confirmDelete ? (
          <Button
            variant="outline"
            className="w-full rounded-full border-red-500/30 bg-red-500/5 text-red-300 hover:bg-red-500/10 hover:text-red-200"
            onClick={() => setConfirmDelete(true)}
          >
            Delete Profile
          </Button>
        ) : (
          <div className="space-y-3 rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
            <p className="text-sm text-neutral-400">
              Are you sure you want to delete your profile?
            </p>

            <div className="flex gap-2">
              <Button
                variant="destructive"
                className="flex-1 rounded-full"
                onClick={deleteProfile}
                disabled={loading}
              >
                Delete
              </Button>

              <Button
                variant="outline"
                className="flex-1 rounded-full border-neutral-700 bg-black/30 text-neutral-300"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SettingsSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-neutral-800/80 bg-black/25 p-4">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
        {title}
      </h3>

      {children}
    </section>
  )
}

function Field({
  label,
  help,
  children,
}: {
  label: string
  help?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-neutral-300">{label}</label>
      {children}
      {help ? (
        <p className="text-xs leading-5 text-neutral-500">{help}</p>
      ) : null}
    </div>
  )
}

function normalizeUsername(value: string): string {
  return value
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 30)
}