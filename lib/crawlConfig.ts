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
    themeId: "cheap-cheerful",
    name: "Cheap & Cheerful",
    description: "Low-budget gems, fast bites, and casual fun throughout the city.",
    stageFlow: ["coffee", "market", "random gem", "gallery", "dinner", "bar"],
    filters: {
      price: [1, 2],
      vibes: ["diner", "cheap", "budget", "street", "casual", "$", "bite", "fast", "local", "market", "takeout", "gallery", "food truck"],
      tags: ["coffee", "market", "random gem", "gallery", "dinner", "bar"],
      timeOfDay: ["day", "evening"],
    },
    keywords: [
      "diner", "cheap", "budget", "street", "casual", "$", "bite", "fast", "local", "market", "takeout", "gallery", "food truck"
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
      vibes: ["studio", "journal", "sketch", "gallery", "quiet", "inspiration", "café", "bookstore", "sunny", "vinyl", "art", "notebook", "design", "creative space", "makers"],
      timeOfDay: ["morning", "day"],
    },
    keywords: [
      "studio", "journal", "sketch", "gallery", "quiet", "inspiration", "café", "bookstore", "sunny", "vinyl", "art", "notebook", "design", "creative space", "makers"
    ]
  },
  {
    themeId: "date-night",
    name: "Date Night",
    description: "Romance, dim lights, and dessert to close the evening.",
    stageFlow: ["dinner", "cocktail", "dessert"],
    filters: {
      price: [2, 3, 4],
      vibes: ["romantic", "date spot", "cocktail", "jazz", "twilight", "vibe", "wine", "dim", "moody", "candlelit", "intimate", "charming", "slow-paced", "flirty", "cozy", "soft", "sweet", "elegant", "lush", "quiet", "dreamy", "gentle", "classic"],
      tags: ["dinner", "cocktail", "dessert", "wine bar"],
      timeOfDay: ["evening","night"],
    },
    keywords: [
      "romantic", "date spot", "cocktail", "jazz", "twilight", "vibe", "wine", "dim", "moody", "candlelit", "intimate", "charming", "slow-paced", "flirty", "cozy", "soft", "sweet", "elegant", "lush", "quiet", "dreamy", "gentle", "classic"
    ]
  },
  {
  themeId: "december-crawl",
  name: "December Crawl",
  description: "A cozy, twinkling crawl through the city’s best holiday pop-ups, festive markets, warm drinks, and wintery bites.",
  stageFlow: ["market", "random gem", "lunch", "lifestyle", "cocktail", "dinner", "bar"],
  filters: {
    price: [1, 2, 3, 4],
    timeOfDay: ["day", "evening", "night"],
    vibes: [
      "festive", "holiday", "cozy", "twinkling", "seasonal", "cheer", "snowy", "warm", "spiced",
      "lights", "winter", "magical", "nostalgic", "limited", "buzzy", "carols", "glow"
    ],
    tags: [
      "market", "treat", "window", "lights", "holiday", "snow", "sweets", "bites", "bar", "pop-up", "cheer"
    ],
    eventCategories: [
      "holiday", "market", "food", "drinks", "christmas", "cozy", "decorated", "pop-up", "seasonal", "lights", "night walk"
    ]
  },
  keywords: [
    "holiday", "christmas", "seasonal", "festive", "hot chocolate", "mulled wine", "gingerbread",
    "holiday market", "twinkle", "pop-up", "winter", "lights", "caroling", "cozy", "limited time",
    "holiday menu", "cheer", "snow", "ice skate", "gift shopping", "cider", "peppermint"
  ]
},
  {
    themeId: "friends-night-out",
    name: "Friends Night Out",
    description: "Food → pregame → party → questionable decisions.",
    stageFlow: ["dinner", "bar", "bar", "club", "late-night"],
    filters: {
      price: [1, 2, 3],
      vibes: ["loud", "shareable", "pitchers", "group dinner", "crowded", "bar", "dinner", "club", "dj", "party", "scene", "drinks", "late-night", "social", "vibrant", "group", "shots", "energy", "rowdy", "dance", "hype", "weekend", "pregame", "cheers", "lit"],
      tags: ["dinner", "bar", "bar", "club", "late-night"],
      timeOfDay: ["night","late-night"],
    },
    keywords: [
      "loud", "shareable", "pitchers", "group dinner", "crowded", "bar", "dinner", "club", "dj", "party", "scene", "drinks", "late-night", "social", "vibrant", "group", "shots", "energy", "rowdy", "dance", "hype", "weekend", "pregame", "cheers", "lit"
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
    stageFlow: ["coffee", "museum",  "bookstore", "lunch", "lifestyle", "random gem", "wine bar"],
    filters: {
      price: [1, 2],
      vibes: ["bookstore", "gallery", "quiet", "scenic", "café", "park", "rooftop", "garden", "introspective", "nook", "wander", "hidden spot", "photo walk"],
      tags: ["coffee", "random gem", "bookstore", "market", "park", "rooftop"],
      timeOfDay: ["day","evening"],
    },
    keywords: [
      "bookstore", "gallery", "quiet", "scenic", "café", "park", "garden", "introspective", "nook", "wander", "hidden spot", "photo walk"
    ]
  },
  {
  themeId: "sunday-reset",
  name: "Sunday Reset",
  description: "Restore your soul with quiet spaces, gentle wellness, and cozy comfort.",
  stageFlow: ["fitness", "coffee",  "market", "lifestyle", "bookstore", "dinner"],
  filters: {
    price: [1, 2, 3],
    vibes: ["garden", "tea", "spa", "quiet", "book", "relax", "wellness", "reflection", "meditation", "sunlight", "fresh", "slow"],
    tags: ["fitness", "market", "lifestyle", "bookstore", "dinner"],
    timeOfDay: ["morning", "day", "evening"], 
  },
  keywords: [
    "garden", "tea", "spa", "quiet", "book", "relax", "wellness", "reflection", "meditation", "sunlight", "fresh", "slow"
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
    vibes: ["cafe", "wifi", "coffee", "focus", "remote-friendly", "laptop", "casual", "quiet", "workspace", "daytime", "study", "productive", "neighborhood", "light music", "comfortable seating"],
    timeOfDay: ["morning", "day"],
  },
  keywords: [
    "cafe", "wifi", "coffee", "focus", "remote-friendly", "laptop", "casual", "quiet", "workspace", "daytime", "study", "productive", "neighborhood", "light music", "comfortable seating"
  ]
},
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
  },
  keywords: [
    "yoga", "meditation", "spa", "sunlight", "tea", "calm", "minimal",
    "introspective", "garden", "journal", "wellness", "fresh air", "stretch"
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
  },
  keywords: [
    "bookstore", "quiet", "cozy", "literary", "analog", "warm", "vintage",
    "library", "indie", "wine", "reflective", "moody", "ink", "writerly",
    "poetic", "sips"
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
  },
  keywords: [
    "club", "dance", "beats", "late", "dj", "loud", "drinks", "bar",
    "crowded", "energy", "flashy", "after hours", "party", "scene",
    "friends night out", "rowdy", "weekend", "pregame", "lit", "cheers", "social"
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
  },
  keywords: [
    "happy hour", "bar", "tapas", "light bite", "craft beer", "after work",
    "relax", "casual", "patio", "drinks", "mingle", "unwind", "refresh",
    "lowkey", "cooldown", "ambient", "hangout", "winddown", "ease"
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
  },
  keywords: [
    "spa", "relax", "yoga", "meditation", "serenity", "retreat", "tea",
    "calm", "detox", "massage", "rejuvenate", "peace"
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
  },
  keywords: [
    "coffee", "matcha", "sunrise", "morning", "café", "bakery", "brunch", "acai",
    "patio", "quiet", "fresh", "early", "energizing", "routine", "mindful",
    "stretch", "wellness", "cozy", "warm", "comforting", "inviting",
    "breeze", "peaceful", "slow", "outdoor"
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
  },
  keywords: [
    "lunch", "coffee", "café", "juice", "quick bite", "park", "sunlight", "relaxed",
    "low key", "grab-and-go", "outdoor", "break", "neighborhood", "casual",
    "breezy", "chill", "easygoing"
  ]
}
];

// ✅ Quick lookup
export const themeById: Record<string, CrawlTheme> = Object.fromEntries(
  crawlThemes.map((t) => [t.themeId, t])
);
