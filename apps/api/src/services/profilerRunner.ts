import pino from "pino";

const logger = pino({ name: "profiler-runner" });

// Set to true to use mock data instead of real agent
const USE_MOCK = true;

export type ProfilerRunResult = {
  workspacePath: string;
  profile: Record<string, unknown> | null;
  personaSummary: string | null;
};

// Mock profile based on real generated data
const MOCK_PROFILE = {
  userId: "demo-user",
  identity: {
    displayName: null,
    homeBase: null,
    preferredLanguages: ["ru", "en"],
    bioSummary: "An active traveler balancing reflective history days, mystical nature hikes, and high-energy nightlife; curious about cities, castles, and islands."
  },
  macroPreferences: {
    adventureOutdoor: 0.75,
    cultureArt: 0.8,
    nightlifeFestivals: 0.7,
    foodCulinary: 0.3,
    wellnessRelaxation: 0.45,
    natureScenic: 0.85,
    urbanExploration: 0.75,
    techInnovation: 0.35,
    sportsActive: 0.5,
    luxuryTravel: 0.3
  },
  latentTraits: {
    curiosity: 0.9,
    socialEnergy: 0.55,
    intensity: 0.7,
    aestheticSensitivity: 0.8,
    natureAffinity: 0.8,
    culturalDepth: 0.85,
    festivalAffinity: 0.6,
    planningStyle: "flexible"
  },
  budget: {
    explicit: {
      level: null,
      perDayMin: null,
      perDayMax: null,
      currency: null
    },
    inferred: {
      score: 0.6,
      confidence: 0.4
    },
    final: {
      score: 0.6,
      level: "mid"
    }
  },
  interests: [
    {
      id: "nature-hiking-islands",
      label: "Nature – laurel forests, volcanoes, alpine vistas",
      description: "Dramatic island topography, cloud forests, geothermal pools, and Central/Eastern European alpine day hikes.",
      tags: ["laurel forest", "volcano", "hot springs", "miradouro", "alpine hike", "island landscapes"],
      macroFocus: ["adventureOutdoor", "natureScenic", "wellnessRelaxation"],
      preferredFormats: ["self-guided day hikes", "scenic viewpoints", "thermal baths", "sunrise/sunset sessions", "guided nature walks"],
      weight: 0.9
    },
    {
      id: "history-museums-memory",
      label: "Knowledge / History – memory culture, arms & armor, Egyptology",
      description: "Sites of memory, national history museums, fortresses, and rigorous, context-rich tours and exhibits.",
      tags: ["memorials", "national museums", "arms & armor", "archaeology", "Egypt"],
      macroFocus: ["cultureArt", "urbanExploration"],
      preferredFormats: ["curated museum routes", "audio guides", "walking history tours", "fortress visits"],
      weight: 0.85
    },
    {
      id: "urbanism-architecture-nights",
      label: "Urbanism & Architecture – regenerated waterfronts, night cityscapes",
      description: "Photogenic creative districts, diverse architecture, and street-level city exploration with an urbanist lens.",
      tags: ["waterfront renewal", "creative districts", "night photography", "architecture"],
      macroFocus: ["urbanExploration", "cultureArt", "nightlifeFestivals"],
      preferredFormats: ["evening photo walks", "architecture tours", "creative district hops", "ferry/riverfront loops"],
      weight: 0.75
    },
    {
      id: "nightlife-techno-dnb",
      label: "Nightlife – hard techno, drum & bass, carnival energy",
      description: "Bass-heavy underground nights and festival vibes; industrial/acid techno and DnB rooms over mainstream pop.",
      tags: ["hard techno", "industrial", "acid", "drum & bass", "warehouse"],
      macroFocus: ["nightlifeFestivals"],
      preferredFormats: ["underground clubs", "festival afterparties", "DnB events", "street parades"],
      weight: 0.7
    },
    {
      id: "medieval-castles-reenactment",
      label: "Gaming → Medieval aesthetic IRL – castles, reenactment",
      description: "Castle circuits, living history, and weaponry exhibits rooted in RPG and strategy-game tastes.",
      tags: ["castles", "reenactment", "blacksmithing", "arms & armor"],
      macroFocus: ["cultureArt", "urbanExploration"],
      preferredFormats: ["castle tours", "living history museums", "medieval fairs", "weaponry exhibitions"],
      weight: 0.65
    },
    {
      id: "tropics-islands-beach",
      label: "Tropics & Islands – playful beach escapes",
      description: "Occasional warm-water getaways with snorkeling, catamarans, and beach clubs.",
      tags: ["snorkeling", "catamaran", "beach club", "tropical"],
      macroFocus: ["wellnessRelaxation", "natureScenic", "nightlifeFestivals"],
      preferredFormats: ["day passes to private beaches", "snorkel trips", "catamaran sails", "casual beach clubs"],
      weight: 0.55
    }
  ],
  trip: {
    city: null,
    country: null,
    startDate: null,
    endDate: null,
    notes: null,
    hardConstraints: {
      radiusKm: null,
      mustBeLocal: null,
      excludeTouristTraps: null,
      timeOfDay: ["morning", "afternoon", "evening", "night"],
      daysOfWeekPriority: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    }
  },
  outputPreferences: {
    deliverableFormat: "markdown",
    maxEventsPerInterest: 5,
    includeDebugInfo: false
  }
};

