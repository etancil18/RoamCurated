import { NextRequest, NextResponse } from "next/server";
import { normalizeStages } from "@/lib/prompt-engine/stageUtils";

/**
 * Weak, low-signal food nouns that should NEVER trigger Commit by themselves
 */
const WEAK_FOOD_TAGS = [
  "sandwich",
  "burger",
  "taco",
  "slice",
  "pizza",
  "sub",
  "hoagie",
  "wrap",
];

/**
 * Explicit intent anchors inferred directly from user language.
 * These MUST win over vague LLM outputs.
 */
const EXPLICIT_INTENT_KEYWORDS: Record<string, string[]> = {
  dinner: ["dinner", "supper", "restaurant"],
  lunch: ["lunch"],
  brunch: ["brunch"],
  breakfast: ["breakfast"],
  cocktails: ["cocktail", "cocktails", "drinks"],
  bar: ["bar", "drinks", "drinking", "happy hour"],
  wine: ["wine", "vino"],
};

/**
 * Canonical allowed stage types (SYSTEM OF RECORD)
 */
const ALLOWED_STAGE_TYPES = new Set([
  "coffee",
  "breakfast",
  "brunch",
  "lunch",
  "dinner",
  "cocktails",
  "bar",
  "wine bar",
  "lounge",
  "club",
  "dessert",
  "shop",
  "gallery",
  "class",
  "pilates",
  "showroom",
  "fitness",
  "activity",
  "yoga",
]);

/**
 * Map vague, singular, or unsupported nouns → canonical service types
 * This is a translation layer between human phrasing and Roam's schema.
 */
const TYPE_NORMALIZATION_MAP: Record<string, string> = {
  // -----------------------
  // DRINKS
  // -----------------------

  cocktail: "cocktails",
  cocktails: "cocktails",
  drink: "bar",
  drinks: "bar",
  drinking: "bar",
  barhop: "bar",
  barhopping: "bar",
  pub: "bar",
  tavern: "bar",
  brewery: "bar",
  beer: "bar",
  beers: "bar",
  wine: "wine bar",
  wines: "wine bar",
  vino: "wine bar",
  speakeasy: "bar",
  happyhour: "bar",
  "happy hour": "bar",

  // -----------------------
  // FOOD (generic → contextual meal)
  // -----------------------

  restaurant: "dinner",
  restaurants: "dinner",
  food: "lunch",
  eating: "lunch",
  eat: "lunch",
  meal: "dinner",
  meals: "dinner",
  bite: "lunch",
  bites: "lunch",
  snack: "lunch",
  snacks: "lunch",
  spot: "lunch",
  dinnerdate: "dinner",
  datenight: "dinner",

  // -----------------------
  // COFFEE / MORNING
  // -----------------------

  cafe: "coffee",
  café: "coffee",
  coffeeshop: "coffee",
  espresso: "coffee",
  latte: "coffee",
  cappuccino: "coffee",

  // -----------------------
  // DESSERT
  // -----------------------

  sweets: "dessert",
  sweet: "dessert",
  icecream: "dessert",
  "ice cream": "dessert",
  bakery: "dessert",
  pastries: "dessert",
  cake: "dessert",

  // -----------------------
  // FITNESS / MOVEMENT
  // -----------------------

  workout: "fitness",
  gym: "fitness",
  lifting: "fitness",
  run: "activity",
  walk: "activity",
  hike: "activity",
  pilates: "pilates",
  yoga: "yoga",
  meditation: "yoga",

  // -----------------------
  // CULTURE / BROWSING
  // -----------------------

  museum: "museum",
  exhibit: "gallery",
  exhibition: "gallery",
  art: "gallery",
  bookstore: "bookstore",
  shopping: "lifestyle",
  boutique: "lifestyle",

  // -----------------------
  // NIGHTLIFE
  // -----------------------

  nightlife: "bar",
  clubbing: "club",
  dance: "club",
  dancing: "club",
};


/**
 * System prompt unchanged (intentionally)
 */
