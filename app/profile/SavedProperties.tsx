
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabaseBrowser, getCurrentUserId } from "@/lib/supabase/client"

type SavedProperty = {
  property_id: string
  city: string
  slug: string
}

/* ------------------------------------------------ */
/* Property ownership initiative                    */
/* ------------------------------------------------ */

type OwnedProperty = {
  id: string
  name: string
  city: string
  slug: string
}

function formatPropertyName(slug: string) {
  return slug
    .replaceAll("-", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatCity(city: string) {
  return city
    .replaceAll("-", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export default function SavedProperties() {
  const [supabase] = useState(() => supabaseBrowser())
  const [loading, setLoading] = useState(true)
  const [properties, setProperties] = useState<SavedProperty[]>([])

  /* ------------------------------------------------ */
  /* Owned property state                             */
  /* ------------------------------------------------ */

  const [ownedProperties, setOwnedProperties] = useState<OwnedProperty[]>([])
  const [ownedPropertiesError, setOwnedPropertiesError] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadSaved() {
      try {
        const userId = await getCurrentUserId()

        if (!userId) {
          if (!cancelled) {
            setLoading(false)
          }
          return
        }

        /*
         * Load existing saved guides and separately load
         * properties that the current user actually owns.
         *
         * saved_properties is a bookmark relationship.
         * properties.owner_user_id is the ownership relationship.
         *
         * These must not be treated as interchangeable.
         */
        const [savedResult, ownedResult] = await Promise.all([
          supabase
            .from("saved_properties")
            .select("property_id, city, slug")
            .eq("user_id", userId)
            .order("created_at", { ascending: false }),

          supabase
            .from("properties")
            .select("id, name, city, slug")
            .eq("owner_user_id", userId)
            .order("created_at", { ascending: false }),
        ])

        if (cancelled) {
          return
        }

        setProperties(savedResult.data ?? [])

        if (ownedResult.error) {
          console.error(
            "[SavedProperties] Failed to load owned properties:",
            ownedResult.error
          )

          setOwnedPropertiesError(true)
          setOwnedProperties([])
        } else {
          setOwnedPropertiesError(false)
          setOwnedProperties(
            (ownedResult.data ?? []) as OwnedProperty[]
          )
        }

        setLoading(false)
      } catch (error) {
        if (cancelled) {
          return
        }

        console.error(
          "[SavedProperties] Failed to load property guides:",
          error
        )

        setOwnedPropertiesError(true)
        setLoading(false)
      }
    }

    void loadSaved()

    return () => {
      cancelled = true
    }
  }, [supabase])

  if (loading) {
    return (
      <p className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-neutral-400">
        Loading saved guides…
      </p>
    )
  }

  /*
   * Preserve the existing empty-state presentation
   * when the user has neither saved nor owned guides.
   */
  if (
    properties.length === 0 &&
    ownedProperties.length === 0 &&
    !ownedPropertiesError
  ) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-800 bg-black/30 px-4 py-5">
        <p className="text-sm font-medium text-neutral-300">
          No saved property guides yet.
        </p>
        <p className="mt-1 text-xs leading-5 text-neutral-500">
          Save guides from properties you want to revisit or share with guests.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------ */}
      {/* Properties You Manage                            */}
      {/* ------------------------------------------------ */}

      {(ownedProperties.length > 0 || ownedPropertiesError) && (
        <section className="space-y-3">
          <div>
            <h4 className="text-sm font-bold text-white">
              Properties You Manage
            </h4>

            <p className="mt-1 text-xs leading-5 text-neutral-500">
              Guest guides created with your Roam account.
            </p>
          </div>

          {ownedPropertiesError ? (
            <p
              role="alert"
              className="rounded-xl border border-amber-400/15 bg-amber-400/[0.05] px-4 py-3 text-xs leading-5 text-amber-200/80"
            >
              We couldn't load your managed properties.
              Your saved guides are still available below.
            </p>
          ) : (
            <div className="divide-y divide-neutral-900 overflow-hidden rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.035]">
              {ownedProperties.map((property) => (
                <div
                  key={property.id}
                  className="space-y-3 px-4 py-3"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-100">
                        {property.name || formatPropertyName(property.slug)}
                      </p>

                      <p className="mt-0.5 text-xs text-neutral-500">
                        {formatCity(property.city)} guide
                      </p>
                    </div>

                    <span className="shrink-0 rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                      Owner
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/property/${property.city}/${property.slug}`}
                      className="inline-flex min-h-9 items-center justify-center rounded-full border border-neutral-700 px-3.5 py-1.5 text-xs font-semibold text-neutral-200 transition hover:border-cyan-400/40 hover:text-cyan-300"
                    >
                      Open guide →
                    </Link>

                    <Link
                      href={`/hosts/properties/${property.id}/edit`}
                      className="inline-flex min-h-9 items-center justify-center rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3.5 py-1.5 text-xs font-bold text-cyan-200 transition hover:border-cyan-400/50 hover:bg-cyan-400/15"
                    >
                      Edit property
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ------------------------------------------------ */}
      {/* Existing saved property guides                    */}
      {/* ------------------------------------------------ */}

      <section className="space-y-3">
        {ownedProperties.length > 0 && (
          <div>
            <h4 className="text-sm font-bold text-white">
              Saved Property Guides
            </h4>

            <p className="mt-1 text-xs leading-5 text-neutral-500">
              Guides you've bookmarked to revisit or share.
            </p>
          </div>
        )}

        {properties.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-800 bg-black/30 px-4 py-5">
            <p className="text-sm font-medium text-neutral-300">
              No saved property guides yet.
            </p>
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              Save guides from properties you want to revisit or share with guests.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-900 overflow-hidden rounded-2xl border border-neutral-800/80 bg-black/25">
            {properties.map((property) => (
              <Link
                key={property.property_id}
                href={`/property/${property.city}/${property.slug}`}
                className="group flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-white/[0.04]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-neutral-100">
                    {formatPropertyName(property.slug)}
                  </p>

                  <p className="mt-0.5 text-xs text-neutral-500">
                    {formatCity(property.city)} guide
                  </p>
                </div>

                <span className="shrink-0 rounded-full border border-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-500 transition group-hover:border-cyan-400/40 group-hover:text-cyan-300">
                  Open →
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
