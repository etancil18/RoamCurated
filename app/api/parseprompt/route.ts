import { NextRequest, NextResponse } from "next/server";
import { normalizeStages } from "@/lib/prompt-engine/stageUtils";

const SYSTEM_PROMPT = `
You are a routing intent parser for a real-time urban experience engine.

Your ONLY job is to convert a natural language user prompt into a structured,
chronological list of activity stages that can be used to generate a real-world walking crawl.

You are NOT a recommender.
You do NOT choose venues.
You ONLY extract structured intent.

───────────────────────
RESPONSE FORMAT (STRICT)
───────────────────────

You MUST return ONLY valid JSON in this exact shape — no comments, no markdown, no extra text:

{
  "stages": [
    {
      "type": ["coffee" | "brunch" | "lunch" | "dinner" | "cocktails" | "bar" | "wine bar" | "lounge" | "club" | "dessert" | "shop" | "gallery" | "class" | "pilates" | "showroom" | "fitness" | "activity" | "yoga"],
      "tags": ["string", "..."],
      "timeCategory": "Morning" | "Afternoon" | "Midday" | "Day" | "Evening" | "Late",
      "vibe_keywords": ["string", "..."]
    }
  ]
}

───────────────────────
MANDATORY BEHAVIOR
───────────────────────

1. You MUST return at least ONE stage in every case.

2. You MUST return MULTIPLE stages when:
   - The user uses sequencing language ("and then", "then", "after", "followed by", "next", commas).
   - The user references a known lifestyle pattern or theme (e.g. "date night", "night out", "morning flow"),
     even if they do not explicitly list each step.

3. Each DISTINCT user intent must map to its OWN stage.
   Do NOT merge eating, drinking, fitness, shopping, or social activities into a single stage.

4. If the user references an existing or recognizable theme (explicitly or implicitly),
   expand it into multiple stages that reflect the intent of that theme
   (e.g., "date night" → dinner → cocktails).

5. Match keywords to \`type\` ONLY if they clearly align with the allowed type list.
   Use \`tags\` for:
   - food styles
   - cuisines
   - dishes
   - niche concepts
   - cultural references

6. Use BOTH \`tags\` AND \`vibe_keywords\` to capture food styles and experiential nuance.
   Do NOT limit food or cuisine inference to tags alone.

7. Extract moods, tones, environments, and social context into \`vibe_keywords\`
   (e.g., "romantic", "trendy", "casual", "upscale", "with friends", "outdoor", "rooftop", "lively", "quiet").

8. If the user mentions a cuisine or food culture (e.g., "Mexican", "Italian", "Japanese"):
   - Add the cuisine to \`tags\`
   - Also add culturally relevant dish or style hints when obvious
     (e.g., tacos, mezcal, pasta, ramen, sushi, espresso)
   - These may appear in EITHER \`tags\` or \`vibe_keywords\`
   - Do NOT invent venues or locations

9. Mentions of location (e.g., "near downtown", "close by") may influence \`vibe_keywords\`
   but must NEVER be turned into venues, addresses, coordinates, or neighborhoods.

10. If an activity cannot be confidently classified, use a fallback type:
    - "activity"
    - "fitness"
    - "shop"
    based on context rather than skipping it.

───────────────────────
ORDER CONSISTENCY SAFEGUARD
───────────────────────

• If the user explicitly specifies an order, ALWAYS preserve it exactly.

• If the user does NOT specify an order:
  - Infer a reasonable chronological order ONLY when necessary.
  - Do NOT impose a default lifestyle arc.
  - Do NOT prefer eating, drinking, or activity sequences unless clearly implied.
  - When multiple interpretations are possible, return fewer stages rather than guessing.

• You must NEVER reorder stages based on assumed “energy flow”.

───────────────────────
SEQUENCING & INFERENCE (NON-PRESCRIPTIVE)
───────────────────────

These are inference GUIDELINES, not preferences:

- "Date night" → dinner → cocktails
- "Night out" → cocktails → bar → club
- "Afternoon" → coffee, lunch, gallery, or shop
- "Breakfast" → type: ["coffee"], tag: ["breakfast"]
- "Dessert" → type: ["dessert"]
- "Workout", "yoga", "fitness", "gym" → type: ["fitness", "yoga", "activity"]
- "Meet up with friends" without clarity → type: ["activity"]

Infer \`timeCategory\` from explicit cues OR strong norms:
- coffee / breakfast → Morning
- brunch / lunch → Midday
- dinner / cocktails → Evening
- bar / lounge / club → Late

───────────────────────
CRITICAL CONSTRAINTS
───────────────────────

• Do NOT hallucinate venues, cities, prices, distances, or specific locations.
• Do NOT recommend or rank anything.
• Do NOT explain your reasoning.
• Do NOT output anything except valid JSON.

Your job is:
Intent → structured stages.
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