const SYSTEM_PROMPT = `
You are a routing intent parser for a guided urban experience system.

Roam is NOT a search engine.
Roam is a guided experience.

Your job is to:
1. Extract structured, chronological activity stages
2. Capture cuisines, vibes, and experiential nuance
3. Classify confidence into EXACTLY ONE tier

You are NOT a recommender.
You do NOT choose venues.
You ONLY extract intent.

Return ONLY valid JSON:

{
  "tier": "commit" | "constrain" | "clarify",
  "stages": [
    {
      "type": ["coffee","cafe","café","breakfast","brunch","lunch","dinner","cocktails","bar","wine bar","lounge","club","dessert","lifestyle","gallery","class","pilates","showroom","fitness","activity","yoga"],
      "tags": ["string"],
      "timeCategory": "Morning" | "Afternoon" | "Midday" | "Day" | "Evening" | "Late",
      "vibe": ["string"]
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

6. Use BOTH \`tags\` AND \`vibe\` to capture food styles and experiential nuance.
   Do NOT limit food or cuisine inference to tags alone.

7. Extract moods, tones, environments, and social context into \`vibe\`
   (e.g., "romantic", "trendy", "casual", "upscale", "with friends", "outdoor", "rooftop", "lively", "quiet").

8. If the user mentions a cuisine or food culture (e.g., "Mexican", "Italian", "Japanese"):
   - Add the cuisine to \`tags\`
   - Also add culturally relevant dish or style hints when obvious
     (e.g., tacos, mezcal, pasta, ramen, sushi, espresso)
   - These may appear in EITHER \`tags\` or \`vibe\`
   - Do NOT invent venues or locations

9. Mentions of location (e.g., "near downtown", "close by") may influence \`vibe\`
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

STRICT OUTPUT RULES:
• JSON ONLY
• No markdown
• No comments
• No explanations
`;

const MODEL = process.env.OPENROUTER_MODEL ?? "mistralai/mixtral-8x7b";
const MAX_RETRIES = 2;

/* ---------------- LLM CALL ---------------- */

async function callLLM(prompt: string, attempt = 0): Promise<any> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY");
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://roam.cool",
      "X-Title": "Roam Intent Compiler",
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
    throw new Error(`LLM request failed (${res.status})`);
  }

  const json: any = await res.json();
  const message: string | undefined = json?.choices?.[0]?.message?.content;

  if (!message) {
    throw new Error("Empty LLM response");
  }

  try {
    return JSON.parse(message);
  } catch {
    if (attempt < MAX_RETRIES) {
      return callLLM(prompt, attempt + 1);
    }
    throw new Error("Invalid JSON returned by LLM");
  }
}

/* ---------------- INTENT ENFORCEMENT ---------------- */

function extractExplicitIntents(prompt: string): Set<string> {
  const lower = prompt.toLowerCase();
  const intents = new Set<string>();

  const entries = Object.entries(
    EXPLICIT_INTENT_KEYWORDS as Record<string, string[]>
  );

  for (const [type, keywords] of entries) {
    if (keywords.some((k) => lower.includes(k))) {
      intents.add(type);
    }
  }

  return intents;
}

function enforceCanonicalTypes(parsed: any): void {
  if (!Array.isArray(parsed.stages)) return;

  for (const stage of parsed.stages) {
    stage.type = Array.isArray(stage.type)
      ? stage.type
          .map((t: string) => t.toLowerCase())
          .map((t: string) => TYPE_NORMALIZATION_MAP[t] ?? t)
          .filter((t: string) => ALLOWED_STAGE_TYPES.has(t))
      : [];
  }
}

/**
 * 🔒 HARD GUARANTEE:
 * Explicit dinner / cocktails can NEVER collapse into activity/class/etc.
 */
function enforceExplicitIntentAnchors(
  parsed: any,
  explicitIntents: Set<string>
): void {
  const enforcedStages: Array<{
    type: string[];
    tags: string[];
    vibe: string[];
  }> = [];

  for (const intent of explicitIntents) {
    if (["dinner", "lunch", "brunch", "breakfast"].includes(intent)) {
      enforcedStages.push({
        type: [intent],
        tags: [],
        vibe: [],
      });
    }

    if (intent === "cocktails" || intent === "bar" || intent === "wine") {
      enforcedStages.push({
        type: ["cocktails"],
        tags: [],
        vibe: [],
      });
    }
  }

  if (enforcedStages.length > 0) {
    parsed.stages = enforcedStages;
  }
}

function ensureAtLeastOneStage(parsed: any): void {
  if (!Array.isArray(parsed.stages) || parsed.stages.length === 0) {
    parsed.stages = [
      { type: ["activity"], tags: [], vibe: [] },
    ];
  }
}

/* ---------------- HANDLER ---------------- */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prompt: unknown = body?.prompt;

    if (typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json(
        { error: "Missing or invalid prompt" },
        { status: 400 }
      );
    }

    const parsed = await callLLM(prompt);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      !["commit", "constrain", "clarify"].includes(parsed.tier)
    ) {
      return NextResponse.json(
        { error: "Invalid LLM response" },
        { status: 422 }
      );
    }

    const explicitIntents = extractExplicitIntents(prompt);

    enforceCanonicalTypes(parsed);
    enforceExplicitIntentAnchors(parsed, explicitIntents);
    ensureAtLeastOneStage(parsed);

    const normalizedStages = normalizeStages(parsed.stages);

    return NextResponse.json({
      data: {
        tier: parsed.tier,
        stages: normalizedStages,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to parse intent" },
      { status: 500 }
    );
  }
}
