import Link from 'next/link'
import {
  ArrowLeft,
  EyeOff,
  Home,
  LockKeyhole,
} from 'lucide-react'

export default function GuidePreviewNotFound() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-neutral-950 px-4 py-10 text-white sm:px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-12%] top-[-10%] h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute right-[-14%] top-[18%] h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] max-w-2xl items-center justify-center">
        <section className="w-full rounded-[2rem] border border-neutral-800 bg-neutral-950/85 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 text-amber-200">
            <EyeOff className="h-6 w-6" />
          </div>

          <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-400">
            Guide preview
          </p>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Preview unavailable
          </h1>

          <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-400">
            This guide preview could not be opened. The guide may not exist,
            the link may be invalid, or your account may not have permission
            to access it.
          </p>

          <div className="mt-6 rounded-2xl border border-neutral-800 bg-black/30 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-500">
                <LockKeyhole className="h-4 w-4" />
              </div>

              <div>
                <p className="text-sm font-semibold text-white">
                  Private administrative route
                </p>

                <p className="mt-1 text-xs leading-5 text-neutral-500">
                  Draft, archived, and unpublished guide previews are available
                  only to authorized Roam administrators.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/venue-admin"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-cyan-300 px-4 py-2 text-sm font-bold text-neutral-950 transition hover:bg-cyan-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Return to Guide Admin
            </Link>

            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-neutral-700 bg-neutral-950 px-4 py-2 text-sm font-semibold text-neutral-300 transition hover:border-neutral-600 hover:text-white"
            >
              <Home className="h-4 w-4" />
              Return Home
            </Link>
          </div>

          <p className="mt-6 text-[11px] leading-5 text-neutral-600">
            Verify that you are signed in with an authorized account and that
            the preview URL contains a valid guide ID.
          </p>
        </section>
      </div>
    </main>
  )
}