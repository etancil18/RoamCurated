'use client'

import Link from 'next/link'

export default function HowItWorksPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05060a] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.30),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(34,211,238,0.20),_transparent_34%),linear-gradient(135deg,_#05060a_0%,_#09090f_45%,_#020617_100%)]" />

      <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.7)_1px,transparent_1px)] [background-size:44px_44px]" />

      <div className="relative mx-auto max-w-6xl px-5 py-24 sm:px-8">
        {/* HERO */}

        <div className="relative mx-auto mb-10 flex h-36 w-36 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-cyan-500/20 blur-3xl" />
          <div className="absolute inset-4 rounded-full border border-cyan-400/20 animate-pulse" />
          <div className="absolute inset-0 rounded-full border border-white/10" />

          <div className="relative flex h-28 w-28 items-center justify-center rounded-[2.25rem] border border-white/10 bg-gradient-to-br from-cyan-500/20 via-indigo-500/15 to-fuchsia-500/15 shadow-[0_0_80px_rgba(34,211,238,0.35)] backdrop-blur-xl">
            <img src="/favicon-new.ico" alt="Roam" className="h-16 w-16 rounded-2xl" />
          </div>
        </div>

        <p className="text-sm font-semibold uppercase tracking-[0.32em] text-cyan-300">
          HOW ROAM WORKS
        </p>

        <h1 className="mt-6 text-5xl font-black leading-[0.92] tracking-tight sm:text-7xl">
          Your city just became playable.
        </h1>

        <p className="mx-auto mt-8 max-w-3xl text-lg leading-8 text-neutral-300">
          Roam helps you turn cities into experiences. Build date nights,
          discover hidden gems, host adventures with friends, earn XP, level up
          your Passport, and share your journey along the way.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/"
            className="rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-6 py-4 text-sm font-bold text-white transition hover:-translate-y-0.5"
          >
            Open the Map
          </Link>

          <Link
            href="/events"
            className="rounded-2xl border border-white/10 bg-white/10 px-6 py-4 text-sm font-bold backdrop-blur-xl transition hover:bg-white/15"
          >
            Explore Events
          </Link>
        </div>

        {/* HOW IT WORKS */}

        <section className="mt-24">
          <h2 className="text-center text-3xl font-black">
            Discover → Explore → Share
          </h2>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <StepCard
              number="01"
              title="Generate a Flow"
              description="Choose a city, pick a vibe, and Roam builds a curated itinerary in seconds."
            />

            <StepCard
              number="02"
              title="Check In & Explore"
              description="Move stop by stop, complete venues, earn XP, unlock badges, and build your Passport."
            />

            <StepCard
              number="03"
              title="Share the Snapshot"
              description="Turn your completed adventure into a shareable story-style recap."
            />
          </div>
        </section>

        {/* FLOWS */}

        <section className="mt-28">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 backdrop-blur-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
              FLOWS
            </p>

            <h2 className="mt-3 text-4xl font-black">
              Like playlists, but for cities.
            </h2>

            <p className="mt-5 max-w-3xl text-lg leading-8 text-neutral-300">
              Flows are Roam's signature experience. Instead of songs, a Flow
              connects real places into a curated journey.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-5">
              <FlowStop emoji="☕" label="Coffee" />
              <FlowStop emoji="🍷" label="Wine" />
              <FlowStop emoji="🍝" label="Dinner" />
              <FlowStop emoji="🍸" label="Cocktails" />
              <FlowStop emoji="🌃" label="Rooftop" />
            </div>

            <p className="mt-8 text-neutral-400">
              No planning. No endless debates. Just follow the route.
            </p>
          </div>
        </section>

        {/* GENERATING FLOWS */}

        <section className="mt-20">
          <div className="rounded-[2rem] border border-cyan-500/20 bg-gradient-to-br from-cyan-950/30 to-indigo-950/20 p-8 backdrop-blur-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
              GENERATING FLOWS
            </p>

            <h2 className="mt-3 text-4xl font-black">
              Better timing creates better Flows.
            </h2>

            <p className="mt-5 max-w-3xl text-lg leading-8 text-neutral-300">
              Roam generates the strongest experiences when your selected theme
              matches the time people normally enjoy those activities. Cities
              have rhythms. Brunch spots peak in the morning. Happy hours come
              alive in the evening. Rooftops shine after sunset.
            </p>

            <p className="mt-5 max-w-3xl text-lg leading-8 text-neutral-300">
              When possible, generate Flows close to the time you actually plan
              to go out. Roam uses real venue availability, operating hours,
              events, and timing signals to build stronger recommendations.
            </p>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-5">
                <div className="text-4xl">☀️</div>

                <h3 className="mt-4 text-xl font-bold">Morning Adventure</h3>

                <p className="mt-3 text-sm leading-6 text-neutral-400">
                  Best generated around morning hours.
                </p>

                <ul className="mt-4 space-y-2 text-sm text-neutral-300">
                  <li>• Coffee runs</li>
                  <li>• Brunch spots</li>
                  <li>• Markets</li>
                  <li>• Daytime exploring</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-5">
                <div className="text-4xl">⚡</div>

                <h3 className="mt-4 text-xl font-bold">Midday Recharge</h3>

                <p className="mt-3 text-sm leading-6 text-neutral-400">
                  Best generated around lunch and afternoon hours.
                </p>

                <ul className="mt-4 space-y-2 text-sm text-neutral-300">
                  <li>• Lunch routes</li>
                  <li>• Coffee meetings</li>
                  <li>• Work breaks</li>
                  <li>• Casual city exploration</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-5">
                <div className="text-4xl">🌙</div>

                <h3 className="mt-4 text-xl font-bold">Friends Night Out</h3>

                <p className="mt-3 text-sm leading-6 text-neutral-400">
                  Best generated during evening hours.
                </p>

                <ul className="mt-4 space-y-2 text-sm text-neutral-300">
                  <li>• Cocktails</li>
                  <li>• Rooftops</li>
                  <li>• Nightlife</li>
                  <li>• Concert nights</li>
                </ul>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-6">
              <p className="font-semibold uppercase tracking-[0.2em] text-emerald-300">
                Planning Ahead
              </p>

              <h3 className="mt-2 text-xl font-bold">
                Generate Flows for a future date and time.
              </h3>

              <p className="mt-3 leading-7 text-neutral-300">
                Not going out right now? No problem.
              </p>

              <p className="mt-3 leading-7 text-neutral-300">
                When generating a Flow, you can schedule it for a future date
                and time to preview potential experiences. Want to see what a
                Friday night date route might look like next weekend? Or plan a
                Saturday brunch adventure before guests arrive?
              </p>

              <p className="mt-3 leading-7 text-neutral-300">
                Simply choose the future time you're planning around and Roam
                will build recommendations that better reflect what the city is
                likely to look like when the experience actually happens.
              </p>
            </div>
          </div>
        </section>

        {/* HOSTING */}

        <section className="mt-28">
          <h2 className="text-4xl font-black">Host adventures with friends.</h2>

          <p className="mt-5 max-w-3xl text-lg leading-8 text-neutral-300">
            Planning a birthday crawl, food tour, brewery run, neighborhood
            adventure, or concert pregame? Build your own hosted Flow and invite
            friends to join.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-4">
            <MiniCard title="Choose Stops" />
            <MiniCard title="Name It" />
            <MiniCard title="Invite Friends" />
            <MiniCard title="Roam Together" />
          </div>

          <p className="mt-8 text-neutral-400">
            Everyone tracks progress. Everyone checks in. Everyone earns XP.
          </p>
        </section>

        {/* XP */}

        <section className="mt-28">
          <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-indigo-950/50 to-black p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-300">
              PASSPORT
            </p>

            <h2 className="mt-3 text-4xl font-black">
              Your adventures become progress.
            </h2>

            <p className="mt-5 max-w-3xl text-lg leading-8 text-neutral-300">
              Everything you do contributes toward your Passport.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <MiniCard title="Visit Places" />
              <MiniCard title="Complete Flows" />
              <MiniCard title="Unlock Badges" />
              <MiniCard title="Host Crawls" />
              <MiniCard title="Rate Venues" />
              <MiniCard title="Level Up" />
            </div>
          </div>
        </section>

        {/* EVENTS */}

        <section className="mt-28">
          <h2 className="text-4xl font-black">Events become experiences.</h2>

          <p className="mt-5 max-w-3xl text-lg leading-8 text-neutral-300">
            Most platforms stop at the event. Roam starts there.
          </p>

          <div className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.05] p-8">
            <p className="text-xl font-semibold">Going to a concert?</p>

            <ul className="mt-5 space-y-3 text-neutral-300">
              <li>• Where should we eat beforehand?</li>
              <li>• Where should we grab drinks afterward?</li>
              <li>• What else is nearby?</li>
              <li>• How do we turn this into a full night out?</li>
            </ul>

            <p className="mt-6 text-neutral-400">
              Roam answers those questions automatically.
            </p>
          </div>
        </section>

        {/* GUIDES */}

        <section className="mt-28">
          <h2 className="text-4xl font-black">
            Build Guides. Share local knowledge.
          </h2>

          <p className="mt-5 max-w-3xl text-lg leading-8 text-neutral-300">
            Create curated collections of coffee shops, hidden gems, date spots,
            neighborhood favorites, food tours, and local recommendations.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            {[
              'Hidden Gems',
              'Coffee Routes',
              'Date Spots',
              'Weekend Adventures',
              'Food Tours',
              'Neighborhood Favorites',
            ].map((item) => (
              <span
                key={item}
                className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm"
              >
                {item}
              </span>
            ))}
          </div>
        </section>

        {/* FINAL CTA */}

        <section className="mt-32 text-center">
          <h2 className="text-5xl font-black">
            The goal isn't to collect pins.
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-xl leading-9 text-neutral-300">
            The goal is to create memories.
          </p>

          <p className="mx-auto mt-6 max-w-3xl text-neutral-400">
            Open the map. Find something interesting. Generate a Flow. Invite
            friends. Visit somewhere new. Share the Snapshot. Earn some XP.
            Repeat.
          </p>

          <Link
            href="/"
            className="mt-10 inline-flex rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-8 py-5 text-sm font-bold text-white transition hover:-translate-y-0.5"
          >
            Start Roaming
          </Link>
        </section>
      </div>
    </main>
  )
}

function StepCard({
  number,
  title,
  description,
}: {
  number: string
  title: string
  description: string
}) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 backdrop-blur-xl">
      <p className="text-sm font-bold text-cyan-300">{number}</p>
      <h3 className="mt-4 text-2xl font-bold">{title}</h3>
      <p className="mt-3 text-neutral-400">{description}</p>
    </div>
  )
}

function MiniCard({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.05] p-4 text-center font-semibold">
      {title}
    </div>
  )
}

function FlowStop({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-center">
      <div className="text-3xl">{emoji}</div>
      <p className="mt-3 font-semibold">{label}</p>
    </div>
  )
}