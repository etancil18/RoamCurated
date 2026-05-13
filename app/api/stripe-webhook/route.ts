import Stripe from "stripe"
import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set")
  }

  return new Stripe(process.env.STRIPE_SECRET_KEY)
}

function getSupabaseAdmin() {
  return supabaseAdmin
}

export async function POST(req: Request) {
  const stripe = getStripe()
  const supabase = getSupabaseAdmin()

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

  const body = await req.text()

  const headersList = await headers()
  const signature = headersList.get("stripe-signature")

  if (!signature) {
    return new NextResponse("Missing Stripe signature", { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    )
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message)
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 })
  }

  try {
    const eventId = event.id

    const { data: existingEvent } = await supabase
      .from("stripe_webhook_events")
      .select("id")
      .eq("id", eventId)
      .maybeSingle()

    if (existingEvent) {
      console.log("Duplicate Stripe webhook ignored:", eventId)
      return NextResponse.json({ received: true })
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session

        const supabaseUid = session.metadata?.supabase_uid
        const customerId = session.customer as string
        const subscriptionId = session.subscription as string

        if (!supabaseUid) {
          console.error("Missing supabase_uid metadata")
          break
        }

        await supabase
          .from("users")
          .update({
            subscription_status: "active",
            subscription_tier: "pro",
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
          })
          .eq("id", supabaseUid)

        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription

        await supabase
          .from("users")
          .update({
            subscription_status: "free",
            subscription_tier: "free",
            stripe_subscription_id: null,
          })
          .eq("stripe_subscription_id", subscription.id)

        break
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = (invoice as any).subscription as string

        await supabase
          .from("users")
          .update({
            subscription_status: "free",
            subscription_tier: "free",
          })
          .eq("stripe_subscription_id", subscriptionId)

        break
      }

      default:
        console.log(`Unhandled event type ${event.type}`)
    }

    await supabase
      .from("stripe_webhook_events")
      .insert({ id: eventId })

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error("Webhook handler error:", err)
    return new NextResponse("Webhook handler failed", { status: 500 })
  }
}