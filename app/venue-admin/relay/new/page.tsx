// app/venue-admin/relay/new/page.tsx

import Link from 'next/link'

import { RelayAuthoringForm } from '@/components/venue-admin/relay/RelayAuthoringForm'
import { createRelayDefinition } from '@/lib/relay/actions'


/* ============================================================
 * ROUTE CONFIG
 * ============================================================
 *
 * Relay authoring is an operational admin surface.
 *
 * Keep it dynamic so admin context and any future server-provided
 * authoring dependencies are never statically cached.
 * ============================================================
 */

export const dynamic =
  'force-dynamic'


/* ============================================================
 * PAGE METADATA
 * ============================================================
 */

export const metadata = {
  title:
    'New Relay · Venue Admin',
  description:
    'Create a new Roam Relay and define its collaborative route template.',
}


/* ============================================================
 * PAGE
 * ============================================================
 */

export default function NewRelayAdminPage() {
  return (
    <main
      className={[
        'min-h-screen',
        'w-full',
        'bg-[#080808]',
        'text-zinc-50',
      ].join(' ')}
    >
      <div
        className={[
          'mx-auto',
          'w-full',
          'max-w-7xl',
          'px-4',
          'pb-20',
          'pt-5',
          'sm:px-6',
          'sm:pt-8',
          'lg:px-8',
        ].join(' ')}
      >
        {/* ====================================================
         * BREADCRUMB / BACK NAVIGATION
         * ==================================================== */}

        <nav
          aria-label="Relay admin breadcrumb"
          className="mb-5 sm:mb-6"
        >
          <ol
            className={[
              'm-0',
              'flex',
              'list-none',
              'flex-wrap',
              'items-center',
              'gap-x-2',
              'gap-y-1',
              'p-0',
              'text-xs',
              'font-medium',
            ].join(' ')}
          >
            <li>
              <Link
                href="/venue-admin"
                className={[
                  '!text-zinc-400',
                  'transition-colors',
                  'hover:!text-zinc-100',
                  'focus-visible:outline-none',
                  'focus-visible:ring-2',
                  'focus-visible:ring-amber-300',
                  'focus-visible:ring-offset-2',
                  'focus-visible:ring-offset-[#080808]',
                ].join(' ')}
              >
                Venue Admin
              </Link>
            </li>

            <li
              aria-hidden="true"
              className="text-zinc-600"
            >
              /
            </li>

            <li>
              <Link
                href="/venue-admin/relay"
                className={[
                  '!text-zinc-400',
                  'transition-colors',
                  'hover:!text-zinc-100',
                  'focus-visible:outline-none',
                  'focus-visible:ring-2',
                  'focus-visible:ring-amber-300',
                  'focus-visible:ring-offset-2',
                  'focus-visible:ring-offset-[#080808]',
                ].join(' ')}
              >
                Relays
              </Link>
            </li>

            <li
              aria-hidden="true"
              className="text-zinc-600"
            >
              /
            </li>

            <li
              aria-current="page"
              className="font-semibold text-zinc-200"
            >
              New
            </li>
          </ol>
        </nav>


        {/* ====================================================
         * PAGE HEADER
         * ==================================================== */}

        <header
          className={[
            'rounded-3xl',
            'border',
            'border-zinc-800',
            'bg-[linear-gradient(135deg,#17140d_0%,#111111_46%,#0d0d0d_100%)]',
            'px-5',
            'py-6',
            'shadow-[0_20px_70px_rgba(0,0,0,0.36)]',
            'sm:px-6',
            'sm:py-7',
            'lg:flex',
            'lg:items-end',
            'lg:justify-between',
            'lg:gap-8',
          ].join(' ')}
        >
          <div className="max-w-3xl">
            <p
              className={[
                'text-[11px]',
                'font-bold',
                'uppercase',
                'tracking-[0.17em]',
                'text-amber-300',
              ].join(' ')}
            >
              Venue Admin · Relay
            </p>

            <h1
              className={[
                'mt-2.5',
                'text-3xl',
                'font-semibold',
                'leading-tight',
                'tracking-[-0.045em]',
                'text-zinc-50',
                'sm:text-4xl',
              ].join(' ')}
            >
              Create Relay
            </h1>

            <p
              className={[
                'mt-3',
                'max-w-2xl',
                'text-sm',
                'leading-6',
                'text-zinc-300',
                'sm:text-[15px]',
              ].join(' ')}
            >
              Define the collaborative route, team shape, timing,
              and reward policy. Teams will execute the Relay later
              through the canonical Active Flow system.
            </p>
          </div>

          <Link
            href="/venue-admin/relay"
            className={[
              'mt-5',
              'inline-flex',
              'min-h-12',
              'w-full',
              'shrink-0',
              'items-center',
              'justify-center',
              'rounded-xl',
              'border',
              'border-zinc-600',
              'bg-zinc-900',
              'px-4',
              'text-sm',
              'font-bold',
              '!text-zinc-100',
              'transition',
              'hover:border-zinc-500',
              'hover:bg-zinc-800',
              'hover:!text-white',
              'active:scale-[0.99]',
              'focus-visible:outline-none',
              'focus-visible:ring-2',
              'focus-visible:ring-zinc-400',
              'focus-visible:ring-offset-2',
              'focus-visible:ring-offset-[#080808]',
              'sm:w-auto',
              'lg:mt-0',
            ].join(' ')}
          >
            Cancel
          </Link>
        </header>


        {/* ====================================================
         * AUTHORING CONTEXT
         * ==================================================== */}

        <section
          aria-labelledby="relay-authoring-context-heading"
          className={[
            'mt-6',
            'grid',
            'gap-3',
            'sm:grid-cols-3',
          ].join(' ')}
        >
          <div
            className={[
              'rounded-2xl',
              'border',
              'border-zinc-800',
              'bg-zinc-950',
              'px-4',
              'py-4',
              'shadow-[0_10px_30px_rgba(0,0,0,0.22)]',
            ].join(' ')}
          >
            <p
              id="relay-authoring-context-heading"
              className={[
                'text-[10px]',
                'font-bold',
                'uppercase',
                'tracking-[0.14em]',
                'text-zinc-400',
              ].join(' ')}
            >
              Structure
            </p>

            <p className="mt-2 text-sm font-semibold text-zinc-50">
              3–5 sequential legs
            </p>

            <p className="mt-1.5 text-xs leading-5 text-zinc-400">
              Each joined teammate owns exactly one Relay leg in v1.
            </p>
          </div>


          <div
            className={[
              'rounded-2xl',
              'border',
              'border-zinc-800',
              'bg-zinc-950',
              'px-4',
              'py-4',
              'shadow-[0_10px_30px_rgba(0,0,0,0.22)]',
            ].join(' ')}
          >
            <p
              className={[
                'text-[10px]',
                'font-bold',
                'uppercase',
                'tracking-[0.14em]',
                'text-zinc-400',
              ].join(' ')}
            >
              Execution
            </p>

            <p className="mt-2 text-sm font-semibold text-zinc-50">
              Physical Active Flow
            </p>

            <p className="mt-1.5 text-xs leading-5 text-zinc-400">
              Relay legs use canonical Flow sessions and verified
              physical check-ins.
            </p>
          </div>


          <div
            className={[
              'rounded-2xl',
              'border',
              'border-zinc-800',
              'bg-zinc-950',
              'px-4',
              'py-4',
              'shadow-[0_10px_30px_rgba(0,0,0,0.22)]',
            ].join(' ')}
          >
            <p
              className={[
                'text-[10px]',
                'font-bold',
                'uppercase',
                'tracking-[0.14em]',
                'text-zinc-400',
              ].join(' ')}
            >
              Partner
            </p>

            <p className="mt-2 text-sm font-semibold text-zinc-50">
              Optional campaign
            </p>

            <p className="mt-1.5 text-xs leading-5 text-zinc-400">
              Partner context may shape eligibility and rewards
              without changing Relay execution truth.
            </p>
          </div>
        </section>


        {/* ====================================================
         * AUTHORING FORM
         * ====================================================
         *
         * This page deliberately does not own:
         *
         *   - Relay field state
         *   - slot-builder state
         *   - validation
         *   - creation mutation
         *   - reward-policy logic
         *   - redirect-after-create behavior
         *
         * Those belong to RelayAuthoringForm and the trusted
         * venue-admin Relay actions layer.
         * ==================================================== */}

        <section
          aria-label="Create Relay"
          className={[
            'mt-7',
            'rounded-3xl',
            'border',
            'border-zinc-800',
            'bg-zinc-950',
            'p-4',
            'shadow-[0_18px_60px_rgba(0,0,0,0.30)]',
            'sm:p-5',
            'lg:p-6',
          ].join(' ')}
        >
          <RelayAuthoringForm
            mode="create"
            onCreate={
              createRelayDefinition
            }
          />
        </section>
      </div>
    </main>
  )
}