const MOCK_PERSONA_SUMMARY = `Russian-speaking traveler balancing reflective history days, mystical nature hikes, and high-energy nightlife; curious about cities, castles, and islands.

Key interests:
- Nature & hiking (laurel forests, volcanoes, alpine vistas)
- History & museums (memory culture, arms & armor)
- Urban exploration & architecture
- Nightlife (hard techno, drum & bass)
- Medieval aesthetics (castles, reenactment)
- Tropical beach escapes

Planning style: Flexible
Budget level: Mid-range`;

/**
 * Run the interest profiler agent
 * When USE_MOCK=true, returns mock data immediately
 * When USE_MOCK=false, calls the real agent
 */
export async function runProfiler(userId: string): Promise<ProfilerRunResult> {
  logger.info({ userId, useMock: USE_MOCK }, "Starting profiler run");

  if (USE_MOCK) {
    return runMockProfiler(userId);
  }

  return runRealProfiler(userId);
}

/**
 * Mock profiler - returns hardcoded data after short delay
 */
async function runMockProfiler(userId: string): Promise<ProfilerRunResult> {
  logger.info({ userId }, "Running MOCK profiler");

  // Simulate processing time (1-2 seconds)
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const profile = {
    ...MOCK_PROFILE,
    userId, // Override with actual user ID
  };

  return {
    workspacePath: `/mock/${Date.now()}`,
    profile,
    personaSummary: MOCK_PERSONA_SUMMARY,
  };
}

/**
 * Real profiler - calls the actual agent
 */
async function runRealProfiler(userId: string): Promise<ProfilerRunResult> {
  const path = await import("node:path");
  const fs = await import("node:fs");

  const DATA_DIR = path.resolve(process.cwd(), "../agents/src/experiments/data");

  logger.info({ userId, dataDir: DATA_DIR }, "Running REAL profiler");

  // Check if we have the agent module available
  let InterestProfilerAgent: typeof import("../../../agents/src/agents/interestProfilerAgent").InterestProfilerAgent;

  try {
    const agentModule = await import("../../../agents/src/agents/interestProfilerAgent");
    InterestProfilerAgent = agentModule.InterestProfilerAgent;
  } catch (err) {
    logger.error({ err }, "Failed to import InterestProfilerAgent - falling back to mock");
    return runMockProfiler(userId);
  }

  // Load data blobs from hardcoded directory
  if (!fs.existsSync(DATA_DIR)) {
    logger.warn({ dataDir: DATA_DIR }, "Data directory not found - falling back to mock");
    return runMockProfiler(userId);
  }

  const files = fs.readdirSync(DATA_DIR).filter((f: string) => !f.startsWith("."));

  if (files.length === 0) {
    logger.warn("No data files found - falling back to mock");
    return runMockProfiler(userId);
  }

  const dataBlobs = files.map((file: string, index: number) => {
    const filePath = path.join(DATA_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");
    return {
      id: `blob-${index + 1}`,
      source: "dataset",
      filename: file,
      description: `Imported from ${file}`,
      content,
    };
  });

  const agent = new InterestProfilerAgent({
    workspaceRoot: path.resolve(process.cwd(), "../agents/storage/interest_profiler_runs"),
    searchBudget: 8,
  });

  const result = await agent.run({
    userId,
    searchBudget: 8,
    dataBlobs,
  });

  logger.info({ workspacePath: result.workspacePath, budgetUsed: result.budgetUsed }, "Profiler completed");

  return {
    workspacePath: result.workspacePath,
    profile: result.profile as Record<string, unknown> | null,
    personaSummary: result.personaSummary ?? null,
  };
}
