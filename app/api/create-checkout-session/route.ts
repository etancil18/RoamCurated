import Stripe from "stripe"
import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs" // Stripe SDK needs Node (not Edge)

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set")
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY)
}

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function mustGetEnv(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env var: ${name}`)
  return v
}

async function getBaseUrlFromHeaders() {
  const h = await headers()
  const proto = h.get("x-forwarded-proto") ?? "https"
  const host =
    h.get("x-forwarded-host") ??
    h.get("host")

  if (!host) throw new Error("Unable to determine host for base URL")

  return `${proto}://${host}`
}

export async function POST() {
  try {
    const stripe = getStripe()

    // 1) Authenticated user (cookie-based)
    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2) Load your application user record (service role to avoid RLS issues)
    const { data: appUser, error: userErr } = await supabaseAdmin
      .from("users")
      .select(
        "id,email,subscription_status,subscription_tier,stripe_customer_id,stripe_subscription_id"
      )
      .eq("id", user.id)
      .single()

    if (userErr || !appUser) {
      console.error("User lookup failed:", userErr)
      return NextResponse.json({ error: "User record not found" }, { status: 500 })
    }

    // 3) Prevent duplicate active subscriptions
    if (appUser.subscription_status === "active" && appUser.subscription_tier === "pro") {
      return NextResponse.json(
        { error: "Already subscribed" },
        { status: 409 }
      )
    }

    // If there is an existing Stripe subscription id, verify it isn't active/trialing.
    if (appUser.stripe_subscription_id) {
      try {
        const sub = await stripe.subscriptions.retrieve(appUser.stripe_subscription_id)
        const status = sub.status
        if (status === "active" || status === "trialing") {
          return NextResponse.json(
            { error: "Subscription already active in Stripe" },
            { status: 409 }
          )
        }
      } catch (e) {
        console.warn("Stripe subscription retrieve failed; continuing:", e)
      }
    }

    // 4) Reuse or create Stripe customer
    let customerId = appUser.stripe_customer_id ?? null

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: appUser.email ?? user.email ?? undefined,
        metadata: {
          supabase_uid: user.id,
        },
      })
      customerId = customer.id

      const { error: updateErr } = await supabaseAdmin
        .from("users")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id)

      if (updateErr) {
        console.error("Failed to persist stripe_customer_id:", updateErr)
        return NextResponse.json(
          { error: "Failed to create billing customer" },
          { status: 500 }
        )
      }
    }

    // 5) Create checkout session
    const priceId = mustGetEnv("STRIPE_PRO_PRICE_ID")
    const baseUrl = await getBaseUrlFromHeaders()

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],

      metadata: {
        supabase_uid: user.id,
      },

      allow_promotion_codes: true,

      customer_update: {
        address: "auto",
        name: "auto",
      },

      success_url: `${baseUrl}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/subscribe`,
    })

    if (!session.url) {
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: 500 }
      )
    }

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error("create-checkout-session error:", err)
    return NextResponse.json(
      { error: "Server error creating checkout session" },
      { status: 500 }
    )
  }
}