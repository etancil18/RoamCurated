import { CrawlTheme } from "@/lib/theme-engine/types"; 

export const crawlThemes: CrawlTheme[] = [
  {
  themeId: "active-all-day",
  name: "Active All Day",
  description: "High-energy city day powered by movement, outdoor play, and physical challenges. For explorers who'd rather sweat than sit.",
  stageFlow: ["fitness", "market", "park",  "lunch", "activity", "dinner", "bar"],
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
    tags: ["fitness", "juice", "bike ride", "hike", "market", "rooftop", "late-night"],
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
  "themeId": "cheap-cheerful",
  "name": "Cheap & Cheerful",
  "description": "Low-budget gems, fast bites, and casual fun throughout the city.",
  "stageFlow": ["coffee", "market", "random gem", "gallery", "dinner", "bar"],
  "filters": {
    "price": [1, 2],
    "vibes": [
      "diner", "cheap", "budget", "street", "casual", "$", "bite", "fast", "local",
      "market", "takeout", "gallery", "food truck", "friendly", "laid-back", "quirky",
      "no-frills", "unpretentious", "daytime", "fun", "easy", "snappy", "retro", "booth",            // diner
      "affordable", "bargain",     // cheap
      "saver", "value",            // budget
      "curbside", "vendor",        // street
      "relaxed", "simple",         // casual
      "bargain", "basic",          // $
      "snack", "grab",             // bite
      "quick", "express",          // fast
      "neighborhood", "familiar",  // local
      "vendor", "grocer",          // market
      "boxed", "portable",         // takeout
      "artsy", "indie",            // gallery
      "truck", "grub",             // food truck
      "warm", "inviting",          // friendly
      "easygoing", "loose",        // laid-back
      "offbeat", "weird",          // quirky
      "basic", "barebones",        // no-frills
      "real", "humble",            // unpretentious
      "sunny", "light",            // daytime
      "buzz", "joy",               // fun
      "breezy", "carefree",        // easy
      "zippy", "lighthearted"
    ],
    "tags": ["coffee", "market", "random gem", "gallery", "dinner", "bar"],
    "timeOfDay": ["midday", "afternoon","day", "evening"]
  },
  "keywords": [
    "diner", "cheap", "budget", "street", "casual", "$", "bite", "fast", "local",
    "market", "takeout", "gallery", "food truck", "friendly", "laid-back", "quirky",
    "no-frills", "snappy", "easy", "bargain", "hangout", "on-the-go", "lively",
    "unpretentious", "simple", "affordable", "retro", "booth",              // diner
    "deal", "discount",            // cheap
    "save", "value",               // budget
    "vendor", "curbside",          // street
    "relaxed", "simple",           // casual
    "basic", "coins",              // $
    "snack", "grab",               // bite
    "quick", "dash",               // fast
    "community", "familiar",       // local
    "grocer", "vendor",            // market
    "boxed", "portable",           // takeout
    "art", "indie",                // gallery
    "grub", "truck",               // food truck
    "welcoming", "kind",           // friendly
    "easygoing", "loose",          // laid-back
    "odd", "colorful",             // quirky
    "simple", "raw",               // no-frills
    "real", "honest",              // unpretentious
    "bright", "chill",             // daytime
    "upbeat", "buzz",              // fun
    "breezy", "carefree",          // easy
    "fast", "joyful",              // snappy
    "value", "casual" 
  ]
},
  {
    themeId: "chill-hang",
    name: "Chill Hang",
    description: "Coffee → books → bites → easy vibes → nightcap.",
    stageFlow: ["coffee", "bookstore", "random gem", "lunch", "lifestyle", "bar", "dessert"],
    filters: {
      price: [1, 2, 3],
      vibes: ["lounge", "cozy", "relaxed", "intimate", "chill", "sofa", "vintage", "casual", "warm", "neighborhood", "laid-back", "friendly", "comfort", "easygoing", "snack", "small bite", "lowkey", "hangout", "easy", "slow", "conversation", "quiet", "plush", "comfy",            // lounge
      "snug", "soft",              // cozy
      "mellow", "unwound",          // relaxed
      "personal", "close",          // intimate
      "breezy", "calm",             // chill
      "cushioned", "loungy",        // sofa
      "retro", "nostalgic",         // vintage
      "unfussy", "simple",          // casual
      "inviting", "toasty",         // warm
      "local", "familiar",          // neighborhood
      "loose", "effortless",        // laid-back
      "welcoming", "kind",          // friendly
      "cozy", "reassuring",         // comfort
      "smooth", "natural",          // easygoing
      "nibbly", "light",            // snack
      "bite-sized", "shareable",    // small bite
      "understated", "subtle",      // lowkey
      "social", "communal",         // hangout
      "carefree", "fluid",          // easy
      "leisurely", "unrushed",      // slow
      "chatty", "thoughtful",       // conversation
      "peaceful", "hushed"],
      tags: ["coffee", "bookstore", "random gem", "lunch", "lifestyle", "bar", "dessert"],
      timeOfDay: ["midday", "afternoon", "happy hour", "day", "evening"],
    },
    keywords: [
      "coffee", "books", "nook", "reading", "wine", "bites", "booth", "window",
  "conversation", "dessert", "gallery", "sip", "ambient", "vinyl", "poetry",
  "hideaway", "catchup", "slowdrip", "matcha", "local", "espresso",
  "indie", "downtime", "candle", "corner", "playlist", "quiet",
  "journaling", "refill", "latenight", "couch", "fireplace", "scenic",
  "softserve", "sidewalk", "cupcake", "barstool", "comfort", "shared",
  "nonfiction", "wifi", "casual", "neon", "barista", "peoplewatch", "lowmusic"
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
      "studio", "workspace", "atelier",
      "journal", "scribble", "notepad",
      "sketch", "doodle", "illustrate",
      "gallery", "exhibit", "curated",
      "quiet", "still", "peaceful",
      "inspiration", "spark", "drip",
      "café", "espresso", "barista",
      "bookstore", "pages", "read",
      "sunny", "glow", "light-filled",
      "vinyl", "analog", "lo-fi",
      "art", "canvas", "visual",
      "notebook", "moleskine", "planner",
      "design", "blueprint", "layout",
      "creative space", "open studio", "nook",
      "makers", "craft", "hands-on",
      "colorful", "bold", "vibrant",
      "imaginative", "whimsical", "dreamy",
      "brainstorm", "ideation", "generate",
      "cozy", "warm", "welcoming",
      "thoughtful", "intentional", "reflective",
      "ideas", "conceptual", "thought",
      "workspace", "hub", "zone",
      "open-ended", "freeform", "fluid",
      "expressive", "emotive", "unfiltered"
    ],
    timeOfDay: ["morning", "midday", "day"]
  },
  keywords: [
    "draft", "sketchbook", "ink",
    "canvas", "notepad", "flow",
    "muse", "brush", "shade",
    "read", "prose", "literary",
    "curate", "detail", "palette",
    "focus", "quietude", "balance",
    "zine", "magazine", "print",
    "coffee", "pour", "drip",
    "vinyl", "record", "spin",
    "illustration", "frame", "install",
    "notion", "moodboard", "plan",
    "texture", "tone", "linework",
    "narrative", "expression", "idea",
    "edit", "compose", "build",
    "workspace", "spot", "corner",
    "caffeine", "latte", "brew",
    "indie", "local", "craft",
    "media", "digital", "analog",
    "project", "vision", "goal",
    "spark", "fire", "impulse",
    "minimal", "organized", "styled",
    "drafting", "mark", "gesture",
    "poetic", "voice", "theme",
    "thought", "concept", "note"
  ]
},
  {
  themeId: "date-night",
  name: "Date Night",
  description: "Romance, dim lights, and dessert to close the evening.",
  stageFlow: ["dinner", "cocktail", "dessert"],
  filters: {
    price: [1, 2, 3, 4],
    timeOfDay: ["evening", "night"],
    vibes: [
      "romantic", "cocktail", "jazz", "twilight", "wine", "dim", "moody",
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
    tags: ["dinner", "cocktail", "dessert", "wine bar"],
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
  stageFlow: ["lunch", "brewery", "bar", "bar", "cocktail"],
  filters: {
    price: [1, 2, 3],
    timeOfDay: ["day", "afternoon", "evening", "night"],
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
  description: "Food → pregame → party → questionable decisions.",
  stageFlow: ["dinner", "bar", "bar", "club", "late-night"],
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
    tags: ["dinner", "bar", "bar", "club", "late-night"],
    timeOfDay: ["evening", "night", "late-night"]
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
    themeId: "gallery-crawl",
    name: "Gallery Crawl",
    description: "Galleries and artsy stops with great aesthetics.",
    stageFlow: ["gallery", "gallery", "lunch", "wine bar", "music"],
    filters: {
      price: [1, 2, 3],
      vibes: ["gallery", "exhibit", "art", "creative", "museum", "opening", "culture", "fine art", "contemporary", "showcase", "art walk", "curated", "aesthetic", "stylish", "visual", "inspired", "refined", "chic", "trendy", "modern", "buzz"],
      tags: ["gallery", "gallery", "lunch", "wine bar", "music"],
      timeOfDay: ["midday", "afternoon","day","evening"],
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
      vibes: ["dance", "dj", "crowded", "club", "party", "high energy", "beats", "rooftop", "late", "scene", "vibrant", "after hours", "groove", "movement",         // dance
      "turntables", "mix",           // dj
      "packed", "swarming",          // crowded
      "clubhouse", "nocturnal",      // club
      "celebration", "festive",      // party
      "charged", "amped",            // highenergy
      "rhythm", "pulse",             // beats
      "skyline", "elevated",         // rooftop
      "midnight", "afterdark",       // late
      "buzz", "spotlight",           // scene
      "radiant", "lively",           // vibrant
      "afterparty", "twilight"],
      tags: ["activity", "bar", "dinner", "bar", "club", "late-night"],
      timeOfDay: ["evening","night","late-night"],
    },
    keywords: [
      "dance", "dj", "crowded", "club", "party", "high energy", "beats", "rooftop", "late", "scene", "vibrant", "after hours", "floor", "movement",            // dance context
    "mixset", "scratch",            // dj context
    "swarm", "gathering",           // crowd behavior
    "venue", "spot",                // club context
    "bash", "shindig",              // party context
    "momentum", "charge",           // energy vibe
    "riff", "tempo",                // beats context
    "view", "terrace",              // rooftop context
    "midnight", "weehours",         // late timing
    "vibe", "pulse",                // scene quality
    "sparkle", "electric",          // vibrant feel
    "afterparty", "wrap",           // afterhours action

    // extra mood/context words
    "toast", "cheers",              // celebratory
    "rhythm", "cadence",            // musical flow
    "sip", "chug",                  // drink actions
    "crowdflow", "gather",          // social movement
    "dancefloor", "lights",         // environment
    "story", "memory",              // narrative
    "laugh", "shout",               // social expression
    "pulse", "beatdrop",            // music emphasis
    "tempo", "spin",                // set pacing
    "electric", "charged",          // vibe intensity
    "vibecheck", "buzz"
    ]
  },
  {
  themeId: "solo-explorer",
  name: "Solo Explorer",
  description: "Cozy solo spots and hidden gems for wandering.",
  stageFlow: ["coffee", "museum", "bookstore", "lunch", "lifestyle", "random gem", "wine bar"],
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
    tags: ["coffee", "random gem", "bookstore", "market", "park"],
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
  themeId: "sunday-reset",
  name: "Sunday Reset",
  description: "Restore your soul with quiet spaces, gentle wellness, and cozy comfort.",
  stageFlow: ["fitness", "coffee", "market", "lifestyle", "bookstore", "dinner"],
  filters: {
    price: [1, 2, 3, 4],
    timeOfDay: ["morning", "midday", "afternoon", "day", "evening"],
    vibes: [
      "garden", "tea", "spa", "quiet", "book", "relax", "wellness", "reflection",
      "meditation", "sunlight", "fresh", "slow",
      "cozy", "warm", "soft", "restful", "breezy", "clean",
      "mindful", "airy", "simple", "light", "nourish", "glow",
      "reset", "peaceful", "unwind", "breathe", "verdant", "leafy",            // garden
      "herbal", "steeping",          // tea
      "soothing", "restorative",     // spa
      "hushed", "still",             // quiet
      "literary", "paperbound",      // book
      "ease", "loosen",              // relax
      "holistic", "balanced",        // wellness
      "introspective", "inward",     // reflection
      "centered", "grounded",        // meditation
      "golden", "warmth",            // sunlight
      "crisp", "renewed",            // fresh
      "unhurried", "leisurely",      // slow
      "snug", "inviting",            // cozy
      "toasty", "comforting",        // warm
      "gentle", "muted",             // soft
      "recharging", "calming",       // restful
      "lightflow", "open",           // breezy
      "pure", "minimal",             // clean
      "aware", "intentional",        // mindful
      "uplifted", "spacious",        // airy
      "pared", "essential",          // simple
      "weightless", "easy",          // light
      "feeding", "wholesome",        // nourish
      "radiant", "softlit",          // glow
      "renewal", "refresh",          // reset
      "tranquil", "placid",          // peaceful
      "decompress", "release",       // unwind
      "inhale", "exhale" 
    ],
    tags: ["fitness", "market", "lifestyle", "bookstore", "dinner"],
  },
  keywords: [
    "garden", "tea", "spa", "quiet", "book", "relax", "wellness", "reflection",
    "meditation", "sunlight", "fresh", "slow",
    "sunday", "reset", "soft", "ritual", "cleanse", "calm",
    "unwind", "balance", "nourish", "still", "glow", "breathe",
    "yoga", "journal", "stretch", "flow", "routine", "lowkey", "botanical", "greenery",         // garden context
    "teacup", "infusion",            // tea action
    "massage", "sauna",              // spa activity
    "silence", "pause",              // quiet state
    "reading", "chapters",           // book usage
    "rest", "easeoff",               // relax behavior
    "health", "care",                // wellness framing
    "journaling", "review",          // reflection action
    "breathwork", "stillness",       // meditation practice
    "morninglight", "daybreak",      // sunlight timing
    "renewal", "clarity",            // fresh effect
    "downtime", "linger",             // slow pacing
    "weekend", "closure",            // sunday framing
    "resetting", "realign",           // reset action
    "comfort", "tenderness",         // soft feel
    "ceremony", "habit",              // ritual structure
    "detox", "purify",                // cleanse framing
    "serenity", "equanimity",         // calm state
    "release", "cooldown",            // unwind mechanics
    "equilibrium", "center",          // balance framing
    "fuel", "sustain",                // nourish effect
    "silence", "pause",               // stillness
    "afterglow", "warmth",            // glow effect
    "oxygen", "breathing",            // breathe mechanics
    "asana", "stretching",            // yoga context
    "notebook", "entries",            // journal usage
    "mobility", "lengthen",            // stretch mechanics
    "rhythm", "sequence",             // flow feeling
    "schedule", "habitual",           // routine framing
    "gentle", "unrushed" 
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
      "comfortable seating", "independent", "easygoing", "minimal", "energized", "brew", "espresso",            // cafe
      "connected", "online",         // wifi
      "latte", "brew",               // coffee
      "attentive", "sharp",          // focus
      "flexible", "open",            // remote-friendly
      "notetaking", "typing",        // laptop
      "laidback", "unforced",        // casual
      "silent", "hushed",            // quiet
      "desk", "booth",               // workspace
      "sunlit", "bright",            // daytime
      "read", "analyze",             // study
      "driven", "goal-oriented",     // productive
      "local", "community",          // neighborhood
      "softbeats", "ambient",        // light music
      "relaxed-seat", "plush",       // comfortable-seating
      "solo", "self-sufficient",     // independent
      "mellow", "steady",            // easygoing
      "clean", "uncluttered",        // minimal
      "peppy", "lively" 
    ],
    timeOfDay: ["morning", "midday","day", "happy hour"]
  },
  keywords: [
    "cafe", "wifi", "coffee", "focus", "remote-friendly", "laptop", "casual", "quiet",
    "workspace", "daytime", "study", "productive", "neighborhood", "light music",
    "comfortable seating", "outlet", "windows", "concentration", "notebook", "journal",
    "session", "solo", "sip", "menu", "relaxed", "airiness", "brewspot", "barista",          // cafe context
    "signal", "router",             // wifi context
    "mocha", "cappuccino",          // coffee type
    "clarity", "effort",            // focus outcome
    "workspace", "huddle",          // remote-friendly setting
    "keyboard", "trackpad",         // laptop parts
    "weekend", "weekday",           // casual timing
    "silence", "pause",             // quiet state
    "cubicle", "corner",            // workspace location
    "morninglight", "noon",         // daytime markers
    "lecture", "readthrough",       // study action
    "achievement", "milestone",     // productive result
    "boutique", "walkable",         // neighborhood feel
    "playlist", "rhythm",           // light music
    "armrest", "cushion",           // comfortable seating feel
    "powerpoint", "spreadsheet",    // work tools
    "expanse", "view",              // windows feel
    "focusflow", "mindmap",         // concentration technique
    "scribble", "doodle",           // notebook use
    "reflection", "entry",          // journal use
    "block", "sprint",              // session type
    "solitude", "me-time",          // solo experience
    "taste", "sipflow",             // sipping action
    "fare", "entrée",               // menu context
    "easytempo", "at-ease",         // relaxed state
    "breeze", "freshair" 
  ]
},
{
  themeId: "last-call",
  name: "Last Call",
  description: "A wild night that doesn’t end when the lights go out.",
  stageFlow: ["bar", "club", "late-night", "speakeasy", "lounge", "after hours"],
  filters: {
    timeOfDay: ["night", "late-night"],
    price: [1, 2, 3, 4],
    tags: ["bar", "club", "late-night", "after hours", "speakeasy", "lounge", "dance"],
    vibes: [
      // core
      "late-night", "after-hours", "rowdy", "gritty", "dark", "boozy",
      "underground", "unfiltered", "loose", "nocturnal", "wild", "electric",

      // expanded (2 per core)
      "neon", "shadowy",          // late-night
      "secretive", "hidden",      // after-hours
      "chaotic", "reckless",      // rowdy
      "raw", "edgy",              // gritty
      "lowlit", "moody",          // dark
      "sloshed", "tipsy",         // boozy
      "basement", "backroom",     // underground
      "uncensored", "unpolished", // unfiltered
      "carefree", "uninhibited",  // loose
      "owlish", "sleepless",      // nocturnal
      "feral", "untamed",         // wild
      "charged", "pulsing"        // electric
    ]
  },
  keywords: [
    "late-night", "karaoke", "after hours", "lively", "spontaneous", "gritty",
    "unfiltered", "nocturnal", "dance", "dark", "shots", "underground",
    "loose", "unhinged", "boozy", "nightcap", "midnight", "closingtime",   // late-night
    "mic", "singalong",          // karaoke
    "lockin", "postclose",       // after-hours
    "buzzing", "animated",       // lively
    "impulse", "whim",           // spontaneous
    "concrete", "industrial",    // gritty
    "honest", "candid",          // unfiltered
    "moonlit", "starlit",        // nocturnal
    "groove", "mosh",            // dance
    "blackout", "dimness",       // dark
    "tequila", "whiskey",        // shots
    "speakeasy", "cellar",       // underground
    "careless", "easygoing",     // loose
    "deranged", "chaotic",       // unhinged
    "intoxicated", "inebriated", // boozy
    "finale", "sendoff"
  ]
},
{
  themeId: "mindful-mornings",
  name: "Mindful Mornings",
  description: "Ease into the day with peace, balance, and clarity.",
  stageFlow: ["wellness", "coffee", "garden", "market", "spa"],
  filters: {
    timeOfDay: ["morning", "midday"],
    price: [1, 2],
    tags: ["wellness", "yoga", "coffee", "garden", "spa", "tea", "market"],
    vibes: [
      "calm", "gentle", "quiet", "intentional", "sunlit", "light", "fresh",
      "reflective", "still", "balanced", "restorative", "centered", "peaceful",
      "cozy", "soft", "slowness", "natural", "clear", "grounded", "ease", "serene", "placid",          // calm
      "tender", "delicate",        // gentle
      "hushed", "silent",          // quiet
      "purposeful", "deliberate",  // intentional
      "golden", "radiant",         // sunlit
      "airy", "featherlight",      // light
      "crisp", "pure",             // fresh
      "thoughtful", "pensive",     // reflective
      "motionless", "settled",     // still
      "harmonized", "even",        // balanced
      "healing", "renewing",       // restorative
      "aligned", "rooted",         // centered
      "tranquil", "calming",       // peaceful
      "snug", "inviting",          // cozy
      "muted", "velvety",          // soft
      "unhurried", "leisurely",    // slowness
      "organic", "earthy",         // natural
      "lucid", "open",             // clear
      "anchored", "stable",        // grounded
      "effortless", "smooth" 
    ]
  },
  keywords: [
    "yoga", "meditation", "spa", "sunlight", "tea", "calm", "minimal",
    "introspective", "garden", "journal", "wellness", "fresh air", "stretch",
    "breathe", "ritual", "balance", "clarity", "gentle", "routine", "mindful",
    "morning", "flow", "reset", "ease", "solo", "cozy", "peace", "light", "asana", "vinyasa",            // yoga
    "breathwork", "stillness",     // meditation
    "soak", "sauna",               // spa
    "daybreak", "dawn",            // sunlight
    "matcha", "herbal",            // tea
    "quietude", "composure",       // calm
    "simplicity", "restraint",     // minimal
    "selfstudy", "awareness",      // introspective
    "greenery", "flora",           // garden
    "notebook", "scribble",        // journal
    "selfcare", "holistic",        // wellness
    "oxygen", "outdoors",          // freshair
    "mobility", "lengthen",        // stretch
    "inhale", "exhale",            // breathe
    "ceremony", "practice",        // ritual
    "equilibrium", "symmetry",     // balance
    "focus", "insight",            // clarity
    "kindness", "warmth",          // gentle
    "habit", "pattern",            // routine
    "presence", "attention",       // mindful
    "sunrise", "a.m.",             // morning
    "sequence", "cadence",         // flow
    "renewal", "restart",          // reset
    "comfort", "release",          // ease
    "alone", "selftime",           // solo
    "nestled", "homey",            // cozy
    "harmony", "serenity",         // peace
    "glow", "brightness"  
  ]
},
{
  themeId: "pages-to-pours",
  name: "Pages to Pours",
  description: "A cozy blend of books, art, and wine-soaked thought.",
  stageFlow: ["bookstore", "coffee", "gallery", "wine bar", "lounge"],
  filters: {
    timeOfDay: ["morning", "midday", "afternoon","day", "evening"],
    price: [1, 2, 3, 4],
    tags: ["bookstore", "gallery", "wine bar", "coffee", "lounge", "reading", "art"],
    vibes: [
      "quiet", "cozy", "literary", "analog", "warm", "vintage", "reflective",
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
  themeId: "party-time",
  name: "Party Time",
  description: "Bring the crew. Tonight, the city is yours.",
  stageFlow: ["bar", "dinner", "bar", "club", "late-night"],
  filters: {
    timeOfDay: ["evening", "night", "late-night"],
    price: [2, 3, 4],
    tags: ["bar", "club", "dinner", "late-night", "dance", "rooftop", "bottle service"],
    vibes: [
      "rowdy", "flashy", "high-energy", "social", "crowded", "fun", "late", "wild",
      "buzzing", "glow", "pulsing", "neon", "afterdark", "boozy", "bold",
      "hype", "intense", "buzzy", "playful", "electric", "raucous", "uproarious",      // rowdy
      "sparkling", "glittery",      // flashy
      "charged", "vibrant",         // high-energy
      "gregarious", "interactive",  // social
      "packed", "swarming",         // crowded
      "joyful", "mirthful",         // fun
      "midnight", "wee-hours",      // late
      "untamed", "feral",           // wild
      "alive", "thrumming",         // buzzing
      "radiant", "shine",           // glow
      "beat-driven", "rhythmic",    // pulsing
      "electric", "luminescent",    // neon
      "twilit", "shadowy",          // afterdark
      "spirited", "tipsy",          // boozy
      "audacious", "confident",     // bold
      "amped", "charged-up",        // hype
      "fervent", "fevered",         // intense
      "effervescent", "bouncy",     // buzzy
      "teasing", "cheery",          // playful
      "current", "sparked" 
    ]
  },
  keywords: [
    "club", "dance", "beats", "late", "dj", "loud", "drinks", "bar",
    "crowded", "energy", "flashy", "afterhours", "party", "scene",
    "friends", "rowdy", "weekend", "pregame", "lit", "cheers", "social",
    "shots", "celebrate", "nightout", "hype", "bass", "vibes", "neon", "rooftop", "venue", "hang",               // club context
    "groove", "movement",          // dance action
    "tempo", "rhythm",             // beats context
    "midnight", "curfew",          // late timing
    "turntable", "mix",            // dj tool
    "decibel", "amplify",          // loud context
    "toast", "sip",                // drinks action
    "pubcrawl", "hangout",         // bar journey
    "throng", "gathering",         // crowded scene
    "vigor", "momentum",           // energy feel
    "sparkle", "flash",            // flashy feel
    "afterglow", "postgame",       // afterhours vibe
    "bash", "fiesta",              // party synonyms
    "view", "spot",                // scene reference
    "crew", "squad",               // friends group
    "cheer-up", "shout",           // rowdy action
    "saturday", "friday",          // weekend markers
    "warming-up", "eager",         // pregame feel
    "radiance", "glare",           // lit quality
    "toastup", "clink",            // cheers action
    "community", "clique",         // social set
    "shotglass", "chaser",         // shots tools
    "joyride", "festivity",        // celebrate meaning
    "latehours", "moonlight",      // nightout framing
    "lowend", "subwoofer",         // bass context
    "feels", "grooves",            // vibes context
    "signage", "billboard",        // neon imagery
    "height", "viewpoint" 
  ]
},
{
  themeId: "post-work-wind-down",
  name: "Post‑Work Wind Down",
  description: "Unplug and ease into the evening after a long day.",
  stageFlow: ["bar", "dinner", "cocktail", "lounge"],
  filters: {
    timeOfDay: ["afternoon","happy hour","evening"],
    price: [1, 2, 3],
    tags: ["bar", "cocktail", "dinner", "lounge", "patio", "happy hour", "wine bar"],
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
  themeId: "self-care",
  name: "Self‑Care",
  description: "Replenish your energy with serene solo stops.",
  stageFlow: ["fitness", "spa", "tea", "bookstore", "park"],
  filters: {
    timeOfDay: ["morning", "midday", "afternoon", "day"],
    price: [1, 2, 3],
    tags: ["spa", "tea", "bookstore", "park", "wellness", "yoga", "massage"],
    vibes: [
      "calm", "serene", "gentle", "restful", "quiet", "mindful", "soothing",
      "grounded", "soft", "warm", "peaceful", "healing", "slow", "nourishing",
      "private", "intentional", "cozy", "balanced", "reflective", "restorative", "placid", "still",               // calm
      "tranquil", "hushed",            // serene
      "tender", "delicate",            // gentle
      "reposing", "sleepy",             // restful
      "muted", "soundless",             // quiet
      "aware", "present",               // mindful
      "comforting", "silken",           // soothing
      "rooted", "centered",             // grounded
      "cushioned", "feathered",         // soft
      "toasty", "glowing",              // warm
      "harmonious", "settled",          // peaceful
      "renewing", "mending",            // healing
      "unhurried", "leisurely",         // slow
      "fortifying", "wholesome",        // nourishing
      "secluded", "personal",           // private
      "purposeful", "deliberate",       // intentional
      "snug", "inviting",               // cozy
      "equable", "steady",              // balanced
      "pensive", "introspective",       // reflective
      "reviving", "replenishing"
    ]
  },
  keywords: [
    "spa", "relax", "yoga", "meditation", "serenity", "retreat", "tea",
    "calm", "detox", "massage", "rejuvenate", "peace",
    "wellness", "breathe", "stillness", "reset", "balance", "restore",
    "solo", "gentle", "quiet", "soft", "unwind", "care", "sauna", "steam",                  // spa
    "pause", "ease",                   // relax
    "asana", "stretch",                // yoga
    "mantra", "silence",               // meditation
    "equanimity", "composure",         // serenity
    "getaway", "hideaway",             // retreat
    "herbal", "infusion",              // tea
    "placidity", "evenness",           // calm
    "cleanse", "purge",                // detox
    "bodywork", "kneading",            // massage
    "revitalize", "renew",             // rejuvenate
    "harmony", "accord",               // peace
    "holistic", "selfhood",            // wellness
    "inhale", "exhale",                // breathe
    "silence", "pause",                // stillness
    "reboot", "restart",               // reset
    "symmetry", "poise",               // balance
    "repair", "rebuild",               // restore
    "me-time", "alone",                // solo
    "kindness", "patience",            // gentle
    "hush", "mute",                    // quiet
    "plush", "velour",                 // soft
    "decompress", "release",           // unwind
    "nurture", "tend" 
  ]
},
{
  themeId: "sunrise-start",
  name: "Sunrise Start",
  description: "Begin your day grounded and energized.",
  stageFlow: ["fitness", "bakery", "coffee", "market", "park"],
  filters: {
    timeOfDay: ["morning", "midday"],
    price: [1, 2],
    tags: ["fitness", "bakery", "coffee", "market", "park", "smoothie", "acai"],
    vibes: [
      "fresh", "early", "sunrise", "cozy", "quiet", "mindful", "energizing", "slow",
      "breezy", "grounded", "warm", "natural", "gentle", "routine", "restorative",
      "soft", "peaceful", "intentional", "inviting", "morning", "crisp", "clean",              // fresh
      "dawn", "firstlight",          // early
      "golden", "rosy",              // sunrise
      "snug", "comforting",          // cozy
      "hushed", "still",             // quiet
      "present", "aware",            // mindful
      "uplifting", "reviving",       // energizing
      "unhurried", "leisurely",      // slow
      "airy", "open",                // breezy
      "centered", "rooted",          // grounded
      "toasty", "glowing",           // warm
      "organic", "earthy",           // natural
      "tender", "lighthearted",      // gentle
      "ritual", "habitual",          // routine
      "renewing", "healing",         // restorative
      "feathered", "muted",          // soft
      "serene", "settled",           // peaceful
      "deliberate", "purposeful",    // intentional
      "welcoming", "approachable",   // inviting
      "sunlit", "daybreak" 
    ]
  },
  keywords: [
    "coffee", "matcha", "sunrise", "morning", "café", "bakery", "brunch", "acai",
    "patio", "quiet", "fresh", "early", "energizing", "routine", "mindful",
    "stretch", "wellness", "cozy", "warm", "comforting", "inviting",
    "breeze", "peaceful", "slow", "outdoor", "daylight", "granola", "leisurely", "reset", "espresso", "pour",             // coffee
    "latte", "foam",                // matcha
    "horizon", "skyline",           // sunrise
    "wake", "rise",                 // morning
    "barista", "counter",           // café
    "pastry", "crumb",              // bakery
    "skillet", "toast",             // brunch
    "berry", "blend",               // acai
    "terrace", "courtyard",         // patio
    "silence", "mute",              // quiet
    "dew", "clarity",               // fresh
    "dawnish", "premidday",         // early
    "charge", "spark",              // energizing
    "sequence", "rhythm",           // routine
    "focus", "attention",           // mindful
    "limber", "warmup",             // stretch
    "balance", "care",              // wellness
    "blanket", "corner",            // cozy
    "steam", "mug",                 // warm
    "reassuring", "homely",         // comforting
    "openarms", "approach",         // inviting
    "airflow", "draft",             // breeze
    "harmony", "ease",              // peaceful
    "tempo", "linger",              // slow
    "greenway", "trail",            // outdoor
    "glow", "shine",                // daylight
    "oats", "crunch",               // granola
    "drift", "meander",             // leisurely
    "reboot", "refresh" 
  ]
},
{
  themeId: "midday-recharge",
  name: "Midday Recharge",
  description: "A relaxing midday refresh to reset and recharge before the evening.",
  stageFlow: ["coffee", "lunch", "park", "gallery"],
  filters: {
    timeOfDay: ["midday", "afternoon"],
    price: [1, 2, 3],
    tags: ["coffee", "lunch", "park", "gallery", "juice", "café", "break"],
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
