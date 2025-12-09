"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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

  const [fullName, setFullName] = useState<string>("")
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
        setFullName(data.full_name ?? "")
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

    const updates = {
      id: user.id,
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
    }

    const { error } = await supabase.from("profiles").upsert(updates)

    if (error) {
      setError(error.message)
    } else {
      router.refresh()
    }

    setLoading(false)
  }

  return (
    <Card>
      <CardContent className="space-y-6 py-6">
        <section className="space-y-2">
          <label className="text-base font-medium">Full Name</label>
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Jordan Smith"
          />
        </section>
        <section className="space-y-2">
          <label className="text-base font-medium">Instagram Handle</label>
          <Input
            value={instagramHandle}
            onChange={(e) => setInstagramHandle(e.target.value)}
            placeholder="@yourhandle"
          />
        </section>
        <PreferredVibes value={preferredVibes} onChange={setPreferredVibes} />
        <InterestCategories value={interests} onChange={setInterests} />
        <Frequency value={frequency} onChange={setFrequency} />
        <AgeRange value={ageRange} onChange={setAgeRange} />
        <PersonalityStyle value={personality} onChange={setPersonality} />
        <CrawlType value={crawlType} onChange={setCrawlType} />
        <section className="space-y-2">
          <label className="text-base font-medium">
            Home Neighborhood / Base Area
          </label>
          <Input
            value={homeNeighborhood}
            onChange={(e) => setHomeNeighborhood(e.target.value)}
            placeholder="e.g. Midtown, East Atlanta, etc."
          />
        </section>
        <IntentLevel value={intentLevel} onChange={setIntentLevel} />
        <DaysOut value={daysOut} onChange={setDaysOut} />
        <section className="space-y-2">
          <label className="text-base font-medium">Social Comfort Level</label>
          <div className="flex flex-wrap gap-2">
            {["introvert", "ambivert", "extrovert"].map((s) => (
              <Button
                key={s}
                variant={socialComfort === s ? "default" : "outline"}
                onClick={() => setSocialComfort(s)}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Button>
            ))}
          </div>
        </section>
        {error && <p className="text-red-600">{error}</p>}
        <Button className="w-full mt-4" onClick={onSave} disabled={loading}>
          {loading ? "Saving..." : "Save Profile"}
        </Button>
      </CardContent>
    </Card>
  )
}