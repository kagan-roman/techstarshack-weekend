export type InterestTopic = {
  id: string;
  name: string;
  summary?: string;
  weight?: number;
  tags?: string[];
  vibeHints?: string[];
  confidence?: number;
};

export type UserTravelProfile = {
  userId: string;
  displayName?: string;
  homeBase?: string;
  preferredLanguages: string[];
  bioSummary: string;
  interests: InterestTopic[];
};

export type TripWindow = {
  city: string;
  region?: string;
  country?: string;
  startDate: string;
  endDate: string;
  timezone?: string;
  notes?: string;
};

export type WeekendScouterRequest = {
  profile: UserProfile;
  trip?: TripContext;
  deliverableFormat?: "markdown" | "json";
};

export type BudgetAllocation = {
  interestId: string;
  interestName: string;
  totalCalls: number;
  usedCalls: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Experience Types: Event vs Location
// ─────────────────────────────────────────────────────────────────────────────

export type ExperienceType = "event" | "location";

/**
 * Base experience fields shared by both Events and Locations
 */
export type BaseExperience = {
  id: string;
  type: ExperienceType;
  title: string;
  description: string;
  interestId: string;
  
  // Physical location
  venue: string;
  address?: string;
  coordinates?: { lat: number; lng: number };
  
  // Why this fits the user
  matchReason: string;
  vibe?: string;
  tags?: string[];
  
  // Pricing
  priceHint?: "free" | "low" | "mid" | "high" | "luxury";
  priceDetails?: string;
  
  // Sources for verification
  sources: Array<{
    label: string;
    url: string;
  }>;
  
  // Booking / reservation info
  bookingInfo?: string;
  bookingUrl?: string;
  
  /**
   * Tourist trap score: 0-100
   * 0 = hidden gem (found in local groups, reddit, telegram, niche blogs)
   * 100 = tourist trap (top TripAdvisor, government tourism sites, mainstream guides)
   * 
   * Score based on WHERE the info was found:
   * - 0-20: Local telegram/discord, word of mouth, niche forums
   * - 20-40: Reddit, local language blogs, community FB groups
   * - 40-60: Local event sites, regional media, scene-specific platforms
   * - 60-80: National tourism sites, major review platforms, travel blogs
   * - 80-100: Top TripAdvisor, government tourism boards, mainstream guidebooks
   */
  touristTrap: number;
};

/**
 * EVENT: A time-bound happening (concert, exhibition opening, festival, workshop, etc.)
 * 
 * RULES:
 * - MUST have exact startDateTime (ISO 8601)
 * - Cannot recommend a venue without a specific event happening there
 * - Example: "Techno night at HALL" must specify which night, with date
 */
export type EventExperience = BaseExperience & {
  type: "event";
  
  // REQUIRED: exact start date and time in ISO 8601 format
  startDateTime: string;
  
  // Optional: when it ends
  endDateTime?: string;
  
  // Optional: if recurring, describe pattern
  recurrence?: string;
  
  // Event-specific metadata
  eventCategory?: "concert" | "festival" | "exhibition" | "workshop" | "tour" | "party" | "performance" | "sports" | "other";
  performers?: string[];
  organizer?: string;
};

/**
 * LOCATION: A place worth visiting on its own, NOT tied to a specific event
 * 
 * RULES:
 * - Only recommend if it's genuinely unique to this city/country
 * - Must reveal local culture or be impossible to experience elsewhere
 * - Must precisely match user interests
 * - Requires operating hours instead of specific date/time
 * - Must include justification for why it qualifies
 */
export type LocationExperience = BaseExperience & {
  type: "location";
  
  // REQUIRED: when the place is open
  operatingHours: {
    summary: string; // e.g., "Tue-Sun 10:00-18:00, Mon closed"
    details?: Record<string, string>; // e.g., { "monday": "closed", "tuesday": "10:00-18:00" }
  };
  
  // REQUIRED: why this location qualifies (uniqueness justification)
  uniquenessReason: string;
  
  // Location-specific metadata
  locationCategory?: "museum" | "restaurant" | "bar" | "cafe" | "landmark" | "nature" | "market" | "neighborhood" | "viewpoint" | "other";
  
  // Seasonal notes (if relevant)
  seasonalNotes?: string;
  
  // Best time to visit (not required date, just recommendation)
  bestTimeToVisit?: string;
};

/**
 * Union type for any recommendation
 */
export type WeekendRecommendation = EventExperience | LocationExperience;

/**
 * Type guard to check if recommendation is an Event
 */
export function isEventExperience(rec: WeekendRecommendation): rec is EventExperience {
  return rec.type === "event";
}

/**
 * Type guard to check if recommendation is a Location
 */
export function isLocationExperience(rec: WeekendRecommendation): rec is LocationExperience {
  return rec.type === "location";
}

export type WeekendScouterResult = {
  workspacePath: string;
  budget: BudgetAllocation[];
  report: string;
  recommendations: WeekendRecommendation[];
};

export type DataBlob = {
  id: string;
  source: string;
  filename?: string;
  description?: string;
  mimetype?: string;
  content: string;
  metadata?: Record<string, unknown>;
};

export type InterestEvidence = {
  sourceType: string;
  sourceId?: string;
  snippet: string;
  locationHint?: string;
  link?: string;
};

export type InterestProfilerRequest = {
  userId: string;
  dataBlobs: DataBlob[];
  searchBudget: number;
};

export type InterestProfilerTopic = InterestTopic & {
  evidence: InterestEvidence[];
};

export type BudgetLevel = "budget" | "mid" | "premium" | "luxury";
export type PlanningStyle = "rigid" | "flexible" | "spontaneous";

export type Identity = {
  displayName?: string;
  homeBase?: string;
  preferredLanguages?: string[];
  bioSummary?: string;
};

export type MacroPreferences = {
  adventureOutdoor: number | null;
  cultureArt: number | null;
  nightlifeFestivals: number | null;
  foodCulinary: number | null;
  wellnessRelaxation: number | null;
  natureScenic: number | null;
  urbanExploration: number | null;
  techInnovation: number | null;
  sportsActive: number | null;
  luxuryTravel: number | null;
};

export type LatentTraits = {
  curiosity: number | null;
  socialEnergy: number | null;
  intensity: number | null;
  aestheticSensitivity: number | null;
  natureAffinity: number | null;
  culturalDepth: number | null;
  festivalAffinity: number | null;
  planningStyle?: PlanningStyle;
};

export type BudgetExplicit = {
  level?: BudgetLevel;
  perDayMin?: number;
  perDayMax?: number;
  currency?: string;
};

export type BudgetInferred = {
  score: number | null;
  confidence: number | null;
};

export type BudgetFinal = {
  score: number | null;
  level: BudgetLevel | null;
};

export type BudgetShape = {
  explicit?: BudgetExplicit;
  inferred?: BudgetInferred;
  final: BudgetFinal;
};

export type InterestSlice = {
  id: string;
  label: string;
  description?: string;
  tags: string[];
  macroFocus?: (keyof MacroPreferences)[];
  preferredFormats?: string[];
  weight?: number;
};

export type TripHardConstraints = {
  radiusKm?: number;
  mustBeLocal?: boolean;
  excludeTouristTraps?: boolean;
  timeOfDay?: ("morning" | "afternoon" | "evening" | "night")[];
  daysOfWeekPriority?: ("mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun")[];
};

export type TripContext = {
  city?: string;
  country?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
  hardConstraints?: TripHardConstraints;
};

export type OutputPreferences = {
  deliverableFormat?: "markdown" | "json" | "plain_text";
  maxEventsPerInterest?: number;
  includeDebugInfo?: boolean;
};

export type UserProfile = {
  userId: string;
  identity: Identity;
  macroPreferences: MacroPreferences;
  latentTraits: LatentTraits;
  budget: BudgetShape;
  interests: InterestSlice[];
  trip?: TripContext;
  outputPreferences?: OutputPreferences;
};

export type InterestProfilerResult = {
  workspacePath: string;
  budgetUsed: number;
  profile: UserProfile | null;
  personaSummary?: string;
  evidences?: InterestProfilerTopic[];
  rawArtifacts: string[];
};

