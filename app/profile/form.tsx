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

  const [loading,setLoading] = useState(false)
  const [error,setError] = useState<string | null>(null)
  const [confirmDelete,setConfirmDelete] = useState(false)

  const [fullName,setFullName] = useState<string>("")
  const [username,setUsername] = useState<string>("")
  const [instagramHandle,setInstagramHandle] = useState<string>("")
  const [preferredVibes,setPreferredVibes] = useState<string[]>([])
  const [interests,setInterests] = useState<string[]>([])
  const [frequency,setFrequency] = useState<string>("")
  const [ageRange,setAgeRange] = useState<string>("")
  const [personality,setPersonality] = useState<string>("")
  const [crawlType,setCrawlType] = useState<string>("")
  const [homeNeighborhood,setHomeNeighborhood] = useState<string>("")
  const [intentLevel,setIntentLevel] = useState<string>("")
  const [socialComfort,setSocialComfort] = useState<string>("")
  const [daysOut,setDaysOut] = useState<string[]>([])

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true)

      const { data:{ user } } = await supabase.auth.getUser()
      if(!user) return

      const { data,error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id",user.id)
        .single()

      if(error){
        console.warn("Failed to load profile:",error.message)
      } else if(data){
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
  },[])

  const onSave = async () => {
    setLoading(true)
    setError(null)

    const { data:{ user } } = await supabase.auth.getUser()

    if(!user){
      setError("User not authenticated")
      setLoading(false)
      return
    }

    const normalizedUsername = normalizeUsername(username)

    if(normalizedUsername.length < 3){
      setError("Username must be at least 3 characters.")
      setLoading(false)
      return
    }

    const updates = {
      id:user.id,
      username:normalizedUsername,
      full_name:fullName,
      instagram_handle:instagramHandle,
      preferred_vibes:preferredVibes,
      interest_categories:interests,
      frequency,
      age_range:ageRange,
      personality_style:personality,
      crawl_type:crawlType,
      home_neighborhood:homeNeighborhood,
      intent_level:intentLevel,
      social_comfort:socialComfort,
      days_out:daysOut,
      has_seen_roam_intro: true,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from("profiles").upsert(updates)

    if(error){
      if(error.code === "23505"){
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

    const { data:{ user } } = await supabase.auth.getUser()

    if(!user){
      setError("User not authenticated")
      setLoading(false)
      return
    }

    const { error } = await supabase.rpc("anonymize_profile",{
      target_user:user.id,
    })

    if(error){
      setError(error.message)
      setLoading(false)
      return
    }

    await supabase.auth.signOut()
    router.push("/")
  }

  return (
    <Card className="shadow-sm">
      <CardContent className="space-y-8 py-8">
        <section className="space-y-4">
          <h3 className="text-sm font-semibold tracking-wide text-muted-foreground">
            Identity
          </h3>

          <div className="space-y-2">
            <label className="text-sm font-medium">Full Name</label>
            <Input
              value={fullName}
              onChange={(e)=>setFullName(e.target.value)}
              placeholder="e.g. Jordan Smith"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Username</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                @
              </span>
              <Input
                required
                value={username}
                onChange={(e)=>setUsername(normalizeUsername(e.target.value))}
                placeholder="citycurator"
                className="pl-7"
                minLength={3}
                maxLength={30}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Used for your public profile URL. Letters, numbers, and underscores only.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Instagram Handle</label>
            <Input
              value={instagramHandle}
              onChange={(e)=>setInstagramHandle(e.target.value)}
              placeholder="@yourhandle"
            />
          </div>
        </section>

        <section className="space-y-5 border-t pt-6">
          <h3 className="text-sm font-semibold tracking-wide text-muted-foreground">
            Preferences
          </h3>

          <PreferredVibes value={preferredVibes} onChange={setPreferredVibes} />
          <InterestCategories value={interests} onChange={setInterests} />
          <Frequency value={frequency} onChange={setFrequency} />
          <AgeRange value={ageRange} onChange={setAgeRange} />
          <PersonalityStyle value={personality} onChange={setPersonality} />
          <CrawlType value={crawlType} onChange={setCrawlType} />
        </section>

        <section className="space-y-4 border-t pt-6">
          <h3 className="text-sm font-semibold tracking-wide text-muted-foreground">
            Location
          </h3>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Home City
            </label>

            <Input
              value={homeNeighborhood}
              onChange={(e)=>setHomeNeighborhood(e.target.value)}
              placeholder="London, New York City, Atlanta, etc."
            />
          </div>
        </section>

        <section className="space-y-5 border-t pt-6">
          <h3 className="text-sm font-semibold tracking-wide text-muted-foreground">
            Social Style
          </h3>

          <IntentLevel value={intentLevel} onChange={setIntentLevel} />
          <DaysOut value={daysOut} onChange={setDaysOut} />

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Social Comfort
            </label>

            <div className="flex flex-wrap gap-2">
              {["introvert","ambivert","extrovert"].map((s)=>(
                <Button
                  key={s}
                  variant={socialComfort === s ? "default":"outline"}
                  onClick={()=>setSocialComfort(s)}
                >
                  {s.charAt(0).toUpperCase()+s.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </section>

        {error && (
          <p className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button
          className="w-full"
          onClick={onSave}
          disabled={loading}
        >
          {loading ? "Saving..." : "Save Profile"}
        </Button>

        <div className="pt-6 border-t space-y-3">
          {!confirmDelete && (
            <Button
              variant="outline"
              className="w-full text-destructive border-destructive/40 hover:bg-destructive/10"
              onClick={()=>setConfirmDelete(true)}
            >
              Delete Profile
            </Button>
          )}

          {confirmDelete && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete your profile?
              </p>

              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={deleteProfile}
                  disabled={loading}
                >
                  Delete
                </Button>

                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={()=>setConfirmDelete(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function normalizeUsername(value: string): string {
  return value
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 30)
}