import path from "node:path";
import pino from "pino";
import { WeekendScouterAgent } from "../agents/weekendScouterAgent";
import { WeekendScouterRequest } from "@weekend/core";

const logger = pino({ name: "weekend-scouter-isolated", level: "info" });

const main = async () => {
  const agent = new WeekendScouterAgent({
    searchBudget: 6,
    workspaceRoot: path.resolve(process.cwd(), "storage/dev_runs"),
  });

  const request: WeekendScouterRequest = {
    profile: {
      userId: "demo-user",
      displayName: "Space Punk Nomad",
      homeBase: "Tallinn",
      preferredLanguages: ["English", "Estonian", "Russian"],
      bioSummary:
        "Obsessed with astronomy, heavy underground scenes, early-stage founders, and local comfort food with attitude.",
      interests: [
        {
          id: "astro",
          name: "Astronomy & Physics salons",
          summary: "Observatory nights, citizen science meetups, space cafes.",
          tags: ["astronomy", "physics"],
        },
        {
          id: "punk",
          name: "Underground punk/metal/electronic",
          summary: "DIY shows, rave collectives, independent venues.",
          tags: ["punk", "metal", "electronic"],
        },
        {
          id: "startups",
          name: "Startup/tech founders",
          summary: "Meetups, hacker houses, demo nights.",
          tags: ["founders", "meetups"],
        },
        {
          id: "foodie",
          name: "Mid-range local foodie gems",
          summary: "Modern Estonian, Baltic-Asian mashups, hidden bars.",
          tags: ["food", "drink"],
        },
      ],
    },
    trip: {
      city: "Tallinn",
      country: "Estonia",
      startDate: "2025-12-01",
      endDate: "2025-12-14",
      notes: "Wants local-only experiences + interesting communities. Budget flexible but prefers mid-range.",
    },
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

