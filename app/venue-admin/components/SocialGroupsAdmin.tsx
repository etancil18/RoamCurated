'use client'

import { useEffect, useMemo, useState } from 'react'

type SocialGroup = {
  id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  owner_user_id: string | null
  created_at: string | null
  updated_at: string | null
}

type SocialGroupsResponse = {
  groups?: SocialGroup[]
  error?: string
  details?: string
}

type CreateSocialGroupResponse = {
  group?: SocialGroup
  error?: string
  details?: string
}

export default function SocialGroupsAdmin() {
  const [groups, setGroups] = useState<SocialGroup[]>([])
  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    logo_url: '',
    owner_user_id: '',
  })

  const [loadingGroups, setLoadingGroups] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const generatedSlug = useMemo(() => slugify(form.name), [form.name])

  useEffect(() => {
    loadGroups()
  }, [])

  async function loadGroups() {
    setLoadingGroups(true)

    try {
      const res = await fetch('/api/social-groups', {
        method: 'GET',
      })

      const json = (await res.json()) as SocialGroupsResponse

      if (!res.ok) {
        setError(json.details || json.error || 'Failed to load social groups')
        return
      }

      setGroups(json.groups ?? [])
    } catch (err) {
      console.error('Failed to load social groups:', err)
      setError(err instanceof Error ? err.message : 'Failed to load social groups')
    } finally {
      setLoadingGroups(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const name = form.name.trim()
    const slug = (form.slug.trim() || generatedSlug).trim()

    if (!name) {
      setError('Group name is required')
      return
    }

    if (!slug) {
      setError('Group slug is required')
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/social-groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          slug,
          description: form.description.trim() || null,
          logo_url: form.logo_url.trim() || null,
          owner_user_id: form.owner_user_id.trim() || undefined,
        }),
      })

      const json = (await res.json()) as CreateSocialGroupResponse

      if (!res.ok) {
        setError(json.details || json.error || 'Failed to create social group')
        return
      }

      setSuccess(`✅ Created social group: ${json.group?.name ?? name}`)

      setForm({
        name: '',
        slug: '',
        description: '',
        logo_url: '',
        owner_user_id: '',
      })

      await loadGroups()
    } catch (err) {
      console.error('Failed to create social group:', err)
      setError(err instanceof Error ? err.message : 'Failed to create social group')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-6 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div>
        <h2 className="text-xl font-semibold">Social Groups</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Create organizers that can be linked to events, check-ins, XP, and dashboards.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {success && (
        <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
          {success}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block font-medium">Group Name</label>
          <input
            required
            type="text"
            value={form.name}
            onChange={(e) =>
              setForm({
                ...form,
                name: e.target.value,
                slug: form.slug ? form.slug : slugify(e.target.value),
              })
            }
            className="w-full rounded border p-2 dark:border-neutral-700 dark:bg-neutral-900"
            placeholder="Atlanta Social Club"
          />
        </div>

        <div>
          <label className="mb-1 block font-medium">Slug</label>
          <input
            required
            type="text"
            value={form.slug || generatedSlug}
            onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
            className="w-full rounded border p-2 dark:border-neutral-700 dark:bg-neutral-900"
            placeholder="atlanta-social-club"
          />
          <p className="mt-1 text-xs text-neutral-500">
            Used later for public group pages like /social-groups/{form.slug || generatedSlug || 'group-slug'}.
          </p>
        </div>

        <div>
          <label className="mb-1 block font-medium">Description</label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded border p-2 dark:border-neutral-700 dark:bg-neutral-900"
            placeholder="Brief description of the group..."
          />
        </div>

        <div>
          <label className="mb-1 block font-medium">Logo URL</label>
          <input
            type="url"
            value={form.logo_url}
            onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
            className="w-full rounded border p-2 dark:border-neutral-700 dark:bg-neutral-900"
            placeholder="https://example.com/logo.png"
          />
        </div>

        <div>
          <label className="mb-1 block font-medium">Owner User ID optional</label>
          <input
            type="text"
            value={form.owner_user_id}
            onChange={(e) => setForm({ ...form, owner_user_id: e.target.value })}
            className="w-full rounded border p-2 dark:border-neutral-700 dark:bg-neutral-900"
            placeholder="Leave blank to assign yourself"
          />
          <p className="mt-1 text-xs text-neutral-500">
            This user will be added as owner in social_group_members.
          </p>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-blue-600 py-2 font-semibold text-white disabled:opacity-50"
        >
          {submitting ? 'Creating...' : 'Create Social Group'}
        </button>
      </form>

      <div className="border-t border-neutral-200 pt-5 dark:border-neutral-800">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-semibold">Existing Groups</h3>

          <button
            type="button"
            onClick={loadGroups}
            disabled={loadingGroups}
            className="rounded border px-3 py-1 text-sm disabled:opacity-50 dark:border-neutral-700"
          >
            {loadingGroups ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {loadingGroups ? (
          <p className="text-sm text-neutral-500">Loading groups...</p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-neutral-500">No social groups created yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border dark:border-neutral-800">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Slug</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>

              <tbody>
                {groups.map((group) => (
                  <tr
                    key={group.id}
                    className="border-b last:border-0 dark:border-neutral-900"
                  >
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        {group.logo_url ? (
                          <img
                            src={group.logo_url}
                            alt=""
                            className="h-6 w-6 rounded-full object-cover"
                          />
                        ) : (
                          <span>👥</span>
                        )}

                        <span>{group.name}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-neutral-500">
                      {group.slug}
                    </td>

                    <td className="px-4 py-3 text-neutral-500">
                      {group.owner_user_id ? formatUserId(group.owner_user_id) : '—'}
                    </td>

                    <td className="px-4 py-3 text-neutral-500">
                      {formatDate(group.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function formatDate(value: string | null): string {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatUserId(value: string): string {
  return `${value.slice(0, 8)}...`
}