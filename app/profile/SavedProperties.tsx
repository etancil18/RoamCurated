"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabaseBrowser, getCurrentUserId } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"

type SavedProperty = {
  property_id: string
  city: string
  slug: string
}

export default function SavedProperties() {

  const [supabase] = useState(() => supabaseBrowser())
  const [loading,setLoading] = useState(true)
  const [properties,setProperties] = useState<SavedProperty[]>([])

  useEffect(() => {

    async function loadSaved(){

      const userId = await getCurrentUserId()

      if(!userId){
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from("saved_properties")
        .select("property_id, city, slug")
        .eq("user_id", userId)
        .order("created_at", { ascending:false })

      setProperties(data ?? [])
      setLoading(false)
    }

    loadSaved()

  },[supabase])

  if(loading){
    return (
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">⭐ Saved Properties</h2>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if(properties.length === 0){
    return (
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">⭐ Saved Properties</h2>
        <p className="text-sm text-muted-foreground">
          You haven't saved any property guides yet.
        </p>
      </div>
    )
  }

  return (

    <section className="space-y-3">

      <h2 className="text-lg font-semibold">⭐ Saved Properties</h2>

      <div className="grid gap-3">

        {properties.map((p) => (

          <Link
            key={p.property_id}
            href={`/property/${p.city}/${p.slug}`}
          >

            <Card className="hover:shadow-md transition cursor-pointer">

              <CardContent className="p-4">

                <p className="font-medium">
                  {p.slug.replaceAll("-", " ")}
                </p>

                <p className="text-xs text-muted-foreground">
                  {p.city}
                </p>

              </CardContent>

            </Card>

          </Link>

        ))}

      </div>

    </section>
  )
}