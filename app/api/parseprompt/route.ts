import { NextRequest, NextResponse } from "next/server";
import { normalizeStages } from "@/lib/prompt-engine/stageUtils";

const SYSTEM_PROMPT = `
You are a routing intent parser for a real-time urban experience engine.

Your ONLY job is to convert a natural language user prompt into a structured, chronological list of activity stages that can be used to generate a real-world walking crawl.

Follow these rules strictly:

───────────────────────
RESPONSE FORMAT (STRICT)
───────────────────────

You MUST return ONLY valid JSON in this shape — no comments, no markdown, no extra text:

{
  "stages": [
    {
      "type": ["coffee" | "brunch" | "lunch" | "dinner" | "cocktails" | "bar" | "wine bar" | "lounge" | "club" | "dessert" | "shop" | "gallery" | "fitness" | "activity" | "yoga"],
      "tags": ["string", "..."],
      "timeCategory": "Morning" | "Afternoon" | "Midday" | "Day" | "Evening" | "Late",
      "vibe_keywords": ["string", "..."]
    }
  ]
}

───────────────────────
MANDATORY BEHAVIOR
───────────────────────

1. Return at least one stage in every case.
2. Return multiple stages if the prompt contains sequencing phrases like:
   - "and then", "then", "followed by", "after", "next", commas, or similar.
3. Each distinct user intent must map to its own stage.
   Do NOT merge distinct activities.
4. Infer timeCategory if possible (e.g., "breakfast" = "Morning", "date night" = "Evening").
5. Match keywords to \`type\` if they align with the list. Use \`tags\` only for food styles or niche terms (e.g., “tapas”, “bbq”, “sushi”).
6. Extract moods, tones, or environmental cues into \`vibe_keywords\` (e.g., "romantic", "casual", "outdoor", "upscale", "with friends", "quiet", "rooftop").
7. Do not hallucinate venues, cities, prices, or specific locations — you only extract structured intent.
8. Mentions of location (e.g., “near downtown”) can inform vibe or tags, but should NOT be turned into venues or coordinates.
9. If an activity cannot be confidently classified, use fallback types like "fitness", "activity", or "shop" based on context.

───────────────────────
SEQUENCING & INFERENCE
───────────────────────

- "Date night" → dinner → cocktails
- "Night out" → cocktails → bar → club
- "Afternoon" → likely coffee, lunch, gallery, or shop
- "Breakfast" → type: ["coffee"], tag: ["breakfast"]
- "Dessert" → type: ["dessert"]
- "Workout", "yoga", "fitness", "gym" → type: ["fitness", "yoga", "activity"]
- If user says "meet up with friends" and no type is clear, fallback to ["activity"]
- Infer \`timeCategory\` from both explicit time cues and activity norms:
  - "club", "lounge", "bar" → "Late"
  - "coffee", "brunch", "breakfast" → "Morning"
  - "dinner", "cocktails" → "Evening"

───────────────────────
EXAMPLES
───────────────────────

Prompt: "breakfast and then yoga with friends"
→
{
  "stages": [
    {
      "type": ["coffee"],
      "tags": ["breakfast"],
      "timeCategory": "Morning",
      "vibe_keywords": []
    },
    {
      "type": ["fitness", "yoga"],
      "tags": ["friends", "yoga"],
      "timeCategory": "Morning",
      "vibe_keywords": ["social", "wellness"]
    }
  ]
}

Prompt: "start with cocktails, then dinner, then a lounge"
→
{
  "stages": [
    {
      "type": ["cocktails"],
      "tags": [],
      "timeCategory": "Evening",
      "vibe_keywords": []
    },
    {
      "type": ["dinner"],
      "tags": [],
      "timeCategory": "Evening",
      "vibe_keywords": []
    },
    {
      "type": ["lounge"],
      "tags": [],
      "timeCategory": "Late",
      "vibe_keywords": []
    }
  ]
}

───────────────────────

DO NOT return anything other than the valid JSON in the schema above.
DO NOT explain your reasoning.
DO NOT include comments or markdown.

Your job is intent → structured stages.
Nothing more.
`;


const MODEL = process.env.OPENROUTER_MODEL || "mistralai/mixtral-8x7b";
const MAX_RETRIES = 2;

async function callLLM(prompt: string, attempt = 0): Promise<any> {
  console.log("🧠 [parseprompt] LLM call start", {
    attempt,
    model: MODEL,
    promptLength: prompt.length,
    promptPreview: prompt.slice(0, 120),
  });

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://roam.cool",
      "X-Title": "Roam Prompt Parser",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("❌ [parseprompt] LLM HTTP error", {
      attempt,
      status: res.status,
      body: text.slice(0, 300),
    });
    throw new Error(`LLM request failed`);
  }

  const json = await res.json();
  const message = json?.choices?.[0]?.message?.content;

  if (!message) {
    console.error("❌ [parseprompt] Empty LLM message", { attempt });
    throw new Error("Empty LLM response");
  }

  try {
    const parsed = JSON.parse(message);
    console.log("✅ [parseprompt] JSON parsed", {
      attempt,
      stageCount: Array.isArray(parsed?.stages) ? parsed.stages.length : 0,
    });
    return parsed;
  } catch (err) {
    console.warn("⚠️ [parseprompt] JSON parse failed", {
      attempt,
      messagePreview: message.slice(0, 200),
    });

    if (attempt < MAX_RETRIES) {
      return callLLM(prompt, attempt + 1);
    }

    throw new Error("Invalid JSON returned by LLM");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prompt = body?.prompt;

    if (!prompt || typeof prompt !== "string") {
      console.warn("⚠️ [parseprompt] Missing prompt");
      return NextResponse.json(
        { error: "Missing or invalid prompt" },
        { status: 400 }
      );
    }

    console.log("📥 [parseprompt] Prompt received", {
      length: prompt.length,
      preview: prompt.slice(0, 120),
    });

    const parsed = await callLLM(prompt);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray(parsed.stages) ||
      parsed.stages.length === 0
    ) {
      console.error("❌ [parseprompt] Invalid stage structure", parsed);
      return NextResponse.json(
        { error: "Invalid stage structure" },
        { status: 422 }
      );
    }

    const normalizedStages = normalizeStages(parsed.stages);

    console.log("🎯 [parseprompt] Final normalized stages", normalizedStages);

    return NextResponse.json({
      data: {
        stages: normalizedStages,
      },
    });
  } catch (err: any) {
    console.error("🔥 [parseprompt] Fatal error", {
      message: err.message,
      stack: err.stack,
    });

    return NextResponse.json(
      { error: "Failed to parse prompt" },
      { status: 500 }
    );
  }
}
