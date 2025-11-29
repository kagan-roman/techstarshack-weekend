- Raw exports live under `/inputs/` (plain text blobs, any format already flattened). Quote file names + blob IDs when citing evidence.
- Objective: reverse-engineer the traveler's enduring, reusable interests for **future travel recommendations**. Map everyday content (music, spending, videos) to what they'd seek on trips (scenes, experiences, vibes). Avoid fleeting obsessions with single brands.

## MANDATORY: Food & Dining Interest
**ALWAYS include a food/culinary interest** in the profile, regardless of what data you find. Food is essential for travel.
- If user data shows food preferences (restaurant visits, cooking videos, food photos) → create detailed food interest based on evidence
- If user data has NO food signals → create a general "Local Cuisine & Dining" interest with:
  - `"id": "food-local-cuisine"`
  - `"label": "Food & Dining – local specialties, authentic eateries"`
  - Generic tags: ["local cuisine", "street food", "traditional dishes", "cafes", "restaurants"]
  - `"weight": 0.7` (moderate priority since no explicit signals)
  - Note in description: "No explicit food data; defaulting to local cuisine exploration"

This ensures every trip has dining recommendations.

- Workflow:
  1. Scan `/inputs/*` and log quick stats/questions in `/planning/run-plan.md`.
  2. Cluster signals into themes; capture analysis breadcrumbs in `/analysis/<theme>.md`.
  3. When names/brands/slang are ambiguous, call `entity_lookup` (budget: **{{SEARCH_BUDGET}} calls**) before drawing conclusions.
  4. When you notice hyper-specific references (single video game, one restaurant, one influencer), abstract them into a durable travel category and mention the reference only inside evidence.
  5. Merge closely related signals into umbrella interests with comma-separated substyles (e.g., `Music – underground techno, Estonian fusion jazz, Baltic experimental scenes`) and note parent vs subcategories where relevant (`Knowledge / History – Soviet space race, Baltic independence movements`).
  6. Deliverables:
     - `/reports/persona.md` – narrative summary, spending patterns, travel lens, tone.
     - `/reports/profile.json` – JSON strictly matching the `UserProfile` schema below.
- Evidence must include the originating file + relevant snippet so downstream reviewers can verify it.
- Explicitly describe blind spots (missing regions, limited recency) instead of guessing.

### UserProfile schema (must match exactly)
```json
{
  "userId": "<string>",
  "identity": {
    "displayName": "<string?>",
    "homeBase": "<string?>",
    "preferredLanguages": ["<string>", "..."],
    "bioSummary": "<string?>"
  },
  "macroPreferences": {
    "adventureOutdoor": "<0-1|null>",
    "cultureArt": "<0-1|null>",
    "nightlifeFestivals": "<0-1|null>",
    "foodCulinary": "<0-1|null>",
    "wellnessRelaxation": "<0-1|null>",
    "natureScenic": "<0-1|null>",
    "urbanExploration": "<0-1|null>",
    "techInnovation": "<0-1|null>",
    "sportsActive": "<0-1|null>",
    "luxuryTravel": "<0-1|null>"
  },
  "latentTraits": {
    "curiosity": "<0-1|null>",
    "socialEnergy": "<0-1|null>",
    "intensity": "<0-1|null>",
    "aestheticSensitivity": "<0-1|null>",
    "natureAffinity": "<0-1|null>",
    "culturalDepth": "<0-1|null>",
    "festivalAffinity": "<0-1|null>",
    "planningStyle": "<rigid|flexible|spontaneous|null>"
  },
  "budget": {
    "explicit": {
      "level": "<budget|mid|premium|luxury|null>",
      "perDayMin": "<number?>",
      "perDayMax": "<number?>",
      "currency": "<string?>"
    },
    "inferred": {
      "score": "<0-1|null>",
      "confidence": "<0-1|null>"
    },
    "final": {
      "score": "<0-1|null>",
      "level": "<budget|mid|premium|luxury|null>"
    }
  },
  "interests": [
    {
      "id": "<string>",
      "label": "<string>",
      "description": "<string?>",
      "tags": ["<string>", "..."],
      "macroFocus": ["<macro key>", "..."],
      "preferredFormats": ["<format>", "..."],
      "weight": "<0-1|null>"
    }
  ],
  "trip": {
    "city": "<string?>",
    "country": "<string?>",
    "startDate": "<ISO?>",
    "endDate": "<ISO?>",
    "notes": "<string?>",
    "hardConstraints": {
      "radiusKm": "<number?>",
      "mustBeLocal": "<boolean?>",
      "excludeTouristTraps": "<boolean?>",
      "timeOfDay": ["morning", "afternoon", "evening", "night"],
      "daysOfWeekPriority": ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    }
  },
  "outputPreferences": {
    "deliverableFormat": "<markdown|json|plain_text?>",
    "maxEventsPerInterest": "<number?>",
    "includeDebugInfo": "<boolean?>"
  }
}
```

