import fs from "node:fs";
import path from "node:path";
import pino from "pino";
import { WeekendScouterAgent } from "../agents/weekendScouterAgent";
import { WeekendScouterRequest, UserProfile } from "@weekend/core";

const logger = pino({ name: "weekend-scouter-isolated", level: "info" });
const DEFAULT_PROFILE_PATH =
  "/Users/romankaganov/Documents/onecraft/techstarshack-weekend/apps/agents/storage/interest_profiler_runs/1764429524415/reports/profile.json";

const loadProfile = (): UserProfile => {
  const profilePath = process.env.SCOUTER_PROFILE_PATH ?? DEFAULT_PROFILE_PATH;
  if (!fs.existsSync(profilePath)) {
    throw new Error(`Profile JSON not found at ${profilePath}. Set SCOUTER_PROFILE_PATH to override.`);
  }

  const raw = fs.readFileSync(profilePath, "utf-8");
  const profile = JSON.parse(raw) as UserProfile;
  return profile;
};

const main = async () => {
  const agent = new WeekendScouterAgent({
    searchBudget: 70, // 10 calls per interest (7 interests including food)
    workspaceRoot: path.resolve(process.cwd(), "storage/dev_runs"),
    maxParallel: 3, // Run 3 interest agents in parallel
  });

  const profile = loadProfile();
  
  // Ensure trip context has all required fields (profile may have trip object with null values)
  const defaultTrip = {
    city: "Tallinn",
    country: "Estonia",
    startDate: "2025-12-01",
    endDate: "2025-12-14",
    notes: "Default trip context injected by isolated runner",
  };
  
  profile.trip = {
    ...defaultTrip,
    ...profile.trip,
    // Override nulls with defaults
    city: profile.trip?.city ?? defaultTrip.city,
    country: profile.trip?.country ?? defaultTrip.country,
    startDate: profile.trip?.startDate ?? defaultTrip.startDate,
    endDate: profile.trip?.endDate ?? defaultTrip.endDate,
  };

  const request: WeekendScouterRequest = {
    profile,
    deliverableFormat: "markdown",
  };

  const result = await agent.run(request);

  logger.info({ workspace: result.workspacePath }, "Agent completed");
  console.log("==== SUMMARY ====");
  console.log(result.report);
  console.log("\n==== RECOMMENDATIONS ====");
  console.log(JSON.stringify(result.recommendations, null, 2));
  console.log("\nWorkspace:", result.workspacePath);
};

main().catch((error) => {
  logger.error({ err: error }, "Isolated scouter run failed");
  process.exit(1);
});

