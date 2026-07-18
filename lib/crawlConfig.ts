import { CrawlTheme } from "@/lib/theme-engine/types"; 

export const crawlThemes: CrawlTheme[] = [
  {
  themeId: "active-all-day",
  name: "Active All Day",
  description: "High-energy city day powered by movement, outdoor play, and physical challenges. For explorers who'd rather sweat than sit.",
  stageFlow: [
  ["fitness", "yoga"],
  ["breakfast", "coffee", "café","market", "park"],
  "activity",
  ["lunch", "rooftop"],
  "dinner"
],
  filters: {
    price: [1, 2, 3],
    timeOfDay: ["morning", "midday", "afternoon","day", "evening"],
    vibes: [
      "movement", "active", "fitness", "yoga", "sports", "social", "energy", "explore", "hike", "bike", "trail", "run", "sweat", 
      "outdoor", "sunlight", "adventure", "energetic", "challenge", "refuel", "dynamic", "mobile",
      "spry", "lively",       
      "fit", "endurance",    
      "stretch", "balance",   
      "teamwork", "competitive",  
      "friendly", "communal",     
      "vibrant", "spark",         
      "discover", "curious",      
      "ascent", "scenic",         
      "pedal", "route",           
      "forest", "open",           
      "sprint", "steady",         
      "effort", "grit",           
      "freshair", "natural",      
      "radiant", "warmth",        
      "thrill", "unknown",        
      "vivacious", "zestful",     
      "test", "endure",           
      "nourish", "refresh" 
    ],
    tags: ["fitness", "juice", "bike ride", "hike", "market", "rooftop", "late-night", "sprint",
  "HIIT",
  "climb",
  "endurance",
  "obstacle",
  "leaderboard",
  "group",
  "league",
  "rooftop",
  "pickup",
  "dance",
  "flashmob",
  "yoga",
  "stretch",
  "hydrate",
  "sauna",
  "recovery",
  "biohack",
  "solo",
  "grind",
  "isolate",
  "performance",
  "intensity",
  "mobility",
  "strength",
  "stamina",
  "community",
  "ritual"],
    eventCategories: [
      "fitness", "outdoor", "movement", "adventure", "market", "juice", "rooftop", "energy"
    ]
  },
  keywords: [
    "workout", "fitness", "run", "ride", "bike", "trail", "hike", "park", "sunlight", "outdoor",
    "adventure", "sweat", "recovery", "juice", "protein", "group class", "step count", "refuel",
    "active", "play", "explore", "warmup", "cooldown",      // complements workout
    "endurance", "strength",   // complements fitness
    "jog", "dash",              // complements run
    "pedal", "spin",            // complements ride
    "cycle", "terrain",         // complements bike
    "ridge", "path",            // complements trail
    "trek", "wander",           // complements hike
    "greenspace", "picnic",    // complements park
    "radiance", "dappling",     // complements sunlight
    "fresh", "wild",            // complements outdoor
    "spirit", "dare",           // complements adventure
    "grime", "endure",          // complements sweat
    "rehydrate", "boost",       // complements recovery
    "smoothie", "power",        // complements juice
    "amino", "carb",            // complements protein
    "session", "warmup",        // complements group class
    "pace", "stride",           // complements step count
    "hydrate", "nibble",        // complements refuel
    "act", "engage",            // complements active
    "fun", "frolic"
  ]
},
{
  themeId: "beltline-explorer",
  name: "BeltLine Explorer",
  description: "A dynamic roam along the Atlanta BeltLine — art, green spaces, local gems, and good vibes from morning to night.",
  stageFlow: [
    ["coffee", "tea", "bakery", "café", "brunch"],
    ["walk", "park", "market"],
    ["gallery", "lifestyle", "random gem"],
    ["market", "lunch", "brewery"],
    ["patio", "wine bar", "lifestyle", "random gem"],
    "dinner",
    ["club", "cocktail","rooftop", "bar", "music"]
  ],
  filters: {
    timeOfDay: ["morning", "midday", "afternoon", "evening", "day", "late-night"],
    price: [1, 2, 3],
    vibes: [
  "active", "outdoor", "local", "artsy", "eclectic", "playful", "bikeable", "walkable",
  "community", "casual", "colorful", "exploratory", "creative", "sunny", "breezy", "green",
  "spontaneous", "fun", "open", "alive", "vibrant", "unplanned", "serendipity", "neighborhood",
  "accessible", "relaxed", "friendly", "mural", "trail", "natural", "connected", "refresh",
  
  // 🍽️ Eating & Drinking vibes
  "lunch", "dinner", "brunch", "breakfast", "café", "coffee", "tea", "bakery", "restaurant",
  "food", "kitchen", "eatery", "cuisine", "bistro",
  "bar", "cocktail", "pub", "drink", "wine bar", "brewery", "club",

  // 🍷 Mood & ambiance
  "delicious", "flavorful", "sociable", "buzzing", "chill", "refuel", "energizing", "nightlife",
  "date-night", "group-friendly", "cozy", "elevated", "festive", "upbeat"
],
    tags: [
      "beltline", "murals", "bike ride", "gallery", "brewery", "coffee", "cafe", "café", "tea", "smoothie",
      "lunch", "rooftop", "market", "patio", "club", "walk", "park"
    ],
    eventCategories: ["art", "local", "pop-up", "music", "community", "outdoor"]
  },
  keywords: [
  "beltline", "trail", "walk", "bike", "ride", "brewery", "gallery", "murals", "art",
  "community", "neighborhood", "park", "juice", "coffee", "tea", "cafe", "café", "bakery", "brunch",
  "outdoor", "sunlight", "patio", "casual", "street art", "vibe", "friendly", "music", "pop-up",
  "hidden", "mellow", "green", "local", "spontaneous", "explore", "color", "breeze", "open", "view",
  "mixer", "gather", "market", "vendor", "artisan", "pavilion", "connection", "roam", "wander",
  "discover", "corner", "chill", "hang", "lifestyle", "random gem", "club",

  // 🍽️ Food & Dining
  "restaurant", "eatery", "kitchen", "bistro", "cuisine", "spot", "plate", "menu", "dishes",
  "food", "dining", "flavor", "savory", "sweet", "delicious", "meal", "entrée", "snack", "treat",
  "bite", "appetizer", "tapas", "grill", "kiosk",

  // 🍴 Meals
  "breakfast", "lunch", "dinner", "late-night",

  // 🍷 Drinks & Social
  "cocktail", "drink", "bar", "wine", "wine bar", "beer", "pub", "club", "mixology", "spirits",
  "happy hour", "cheers", "buzz", "nightlife", "social", "hangout"
]
},
{
  "themeId": "lofi-loop",
  "name": "Lo-Fi Loop",
  "description": "Low-stakes, high-vibes. Wander through warm corners, under-the-radar finds, and mood-lifting stops that feel like your own private soundtrack.",
  "stageFlow": [
    ["café", "coffee", "bakery"],
    ["bookstore", "gallery", "lifestyle", "showroom"],
    "lunch",
    ["market", "park", "random gem"],
    ["wine bar", "cocktail", "dessert"]
  ],
  "filters": {
    "price": [1, 2],
    "tags": [
      "coffee", "café", "bakery", "bookstore", "gallery", "random gem",
      "market", "lunch", "dessert", "wine bar", "bar", "park", "sidewalk", "armchair",
  "paperback",
  "hardcover",
  "journaling",
  "sketching",
  "polaroid",
  "film",
  "typewriter",
  "postcard",
  "secondhand",
  "hidden",
  "courtyard",
  "stoop",
  "alley",
  "sunbeam",
  "rainy",
  "candlelight",
  "lamplight",
  "acoustic",
  "busking",
  "openmic",
  "poetry",
  "slowpour",
  "natural",
  "tapas",
  "windowlight",
  "peoplewatching",
  "meandering",
  "unplugged",
  "minimalism",
  "handwritten",
  "locals",
  "vinylbar",
  "daylight",
  "softness",
  "introspective"
    ],
    "vibes": [
      "cozy", "lo-fi", "nostalgic", "unfussy", "quirky", "understated", "soft", "casual",
      "warm", "breezy", "green", "plants","intimate", "quiet", "friendly", "mellow", "budget", "lowkey",
      "inviting", "slow", "offbeat", "vintage", "neighborhood", "chill", "peaceful", "analog", "vinyl",
      "affordable", "creative", "lighthearted", "playful", "daydreamy", "drifty", "listening room", "tea",
      "sunny", "cloudy", "retro", "ambient", "low-volume", "unstructured"
    ],
    "timeOfDay": ["morning", "midday", "afternoon", "day", "evening"]
  },
  "keywords": [
    "coffee", "latte", "matcha", "vinyl", "bookstore", "reading", "notebook", "window seat",
    "pastry", "drip", "gallery", "poetry", "vibe", "corner booth", "random gem",
    "park bench", "market", "walk", "playlist", "barstool", "lo-fi", "cozy", "quiet",
    "softserve", "dessert", "local", "budget", "fire escape", "sidewalk", "slowdrip",
    "ambient", "lowmusic", "sketchbook", "zine", "shared plate", "catchup", "thoughtful",
    "breezy", "lazy", "indie", "snapshot", "scene", "light meal", "day off"
  ]
},
  {
  themeId: "date-night",
  name: "Date Night",
  description: "Romance, dim lights, and dessert to close the evening.",
  stageFlow: [ ["wine bar", "gallery"],
    ["cocktail", "dinner", "gallery", "music", "rooftop"],
    ["cocktail", "lounge", "speakeasy"],
    "dessert"
  ],
  filters: {
    price: [1, 2, 3, 4],
    timeOfDay: ["afternoon", "happy hour", "evening", "late", "late-night"],
    vibes: [
      "romantic", "cocktail", "winebar", "jazz", "twilight", "wine", "dim", "moody", "wine",
      "candlelit", "intimate", "charming", "flirty", "cozy", "soft",
      "sweet", "elegant", "lush", "quiet", "dreamy", "gentle", "classic",
      "warm", "lowlit", "refined", "stylish", "serene", "sensual",
      "plush", "polished", "tasteful", "inviting", "sultry", "relaxed",
      "timeless", "romanticized", "velvety", "slow", "amorous", "whimsical",          // romantic
      "crafted", "stirred",            // cocktail
      "soulful", "melodic",            // jazz
      "dusky", "afterglow",            // twilight
      "bold", "aged",                  // wine
      "shadowy", "hazy",               // dim
      "brooding", "smoky",             // moody
      "glowing", "flickering",         // candlelit
      "private", "snug",               // intimate
      "winsome", "endearing",          // charming
      "teasing", "playful",            // flirty
      "plush", "hushed",               // cozy
      "muted", "pillowy",              // soft
      "rich", "decadent",              // sweet
      "graceful", "chic",              // elegant
      "velvet", "lush",                // lush (kept for texture)
      "hushed", "serene",              // quiet
      "ethereal", "floaty",            // dreamy
      "tender", "silken",              // gentle
      "timeless", "vintage"
    ],
    tags: ["dinner", "winebar", "cozy", "dim", "dim lit", "intimate", "cocktail", "dessert", "wine", "speakeasy",
  "lounge",
  "bistro",
  "brasserie",
  "trattoria",
  "winecellar",
  "rooftop",
  "terrace",
  "courtyard",
  "garden",
  "patio",
  "balcony",
  "fireside",
  "jazzbar",
  "pianobar",
  "listeningroom",
  "tastingroom",
  "chefscounter",
  "omakase",
  "steakhouse",
  "candlelight",
  "lowlight",
  "hightop",
  "banquette",
  "booth",
  "velvet",
  "marble",
  "chandelier",
  "intimate",
  "upscale",
  "refined",
  "exclusive",
  "romantic",
  "moody",
  "sultry",
  "hidden",
  "historic",
  "boutique",
  "elevated"],
  },
  keywords: [
    "romantic", "cocktail", "jazz", "twilight", "wine", "dim", "moody",
    "candlelit", "intimate", "charming", "flirty", "cozy", "soft",
    "sweet", "elegant", "lush", "quiet", "dreamy", "gentle", "classic",
    "date", "night", "dinner", "dessert", "slow", "ambient",
    "lowkey", "stylish", "refined", "warm", "softlight", "velvet",
    "mood", "connection", "conversation", "chemistry", "spark",
    "indulgent", "together", "roses", "reservation",        // romantic
    "barstool", "garnish",         // cocktail
    "saxophone", "vinyl",          // jazz
    "sunset", "dusk",              // twilight
    "toast", "vintner",            // wine
    "shadows", "fade",             // dim
    "mystery", "glow",             // moody
    "wax", "matchlight",           // candlelit
    "whisper", "booth",            // intimate
    "eyecontact", "wink",          // charming
    "banter", "chemistry",         // flirty
    "blanket", "fireplace",        // cozy
    "cashmere", "napkin",          // soft
    "ganache", "pastry",           // sweet
    "linen", "tulips",             // elegant
    "bouquet", "decoration",       // lush
    "mute", "pause",               // quiet
    "cloud", "fantasy",            // dreamy
    "pulse", "close",              // gentle
    "rosewood", "eternal"  
  ]
},
  {
  themeId: "gameday-vibes",
  name: "Gameday Vibes",
  description: "Settle into the city’s best sports bars, taprooms, and wing spots to catch the game in high-def with high vibes.",
  stageFlow: [
  ["lunch", "brewery", "pub"],
  "sports bar",
  ["sports bar", "bar"]
],
  filters: {
    price: [1, 2, 3],
    timeOfDay: ["midday", "day", "afternoon", "evening", "late", "late-night"],
    vibes: [
      "sports", "rowdy", "screen", "beer", "gameday", "fans", "casual", "lively", "loud", "fun",
      "tailgate", "chill", "celebratory", "teams", "energy", "crowd", "cheer", "wings", "burgers", "pitchers", "game", "football", "basketball", "baseball", "soccer", "social", "competitive", "athletic",    // sports
      "spirited", "boisterous",     // rowdy
      "projected", "livefeed",      // screen
      "hoppy", "cold",              // beer
      "victory", "buzz",            // gameday
      "loyal", "chanting",          // fans
      "laidback", "comfy",          // casual
      "animated", "buzzy",          // lively
      "raucous", "thumping",        // loud
      "playful", "joyful",          // fun
      "pregame", "setup",           // tailgate
      "relaxed", "easygoing",       // chill
      "festive", "triumphant",      // celebratory
      "united", "synchronized",     // teams
      "vibrant", "intense",         // energy
      "packed", "impassioned",      // crowd
      "applause", "uproar",         // cheer
      "crispy", "zesty",            // wings
      "melty", "stacked",           // burgers
      "bigpour", "tall",            // pitchers
      "match", "play",              // game
      "gridiron", "endzone",        // football
      "hoops", "dunk",              // basketball
      "diamond", "tagup",           // baseball
      "pitch", "goal",              // soccer
      "interactive", "friendly" 
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
  "barstool", "hangout", "clutch", "huddle", "moment", "cheer", "social", "referee", "offsides",         // football context
    "halftime", "overtime",        // game timing
    "mascot", "jersey",            // fan culture
    "keg", "draft",                // beer culture
    "nachos", "pretzel",           // snack culture
    "scoreboard", "stats",         // game tracking
    "faceoff", "score",            // competition
    "pep", "spirit",               // crowd energy
    "barstool", "highfive",        // social hang
    "replay", "highlight",         // screen focus
    "cheer", "chant",              // crowd engagement
    "playbook", "lineup",          // team context
    "underdog", "champion",        // rivalry arc
    "shout", "whoop",              // auditory vibe
    "midday", "tailgate",          // day timing
    "nightcap", "afterparty",      // night timing
    "win", "loss",                 // competitive outcome
    "shot", "sip",                 // drink action
    "pint", "lager",               // drink type
    "friyay", "weekend",           // timing mood
    "enthuse", "buzz",             // fan mood
    "stadium", "venue",            // place context
    "collective", "gather",        // group context
    "banter", "laugh",             // social interaction
    "clutch", "moment"
]
},
  {
  themeId: "friends-night-out",
  name: "Friends Night Out",
  description: "Food → drinks → questionable decisions.",
  stageFlow: [
  "dinner",
  ["cocktail", "wine bar"],
  ["cocktail", "rooftop", "speakeasy", "club"]
],
  filters: {
    price: [1, 2, 3, 4],
    vibes: [
      "loud", "shareable", "pitchers", "group", "crowded", "bar", "dinner", "club", "dj",
      "party", "scene", "drinks", "late-night", "social", "vibrant", "shots", "energy",
      "rowdy", "dance", "hype", "weekend", "pregame", "cheers", "lit", "celebrate", "spontaneous",
      "turnup", "toasts", "nightlife", "squad", "reckless", "boisterous", "clamorous",        // loud
      "shared", "communal",             // shareable
      "refillable", "frothy",           // pitchers
      "collective", "connected",        // group
      "packed", "clamant",              // crowded
      "pub", "taproom",                 // bar
      "feast", "banquet",               // dinner
      "dancefloor", "latebeat",         // club
      "turntables", "mix",              // dj
      "festive", "celebratory",         // party
      "amplified", "theater",           // scene
      "mixology", "spirited",           // drinks
      "midnight", "afterdark",          // late-night
      "gregarious", "interactive",      // social
      "radiant", "effervescent",        // vibrant
      "burst", "charge",                // shots
      "power", "drive",                 // energy
      "unruly", "raucous",              // rowdy
      "groove", "move",                 // dance
      "buzz", "thrill",                 // hype
      "saturday", "friday",             // weekend
      "warmup", "prep",                 // pregame
      "clink", "toast",                 // cheers
      "electric", "bright",             // lit
      "jubilation", "festivity",        // celebrate
      "impulse", "spur",                // spontaneous
      "uptempo", "elevated",            // turnup
      "cheerspeak", "clink",            // toasts
      "afterparty", "latehours",        // nightlife
      "crew", "posse",                  // squad
      "careless", "wild",               // reckless
      "unfiltered", "uninhibited"
    ],
    tags: ["dinner", "bar", "winebar", "bar", "club", "late-night", "gastropub",
  "beerhall",
  "taproom",
  "sportsbar",
  "karaoke",
  "arcade",
  "bowling",
  "poolhall",
  "rooftop",
  "nightclub",
  "warehouse",
  "basement",
  "patio",
  "dancehall",
  "cocktailbar",
  "divebar",
  "shotbar",
  "mezzanine",
  "hightop",
  "booth",
  "VIP",
  "bottle",
  "sparklers",
  "confetti",
  "neon",
  "strobe",
  "laser",
  "headliner",
  "setlist",
  "encore",
  "crowdsurf",
  "mosh",
  "karaokenight",
  "trivia",
  "happyhour",
  "afterparty",
  "lastcall",
  "rounds",
  "tab",
  "hangover"],
    timeOfDay: ["evening", "late", "late-night"]
  },
  keywords: [
    "loud", "shareable", "pitchers", "group", "crowded", "bar", "dinner", "club", "dj",
    "party", "scene", "drinks", "late-night", "social", "vibrant", "shots", "energy",
    "rowdy", "dance", "hype", "weekend", "pregame", "cheers", "lit", "toasts", "nightlife",
    "squad", "celebrate", "reckless", "afterhours", "spontaneous", "turnup", "banter", "laughs",              // social interaction
    "appetizers", "snacks",          // food context
    "brew", "ale",                   // drinks context
    "playlist", "beats",             // music moments
    "cover", "entry",                // venue entry
    "meetup", "hang",                // get-together
    "rush", "pace",                  // crowd movement
    "pulse", "moment",               // energy quality
    "win", "loss",                   // game outcomes
    "photo", "selfie",               // capture the night
    "story", "memory",               // night narrative
    "plan", "route",                 // night itinerary
    "uber", "ride",                  // transport context
    "tipsy", "buzzed",               // drink effect
    "toastup", "clinkup",            // toasting action
    "locker", "room",                // event recall
    "champ", "underdog",             // competitive vibe
    "queue", "line",                 // waiting context
    "VIP", "backstage",              // premium spots
    "spotlight", "flair",            // highlight
    "dive", "lounge",                // venue vibe
    "crowdflow", "gathering",        // movement
    "encore", "cheerup" 
  ]
},
  {
  "themeId": "creative-outlet",
  "name": "Creative Outlet",
  "description": "A day designed to both inspire and express—immerse in visual culture, design, and material spaces, then channel the energy into your own creative flow.",
  "stageFlow": [
    ["café", "coffee", "bakery", "tea"],
    ["gallery", "museum", "bookstore", "library"],
    ["gallery", "showroom", "bookstore", "class"],
    "lunch",
    ["gallery", "showroom", "bookstore"],
    ["music", "park", "wine bar"]
  ],
  "filters": {
    "price": [1, 2, 3],
    "tags": [
      "coffee",
      "gallery",
      "museum",
      "bookstore",
      "showroom",
      "furniture",
      "winebar",
      "interior design",
      "design store",
      "creative space",
      "studio",
      "lunch",
      "wine bar",
      "music", "aestheic", "inspiration", "class"
    ],
    "vibes": [
      "gallery", "exhibit", "curated", "aesthetic", "fine art", "contemporary", "visual", "modern", "culture",
      "studio", "workspace", "atelier", "creative space", "makers", "open studio", "hands-on", "craft",
      "journal", "notepad", "sketch", "doodle", "flow", "inspiration", "spark", "thought", "idea",
      "coffee", "espresso", "café", "pour-over", "tea", "cozy", "warm", "welcoming",
      "music", "vibe", "buzz", "stylish", "refined", "chic", "trendy", "lo-fi",
      "expressive", "unfiltered", "imaginative", "dreamy", "intentional", "reflective", "freeform",
      "interiors", "design-forward", "materials", "texture", "layout", "spatial",
      "furniture", "objects", "fixtures", "lighting", "wood", "metal", "ceramic",
      "minimal", "styled", "considered", "lifestyle"
    ],
    "timeOfDay": ["morning", "midday", "day", "afternoon", "evening"]
  },
  "keywords": [
    "muse", "canvas", "sketchbook", "idea", "concept", "narrative", "expression", "curate",
    "brush", "texture", "tone", "shade", "linework", "illustration", "composition",
    "zine", "print", "notion", "moodboard", "voice", "theme", "focus", "quietude",
    "drip", "brew", "caffeine", "vinyl", "spin", "vibe", "buzz", "scene",
    "showcase", "art walk", "install", "gallery", "bookstore", "pages", "read",
    "draft", "gesture", "build", "workspace", "spot", "corner", "hub",
    "craft", "media", "analog", "digital", "vision", "project", "plan",
    "showroom", "interior", "furniture", "fixture", "object",
    "vignette", "display", "materials", "form", "arrangement",
    "layout", "spatial design", "decor", "lifestyle", "design language"
  ]
},
  {
  "themeId": "night-mode",
  "name": "Night Mode",
  "description": "Your night ramps up in stages—good energy, bold flavors, loud music, and no curfew.",
  "stageFlow": [
    ["dinner", "cocktail"],
    ["lounge", "bar"],
    ["club", "bar"],
    "late-night"
  ],
  "filters": {
    "timeOfDay": ["evening", "late", "late-night"],
    "price": [2, 3, 4],
    "tags": [
      "activity", "bar", "dinner", "club", "late-night",
      "dance", "rooftop", "bottle service", "music", "vibe", "latehours", "dj"
    ],
    "vibes": [
      "rowdy", "flashy", "high-energy", "social", "crowded", "fun", "wild",
      "buzzing", "pulsing", "neon", "afterdark", "boozy", "bold",
      "playful", "electric", "vibrant", "charged", "amped", "stylish",
      "groove", "movement", "beats", "rhythmic", "dancefloor", "dj",
      "elevated", "skyline", "scene", "party", "celebration", "after hours",
      "twilit", "midnight", "wee-hours", "nocturnal", "afterparty"
    ]
  },
  "keywords": [
    "party", "club", "bar", "dance", "dj", "beats", "late", "loud", "friends", "drinks",
    "pregame", "celebrate", "nightout", "rooftop", "scene", "energy", "vibe",
    "movement", "floor", "tempo", "pulse", "beatdrop", "mix", "spin", "turntable",
    "flash", "glow", "radiance", "neon", "signage", "spotlight", "billboard",
    "crowd", "gathering", "swarm", "crew", "squad", "community", "clique",
    "cheers", "toast", "shots", "sip", "chug", "venue", "spot", "view", "height",
    "buzz", "vibecheck", "afterparty", "postgame", "joyride", "wrap", "memory",
    "shindig", "bash", "fiesta", "lights", "story", "laugh", "shout"
  ]
},
  {
  themeId: "solo-explorer",
  name: "Solo Explorer",
  description: "Cozy solo spots and hidden gems for wandering.",
  stageFlow: [
  ["coffee", "cafe", "café", "bakery", "tea"],
  ["random gem", "lifestyle", "market", "gallery", "bookstore", "showroom"],
  ["gallery", "museum", "park", "garden"],
  ["lunch", "wine bar", "dessert", "class", "random gem"],
  ["random gem", "lifestyle", "park"]
],
  filters: {
    price: [1, 2, 3, 4],
    vibes: [
      "bookstore", "gallery", "quiet", "scenic", "café", "park", "garden", "introspective",
      "nook", "wander", "hidden", "serene", "thoughtful", "breezy", "curious", "offbeat",
      "reflective", "unplanned", "meander", "casual", "leafy", "green",           // bookstore (cozy reading gardens)
      "curated", "aesthetic",     // gallery
      "peaceful", "calm",         // quiet
      "vista", "panorama",        // scenic
      "cozy", "restful",          // café
      "shade", "open",            // park
      "bloom", "verdant",         // garden
      "thoughtful", "pondering",  // introspective
      "cranny", "corner",         // nook
      "roaming", "explore",       // wander
      "secret", "undiscovered",   // hidden
      "tranquil", "still",        // serene
      "mindful", "pensive",       // thoughtful
      "gusty", "airy",            // breezy
      "inquisitive", "inquiring", // curious
      "eccentric", "quirky",      // offbeat
      "introspective", "ruminate",// reflective
      "spontaneous", "free",      // unplanned
      "amble", "saunter",         // meander
      "easygoing", "relaxed"
    ],
    tags: ["coffee", "random gem", "bookstore", "market", "park", "observatory", "cafe", "gallery", "garden",
  "planetarium",
  "arboretum",
  "greenhouse",
  "conservatory",
  "courtyard",
  "cloister",
  "terrace",
  "lookout",
  "waterfront",
  "archives",
  "atelier",
  "studio",
  "workshop",
  "apothecary",
  "antique",
  "bookshop",
  "newsstand",
  "readingroom",
  "teahouse",
  "winebar",
  "listeningroom",
  "vinyl",
  "stationery",
  "printshop",
  "library",
  "independent",
  "minimal",
  "sunlit",
  "shaded",
  "stillness",
  "solitude",
  "anonymous",
  "observing",
  "sketching",
  "journaling",
  "lingering",
  "detouring",
  "unhurried",
  "contemplative"],
    timeOfDay: ["morning", "midday", "afternoon", "day", "evening"]
  },
  keywords: [
    "bookstore", "gallery", "quiet", "scenic", "café", "park", "garden", "introspective",
    "nook", "wander", "hidden", "photo", "gem", "unplanned", "solo", "curious",
    "museum", "artsy", "window", "vintage", "detour", "notebook", "meander", "reflective",
    "breeze", "calm", "roam", "fiction", "poetry",          // bookstore context
    "exhibit", "display",         // gallery context
    "hush", "mute",               // quiet feeling
    "view", "vista",              // scenic moments
    "latte", "espresso",          // café drinks
    "trail", "meadow",            // park location
    "flora", "botanic",           // garden subject
    "ponder", "muse",             // introspective mindset
    "cranny", "alcove",           // nook feature
    "roam", "stride",             // wander action
    "secret", "unknown",          // hidden quality
    "snapshot", "capture",        // photo activity
    "pearl", "treasure",          // gem synonym
    "impulse", "spur",            // unplanned trigger
    "alone", "soloist",           // solo tempo
    "probe", "seek",              // curious action
    "culture", "heritage",        // museum context
    "indie", "creative",          // artsy feeling
    "pane", "glimpse",            // window sight
    "retro", "classic",           // vintage style
    "detour", "sidestep",         // detour mode
    "scribble", "jot",            // notebook action
    "amble", "stroll",            // meander synonyms
    "mirror", "reflect",          // reflective action
    "gust", "zephyr",             // breeze feel
    "peace", "quietude",          // calm state
    "explore", "adventure"  
  ]
},
{
  "themeId": "morning-flow",
  "name": "Morning Flow",
  "description": "A calm and intentional start that energizes your body, clears your mind, and opens the day with purpose.",
  "stageFlow": [
    ["pilates", "yoga", "fitness"],
    ["tea", "coffee", "cafe", "café", "bakery", "smoothie", "breakfast"],
    ["garden", "market", "park"],
    ["spa", "bookstore", "library"],
    ["lunch", "cafe", "café"]
  ],
  "filters": {
    "timeOfDay": ["morning", "midday", "afternoon", "day"],
    "price": [1, 2],
    "tags": [
      "wellness", "yoga", "fitness", "coffee", "bakery", "tea", "smoothie",
      "garden", "market", "park", "journal", "spa", "lunch"
    ],
    "vibes": [
      "fresh", "early", "sunrise", "light", "warm", "natural", "peaceful", "cozy",
      "quiet", "calm", "restorative", "energizing", "grounded", "centered", "balanced",
      "reflective", "soft", "intentional", "mindful", "clear", "serene", "slowness",
      "slow", "leisurely", "inviting", "open", "breezy", "sunlit", "gentle", "earthy",
      "routine", "ritual", "purposeful", "settled", "clean", "organic", "tranquil",
      "harmonized", "uplifting", "present", "aware", "airy", "healing"
    ]
  },
  "keywords": [
    "yoga", "meditation", "stretch", "wellness", "spa", "calm", "mindful", "clarity",
    "tea", "coffee", "matcha", "smoothie", "bakery", "brunch", "acai", "café",
    "sunrise", "daybreak", "morning", "flow", "energy", "balance", "breathe",
    "sequence", "rhythm", "ritual", "routine", "intentional", "solo", "peace",
    "reset", "light", "glow", "fresh", "quiet", "cozy", "open", "garden", "flora",
    "market", "patio", "greenway", "trail", "outdoor", "harmony", "ease", "warmth",
    "selfcare", "journal", "scribble", "focus", "attention", "clarity", "gentle",
    "inhale", "exhale", "revive", "refresh", "leisurely", "glow", "clean", "pure",
    "sunlit", "breeze", "terrace", "courtyard", "moment", "presence"
  ]
},
{
  themeId: "pages-to-pours",
  name: "Pages to Pours",
  description: "A cozy blend of books, art, and wine-soaked thought.",
  stageFlow: [
  ["bookstore", "gallery", "library"],
  ["bakery", "coffee"],
  ["bookstore", "gallery", "library"],
  ["cafe", "café", "lunch"],
  "wine bar"
],
  filters: {
    timeOfDay: ["morning", "midday", "afternoon","day", "evening"],
    price: [1, 2, 3, 4],
    tags: ["bookstore", "gallery", "wine bar", "winebar", "wine", "coffee", "lounge", "reading", "art", "readingroom",
  "circulation",
  "stacks",
  "archives",
  "curation",
  "exhibit",
  "installation",
  "hardcover",
  "paperback",
  "marginalia",
  "poetry",
  "fiction",
  "nonfiction",
  "literature",
  "monograph",
  "catalog",
  "zine",
  "press",
  "pastry",
  "croissant",
  "sourdough",
  "patisserie",
  "espresso",
  "cappuccino",
  "slowbrew",
  "barista",
  "communal",
  "banquette",
  "armchair",
  "corner",
  "sunlit",
  "chalkboard",
  "daily special",
  "smallplates",
  "charcuterie",
  "fromage",
  "decant",
  "tannins",
  "vintage",
  "cellar"],
    vibes: [
      "quiet", "cozy", "literary", "analog", "warm", "vintage", "reflective", "somm", "tasting", "bookstore",
      "moody", "artsy", "thoughtful", "bookish", "soft", "curated", "charming",
      "elegant", "snug", "relaxed", "dreamy", "writerly", "poetic", "hushed", "peaceful",         // quiet
      "snug", "inviting",           // cozy
      "intellectual", "bookish",    // literary
      "tactile", "manual",          // analog
      "glowing", "gentle",          // warm
      "retro", "timeless",          // vintage
      "pensive", "introspective",   // reflective
      "dim", "deep",                // moody
      "creative", "gallery",        // artsy
      "observant", "quietude",      // thoughtful
      "nerdy", "studious",          // bookish
      "muted", "feathered",         // soft
      "tasteful", "intentional",    // curated
      "quaint", "sweet",            // charming
      "refined", "graceful",        // elegant
      "blanketed", "tucked",        // snug
      "unhurried", "easygoing",     // relaxed
      "whimsical", "romantic",      // dreamy
      "notebook", "penworthy",      // writerly
      "lyrical", "evocative" 
    ]
  },
  keywords: [
    "bookstore", "quiet", "cozy", "literary", "analog", "warm", "vintage",
    "library", "indie", "wine", "reflective", "moody", "ink", "writerly",
    "poetic", "sips", "sofa", "read", "pages", "glass", "conversation", "culture",
    "gallery", "ambient", "slow", "soft", "novel", "essay",               // bookstore
    "whisper", "stillness",         // quiet
    "corner", "throw",              // cozy
    "narrative", "theme",           // literary
    "record", "print",              // analog
    "glow", "hug",                  // warm
    "sepia", "patina",              // vintage
    "mirror", "memoir",             // reflective
    "dimness", "depth",             // moody
    "paint", "canvas",              // artsy
    "insight", "musing",            // thoughtful
    "pen", "margin",                // bookish
    "texture", "silk",              // soft
    "zine", "shelf",                // curated
    "nook", "parlor",               // charming
    "stemware", "swirl",            // elegant
    "wrap", "blanket",              // snug
    "pause", "breather",            // relaxed
    "foggy", "wistful",             // dreamy
    "essayist", "scribbler",        // writerly
    "haiku", "metaphor",            // poetic
    "sip", "clink",                 // sips
    "lounge", "armchair",           // sofa
    "chapter", "underline",         // read
    "bookmark", "stack",            // pages
    "pour", "tannin",               // glass
    "dialogue", "connection",       // conversation
    "taste", "exhibit",             // culture
    "brush", "frame",               // gallery
    "dimly", "fade",                // ambient
    "tempo", "linger",              // slow
    "cushion", "velvet"
  ]
},
{
  themeId: "post-work-wind-down",
  name: "Post‑Work Wind Down",
  description: "Unplug and ease into the evening after a long day.",
  stageFlow: [
  ["happy hour", "happyhour", "wine bar", "patio", "cocktail"],
  "dinner",
  "cocktail"
],
  filters: {
    timeOfDay: ["afternoon", "evening", "late"],
    price: [1, 2, 3],
    tags: ["bar", "cocktail", "dinner", "lounge", "patio", "happy hour", "wine bar", "winebar", "wine", "gastropub",
  "taproom",
  "beerhall",
  "brasserie",
  "bistro",
  "trattoria",
  "winecellar",
  "cocktailbar",
  "neighborhood",
  "locals",
  "cornerbooth",
  "highback",
  "fireside",
  "stringlights",
  "lanterns",
  "sunset",
  "goldenhour",
  "sundown",
  "alfresco",
  "terrace",
  "courtyard",
  "smallplates",
  "shareables",
  "flatbread",
  "charcuterie",
  "mezze",
  "spritz",
  "negroni",
  "oldfashioned",
  "draft",
  "pint",
  "flight",
  "happyhour",
  "prixfixe",
  "walkins",
  "reservation",
  "background",
  "acoustic",
  "playlist",
  "softlight"],
    vibes: [
      "relaxed", "cooldown", "casual", "afterwork", "patio", "easy", "laidback",
      "mellow", "chill", "breezy", "social", "unwind", "refined", "slow",
      "ambient", "light", "buzz", "friendly", "winddown", "lowkey", "serene", "placid",           // relaxed
      "decompress", "settle",       // cooldown
      "unforced", "simple",         // casual
      "postshift", "clockout",      // afterwork
      "alfresco", "terrace",        // patio
      "smooth", "cozy",             // easy
      "unrushed", "comfortable",    // laidback
      "mild", "gentle",             // mellow
      "calm", "cool",               // chill
      "airy", "open",               // breezy
      "connective", "gregarious",   // social
      "loosen", "detach",           // unwind
      "polished", "tasteful",       // refined
      "unhurried", "measured",      // slow
      "textured", "rich",           // ambient
      "soft", "warming",            // light
      "hum", "vibe",                // buzz
      "welcoming", "amiable",       // friendly
      "slowdown", "descend",        // winddown
      "understated", "quiet"
    ]
  },
  keywords: [
    "happy hour", "bar", "tapas", "light bite", "craft beer", "after work",
    "relax", "casual", "patio", "drinks", "mingle", "unwind", "refresh",
    "lowkey", "cooldown", "ambient", "hangout", "winddown", "ease",
    "chill", "lounge", "laidback", "slow", "evening", "buzz", "friendly", "hourglass", "discount",       // happyhour
    "pub", "taproom",              // bar
    "smallplates", "shareables",   // tapas
    "snack", "nibble",             // lightbite
    "ale", "lager",                // craftbeer
    "postshift", "clockoff",       // afterwork (distinct from vibes)
    "rest", "pause",               // relax
    "loose", "easygoing",          // casual
    "terrace", "veranda",          // patio
    "sips", "toast",               // drinks
    "chat", "banter",              // mingle
    "detox", "restore",            // unwind
    "hydrate", "freshen",          // refresh
    "quietude", "unnoticed",       // lowkey
    "slowdown", "settle",          // cooldown context
    "soundscape", "backdrop",      // ambient feel
    "meetup", "gather",            // hangout
    "decline", "easeoff",          // winddown
    "softness", "relief",          // ease
    "breeze", "coolness",          // chill
    "sofa", "armchair",            // lounge
    "easystride", "meander",       // laidback
    "unhurried", "gentlepause",    // slow
    "sundown", "twilight",         // evening
    "thrill", "spark",             // buzz
    "neighborly", "openhearted"
  ]
},
{
  themeId: "midday-recharge",
  name: "Midday Recharge",
  description: "A relaxing midday refresh to reset and recharge before the evening.",
  stageFlow: [ "coffee",
  ["walk", "park", "garden"],
  "lunch",
  ["fitness", "yoga", "pilates", "coffee"]
],
  filters: {
    timeOfDay: ["morning", "midday", "afternoon", "day"],
    price: [1, 2, 3],
    tags: ["coffee", "lunch", "park", "gallery", "juice", "café", "break", "sunroom",
  "terrace",
  "courtyard",
  "greenhouse",
  "arboretum",
  "conservatory",
  "waterfront",
  "boardwalk",
  "trail",
  "greenspace",
  "picnic",
  "shade",
  "sunlit",
  "daylight",
  "breathwork",
  "stretch",
  "mobility",
  "recovery",
  "reset",
  "grounding",
  "mindful",
  "hydration",
  "smoothie",
  "protein",
  "grainbowl",
  "salad",
  "wrap",
  "lightbite",
  "cafeteria",
  "teahouse",
  "matcha",
  "coldbrew",
  "refuel",
  "clarity",
  "focus",
  "balance",
  "centered",
  "upright",
  "posture",
  "flowstate"],
    vibes: [
      "refresh", "sunny", "breezy", "chill", "casual", "cozy", "relaxed",
      "light", "calm", "neighborhood", "pause", "airy", "open", "flow",
      "quiet", "easy", "slow", "soft", "unwind", "clean", "revived", "boosted",            // refresh
      "bright", "warm",                // sunny
      "gentle", "windy",               // breezy
      "laidback", "mellow",            // chill
      "unfussy", "simple",             // casual
      "snug", "homey",                 // cozy
      "loose", "unhurried",            // relaxed
      "luminescent", "glossy",         // light
      "serene", "still",               // calm
      "local", "neighborhoodly",       // neighborhood
      "break", "interval",             // pause
      "buoyant", "openair",            // airy
      "unbounded", "vast",             // open
      "smooth", "consistent",          // flow
      "peaceful", "hushed",            // quiet
      "effortless", "simple",          // easy
      "unrushed", "gentle",            // slow
      "feathered", "velvety",          // soft
      "decompress", "loosen",          // unwind
      "pure", "spotless" 
    ]
  },
  keywords: [
    "lunch", "coffee", "café", "juice", "quick", "park", "sunlight", "relaxed",
    "casual", "chill", "grab", "outdoor", "neighborhood", "gallery",
    "pause", "break", "breezy", "open", "lowkey", "refresh",
    "easygoing", "cozy", "clean", "flow", "mealtime", "sandwich",           // lunch
    "latte", "espresso",              // coffee
    "tea", "brew",                    // café
    "smoothie", "blend",              // juice
    "swift", "brief",                 // quick
    "greenspace", "playground",       // park
    "daylight", "ray",                // sunlight
    "serene", "undisturbed",          // relaxed
    "plain", "unpretentious",         // casual
    "ice", "coolness",                // chill
    "snack", "bite",                  // grab
    "outside", "freshair",            // outdoor
    "localspot", "corner",            // neighborhood
    "artwork", "exhibit",             // gallery
    "intermission", "halt",           // pause
    "breather", "respite",            // break
    "gust", "waft",                   // breezy
    "vista", "wideopen",              // open
    "understated", "muted",           // lowkey
    "revive", "renew",                // refresh
    "slowdown", "easeoff",            // easygoing
    "snugspot", "nook",               // cozy
    "spotless", "pure",               // clean
    "continuity", "cadence" 
  ]
}
];

// ✅ Quick lookup
export const themeById: Record<string, CrawlTheme> = Object.fromEntries(
  crawlThemes.map((t) => [t.themeId, t])
);
