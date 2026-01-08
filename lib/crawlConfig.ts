import { CrawlTheme } from "@/lib/theme-engine/types"; 

export const crawlThemes: CrawlTheme[] = [
  {
  themeId: "active-all-day",
  name: "Active All Day",
  description: "High-energy city day powered by movement, outdoor play, and physical challenges. For explorers who'd rather sweat than sit.",
  stageFlow: ["fitness", "market", "park",  "lunch", "activity", "dinner", "bar"],
  filters: {
    price: [1, 2, 3],
    timeOfDay: ["morning", "day", "evening"],
    vibes: [
      "movement", "active", "fitness", "yoga", "sports", "social", "energy", "explore", "hike", "bike", "trail", "run", "sweat", 
      "outdoor", "sunlight", "adventure", "energetic", "challenge", "refuel"
    ],
    tags: ["fitness", "juice", "bike ride", "hike", "market", "rooftop", "late-night"],
    eventCategories: [
      "fitness", "outdoor", "movement", "adventure", "market", "juice", "rooftop", "energy"
    ]
  },
  keywords: [
    "workout", "fitness", "run", "ride", "bike", "trail", "hike", "park", "sunlight", "outdoor",
    "adventure", "sweat", "recovery", "juice", "protein", "group class", "step count", "refuel",
    "active", "play", "explore"
  ]
},
  {
  "themeId": "cheap-cheerful",
  "name": "Cheap & Cheerful",
  "description": "Low-budget gems, fast bites, and casual fun throughout the city.",
  "stageFlow": ["coffee", "market", "random gem", "gallery", "dinner", "bar"],
  "filters": {
    "price": [1, 2],
    "vibes": [
      "diner", "cheap", "budget", "street", "casual", "$", "bite", "fast", "local",
      "market", "takeout", "gallery", "food truck", "friendly", "laid-back", "quirky",
      "no-frills", "unpretentious", "daytime", "fun", "easy", "snappy"
    ],
    "tags": ["coffee", "market", "random gem", "gallery", "dinner", "bar"],
    "timeOfDay": ["day", "evening"]
  },
  "keywords": [
    "diner", "cheap", "budget", "street", "casual", "$", "bite", "fast", "local",
    "market", "takeout", "gallery", "food truck", "friendly", "laid-back", "quirky",
    "no-frills", "snappy", "easy", "bargain", "hangout", "on-the-go", "lively",
    "unpretentious", "simple", "affordable"
  ]
},
  {
    themeId: "chill-hang",
    name: "Chill Hang",
    description: "Coffee → books → bites → easy vibes → nightcap.",
    stageFlow: ["coffee", "bookstore", "random gem", "lunch", "lifestyle", "bar", "dessert"],
    filters: {
      price: [1, 2, 3],
      vibes: ["lounge", "cozy", "relaxed", "intimate", "chill", "sofa", "vintage", "casual", "warm", "neighborhood", "laid-back", "friendly", "comfort", "easygoing", "snack", "small bite", "lowkey", "hangout", "easy", "slow", "conversation", "quiet"],
      tags: ["coffee", "bookstore", "random gem", "lunch", "lifestyle", "bar", "dessert"],
      timeOfDay: ["day", "evening"],
    },
    keywords: [
      "lounge", "cozy", "relaxed", "intimate", "chill", "sofa", "vintage", "casual", "warm", "neighborhood", "laid-back", "friendly", "comfort", "easygoing", "snack", "small bite", "lowkey", "hangout", "easy", "slow", "conversation", "quiet"
    ]
  },
  {
  themeId: "creative-kickstart",
  name: "Creative Kickstart",
  description: "Inspiration stops to fuel the imagination.",
  stageFlow: ["coffee", "gallery", "random gem", "bookstore", "lunch"],
  filters: {
    price: [1, 2, 3],
    tags: ["coffee", "gallery", "random gem", "bookstore", "lunch"],
    vibes: [
      "studio", "journal", "sketch", "gallery", "quiet", "inspiration", "café",
      "bookstore", "sunny", "vinyl", "art", "notebook", "design", "creative space",
      "makers", "colorful", "imaginative", "brainstorm", "cozy", "thoughtful", "ideas",
      "workspace", "open-ended", "expressive"
    ],
    timeOfDay: ["morning", "day"]
  },
  keywords: [
    "studio", "journal", "sketch", "gallery", "quiet", "inspiration", "café",
    "bookstore", "sunny", "vinyl", "art", "notebook", "design", "creative space",
    "makers", "colorful", "thoughtful", "ideas", "imaginative", "brainstorm",
    "sketchbook", "expressive", "concept", "muse", "creative"
  ]
},
  {
  themeId: "date-night",
  name: "Date Night",
  description: "Romance, dim lights, and dessert to close the evening.",
  stageFlow: ["dinner", "cocktail", "dessert"],
  filters: {
    price: [2, 3, 4],
    timeOfDay: ["evening", "night"],
    vibes: [
      "romantic", "cocktail", "jazz", "twilight", "wine", "dim", "moody",
      "candlelit", "intimate", "charming", "flirty", "cozy", "soft",
      "sweet", "elegant", "lush", "quiet", "dreamy", "gentle", "classic",

      "warm", "lowlit", "refined", "stylish", "serene", "sensual",
      "plush", "polished", "tasteful", "inviting", "sultry", "relaxed",
      "timeless", "romanticized", "velvety", "slow"
    ],
    tags: ["dinner", "cocktail", "dessert", "wine bar"],
  },
  keywords: [
    "romantic", "cocktail", "jazz", "twilight", "wine", "dim", "moody",
    "candlelit", "intimate", "charming", "flirty", "cozy", "soft",
    "sweet", "elegant", "lush", "quiet", "dreamy", "gentle", "classic",

    "date", "night", "dinner", "dessert", "slow", "ambient",
    "lowkey", "stylish", "refined", "warm", "softlight", "velvet",
    "mood", "connection", "conversation", "chemistry", "spark",
    "indulgent", "together"
  ]
},
  {
  themeId: "gameday-vibes",
  name: "Gameday Vibes",
  description: "Settle into the city’s best sports bars, taprooms, and wing spots to catch the game in high-def with high vibes.",
  stageFlow: ["lunch", "brewery", "bar", "bar", "cocktail"],
  filters: {
    price: [1, 2],
    timeOfDay: ["day", "evening", "night"],
    vibes: [
      "sports", "rowdy", "screen", "beer", "gameday", "fans", "casual", "lively", "loud", "fun",
      "tailgate", "chill", "celebratory", "teams", "energy", "crowd", "cheer", "wings", "burgers", "pitchers", "game", "football", "basketball", "baseball", "soccer", "social"
    ],
    tags: [
      "bar", "brewery", "wings", "burgers", "screens", "pitchers", "game", "football", "basketball", "baseball"
    ],
    eventCategories: [
      "sports", "watch party", "drinks", "food", "bar", "brewery", "casual hang"
    ]
  },
  keywords: [
  "gameday", "watchparty", "football", "superbowl", "collegeball", "nba", "tailgate",
  "pitchers", "screens", "sportsbar", "wings", "burgers", "brewery", "celebrate",
  "fange ar", "touchdown", "tipoff", "rivalry", "crowd",
  "cheering", "kickoff", "buzzer", "halftime", "replay", "fans", "teams",
  "squad", "highfive", "draft", "matchup", "lineup", "energy", "shout",
  "barstool", "hangout", "clutch", "huddle", "moment", "cheer", "social"
]
},
  {
  themeId: "friends-night-out",
  name: "Friends Night Out",
  description: "Food → pregame → party → questionable decisions.",
  stageFlow: ["dinner", "bar", "bar", "club", "late-night"],
  filters: {
    price: [1, 2, 3],
    vibes: [
      "loud", "shareable", "pitchers", "group", "crowded", "bar", "dinner", "club", "dj",
      "party", "scene", "drinks", "late-night", "social", "vibrant", "shots", "energy",
      "rowdy", "dance", "hype", "weekend", "pregame", "cheers", "lit", "celebrate", "spontaneous",
      "turnup", "toasts", "nightlife", "squad", "reckless"
    ],
    tags: ["dinner", "bar", "bar", "club", "late-night"],
    timeOfDay: ["night", "late-night"]
  },
  keywords: [
    "loud", "shareable", "pitchers", "group", "crowded", "bar", "dinner", "club", "dj",
    "party", "scene", "drinks", "late-night", "social", "vibrant", "shots", "energy",
    "rowdy", "dance", "hype", "weekend", "pregame", "cheers", "lit", "toasts", "nightlife",
    "squad", "celebrate", "reckless", "afterhours", "spontaneous", "turnup"
  ]
},
  {
    themeId: "gallery-crawl",
    name: "Gallery Crawl",
    description: "Galleries and artsy stops with great aesthetics.",
    stageFlow: ["gallery", "gallery", "lunch", "wine bar", "music"],
    filters: {
      price: [2, 3],
      vibes: ["gallery", "exhibit", "art", "creative", "museum", "opening", "culture", "fine art", "contemporary", "showcase", "art walk", "curated", "aesthetic", "stylish", "visual", "inspired", "refined", "chic", "trendy", "modern", "buzz"],
      tags: ["gallery", "gallery", "lunch", "wine bar", "music"],
      timeOfDay: ["day","evening"],
    },
    keywords: [
      "gallery", "exhibit", "art", "creative", "museum", "opening", "culture", "fine art", "contemporary", "showcase", "art walk", "curated", "aesthetic", "stylish", "visual", "inspired", "refined", "chic", "trendy", "modern", "buzz"
    ]
  },
  {
    themeId: "saturday-surge",
    name: "Saturday Surge",
    description: "Max energy from afternoon to after hours.",
    stageFlow: ["activity", "bar", "dinner", "bar", "club", "late-night"],
    filters: {
      price: [2, 3, 4],
      vibes: ["dance", "dj", "crowded", "club", "party", "high energy", "beats", "rooftop", "late", "scene", "vibrant", "after hours"],
      tags: ["activity", "bar", "dinner", "bar", "club", "late-night"],
      timeOfDay: ["evening","night","late-night"],
    },
    keywords: [
      "dance", "dj", "crowded", "club", "party", "high energy", "beats", "rooftop", "late", "scene", "vibrant", "after hours"
    ]
  },
  {
  themeId: "solo-explorer",
  name: "Solo Explorer",
  description: "Cozy solo spots and hidden gems for wandering.",
  stageFlow: ["coffee", "museum", "bookstore", "lunch", "lifestyle", "random gem", "wine bar"],
  filters: {
    price: [1, 2],
    vibes: [
      "bookstore", "gallery", "quiet", "scenic", "café", "park", "garden", "introspective",
      "nook", "wander", "hidden", "serene", "thoughtful", "breezy", "curious", "offbeat",
      "reflective", "unplanned", "meander", "casual"
    ],
    tags: ["coffee", "random gem", "bookstore", "market", "park", "rooftop"],
    timeOfDay: ["day", "evening"]
  },
  keywords: [
    "bookstore", "gallery", "quiet", "scenic", "café", "park", "garden", "introspective",
    "nook", "wander", "hidden", "photo", "gem", "unplanned", "solo", "curious",
    "museum", "artsy", "window", "vintage", "detour", "notebook", "meander", "reflective",
    "breeze", "calm", "roam"
  ]
},
  {
  themeId: "sunday-reset",
  name: "Sunday Reset",
  description: "Restore your soul with quiet spaces, gentle wellness, and cozy comfort.",
  stageFlow: ["fitness", "coffee", "market", "lifestyle", "bookstore", "dinner"],
  filters: {
    price: [1, 2, 3],
    timeOfDay: ["morning", "day", "evening"],
    vibes: [
      "garden", "tea", "spa", "quiet", "book", "relax", "wellness", "reflection",
      "meditation", "sunlight", "fresh", "slow",
      "cozy", "warm", "soft", "restful", "breezy", "clean",
      "mindful", "airy", "simple", "light", "nourish", "glow",
      "reset", "peaceful", "unwind", "breathe"
    ],
    tags: ["fitness", "market", "lifestyle", "bookstore", "dinner"],
  },
  keywords: [
    "garden", "tea", "spa", "quiet", "book", "relax", "wellness", "reflection",
    "meditation", "sunlight", "fresh", "slow",
    "sunday", "reset", "soft", "ritual", "cleanse", "calm",
    "unwind", "balance", "nourish", "still", "glow", "breathe",
    "yoga", "journal", "stretch", "flow", "routine", "lowkey"
  ]
},
{
  themeId: "work-session",
  name: "Work Session",
  description: "Power through tasks with caffeine, quiet corners, and a rewarding close.",
  stageFlow: ["coffee", "lunch", "coffee", "cocktail"],
  filters: {
    price: [1, 2, 3],
    tags: ["coffee", "lunch", "coffee", "cocktail"],
    vibes: [
      "cafe", "wifi", "coffee", "focus", "remote-friendly", "laptop", "casual", "quiet",
      "workspace", "daytime", "study", "productive", "neighborhood", "light music",
      "comfortable seating", "independent", "easygoing", "minimal", "energized"
    ],
    timeOfDay: ["morning", "day"]
  },
  keywords: [
    "cafe", "wifi", "coffee", "focus", "remote-friendly", "laptop", "casual", "quiet",
    "workspace", "daytime", "study", "productive", "neighborhood", "light music",
    "comfortable seating", "outlet", "windows", "concentration", "notebook", "journal",
    "session", "solo", "sip", "menu", "relaxed", "airiness"
  ]
}
,
{
  themeId: "last-call",
  name: "Last Call",
  description: "A wild night that doesn’t end when the lights go out.",
  stageFlow: ["bar", "club", "late-night", "speakeasy", "lounge", "after hours"],
  filters: {
    timeOfDay: ["night", "late-night"],
    price: [1, 2, 3],
  },
  keywords: [
    "late-night", "karaoke", "after hours", "lively", "spontaneous", "gritty",
    "unfiltered", "nocturnal", "dance", "dark", "shots", "underground",
    "loose", "unhinged", "boozy", "nightcap"
  ]
},
{
  themeId: "mindful-mornings",
  name: "Mindful Mornings",
  description: "Ease into the day with peace, balance, and clarity.",
  stageFlow: ["wellness", "coffee", "garden", "market", "spa"],
  filters: {
    timeOfDay: ["morning"],
    price: [1, 2],
    vibes: [
      "calm", "gentle", "quiet", "intentional", "sunlit", "light", "fresh",
      "reflective", "still", "balanced", "restorative", "centered", "peaceful",
      "cozy", "soft", "slowness", "natural", "clear", "grounded", "ease"
    ]
  },
  keywords: [
    "yoga", "meditation", "spa", "sunlight", "tea", "calm", "minimal",
    "introspective", "garden", "journal", "wellness", "fresh air", "stretch",
    "breathe", "ritual", "balance", "clarity", "gentle", "routine", "mindful",
    "morning", "flow", "reset", "ease", "solo", "cozy", "peace", "light"
  ]
},
{
  themeId: "pages-to-pours",
  name: "Pages to Pours",
  description: "A cozy blend of books, art, and wine-soaked thought.",
  stageFlow: ["bookstore", "coffee", "gallery", "wine bar", "lounge"],
  filters: {
    timeOfDay: ["day", "evening"],
    price: [1, 2, 3],
    vibes: [
      "quiet", "cozy", "literary", "analog", "warm", "vintage", "reflective",
      "moody", "artsy", "thoughtful", "bookish", "soft", "curated", "charming",
      "elegant", "snug", "relaxed", "dreamy", "writerly", "poetic"
    ]
  },
  keywords: [
    "bookstore", "quiet", "cozy", "literary", "analog", "warm", "vintage",
    "library", "indie", "wine", "reflective", "moody", "ink", "writerly",
    "poetic", "sips", "sofa", "read", "pages", "glass", "conversation", "culture",
    "gallery", "ambient", "slow", "soft"
  ]
},
{
  themeId: "party-time",
  name: "Party Time",
  description: "Bring the crew. Tonight, the city is yours.",
  stageFlow: ["bar", "dinner", "bar", "club", "late-night"],
  filters: {
    timeOfDay: ["evening", "night"],
    price: [2, 3, 4],
    vibes: [
      "rowdy", "flashy", "high-energy", "social", "crowded", "fun", "late", "wild",
      "buzzing", "glow", "pulsing", "neon", "afterdark", "boozy", "bold",
      "hype", "intense", "buzzy", "playful", "electric"
    ]
  },
  keywords: [
    "club", "dance", "beats", "late", "dj", "loud", "drinks", "bar",
    "crowded", "energy", "flashy", "afterhours", "party", "scene",
    "friends", "rowdy", "weekend", "pregame", "lit", "cheers", "social",
    "shots", "celebrate", "nightout", "hype", "bass", "vibes", "neon", "rooftop"
  ]
},
{
  themeId: "post-work-wind-down",
  name: "Post‑Work Wind Down",
  description: "Unplug and ease into the evening after a long day.",
  stageFlow: ["bar", "dinner", "cocktail", "lounge"],
  filters: {
    timeOfDay: ["evening"],
    price: [1, 2, 3],
    vibes: [
      "relaxed", "cooldown", "casual", "afterwork", "patio", "easy", "laidback",
      "mellow", "chill", "breezy", "social", "unwind", "refined", "slow",
      "ambient", "light", "buzz", "friendly", "winddown", "lowkey"
    ]
  },
  keywords: [
    "happy hour", "bar", "tapas", "light bite", "craft beer", "after work",
    "relax", "casual", "patio", "drinks", "mingle", "unwind", "refresh",
    "lowkey", "cooldown", "ambient", "hangout", "winddown", "ease",
    "chill", "lounge", "laidback", "slow", "evening", "buzz", "friendly"
  ]
},
{
  themeId: "self-care",
  name: "Self‑Care",
  description: "Replenish your energy with serene solo stops.",
  stageFlow: ["fitness", "spa", "tea", "bookstore", "park"],
  filters: {
    timeOfDay: ["day"],
    price: [1, 2, 3],
    vibes: [
      "calm", "serene", "gentle", "restful", "quiet", "mindful", "soothing",
      "grounded", "soft", "warm", "peaceful", "healing", "slow", "nourishing",
      "private", "intentional", "cozy", "balanced", "reflective", "restorative"
    ]
  },
  keywords: [
    "spa", "relax", "yoga", "meditation", "serenity", "retreat", "tea",
    "calm", "detox", "massage", "rejuvenate", "peace",
    "wellness", "breathe", "stillness", "reset", "balance", "restore",
    "solo", "gentle", "quiet", "soft", "unwind", "care"
  ]
},
{
  themeId: "sunrise-start",
  name: "Sunrise Start",
  description: "Begin your day grounded and energized.",
  stageFlow: ["fitness", "bakery", "coffee", "market", "park"],
  filters: {
    timeOfDay: ["morning"],
    price: [1, 2],
    vibes: [
      "fresh", "early", "sunrise", "cozy", "quiet", "mindful", "energizing", "slow",
      "breezy", "grounded", "warm", "natural", "gentle", "routine", "restorative",
      "soft", "peaceful", "intentional", "inviting", "morning"
    ]
  },
  keywords: [
    "coffee", "matcha", "sunrise", "morning", "café", "bakery", "brunch", "acai",
    "patio", "quiet", "fresh", "early", "energizing", "routine", "mindful",
    "stretch", "wellness", "cozy", "warm", "comforting", "inviting",
    "breeze", "peaceful", "slow", "outdoor", "daylight", "granola", "leisurely", "reset"
  ]
},
{
  themeId: "midday-recharge",
  name: "Midday Recharge",
  description: "A relaxing midday refresh to reset and recharge before the evening.",
  stageFlow: ["coffee", "lunch", "park", "gallery"],
  filters: {
    timeOfDay: ["day"],
    price: [1, 2, 3],
    vibes: [
      "refresh", "sunny", "breezy", "chill", "casual", "cozy", "relaxed",
      "light", "calm", "neighborhood", "pause", "airy", "open", "flow",
      "quiet", "easy", "slow", "soft", "unwind", "clean"
    ]
  },
  keywords: [
    "lunch", "coffee", "café", "juice", "quick", "park", "sunlight", "relaxed",
    "casual", "chill", "grab", "outdoor", "neighborhood", "gallery",
    "pause", "break", "breezy", "open", "lowkey", "refresh",
    "easygoing", "cozy", "clean", "flow"
  ]
}
];

// ✅ Quick lookup
export const themeById: Record<string, CrawlTheme> = Object.fromEntries(
  crawlThemes.map((t) => [t.themeId, t])
);
