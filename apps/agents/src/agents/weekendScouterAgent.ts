import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import pino from "pino";
import { tool } from "langchain";
import { TavilyClient } from "tavily";
import { ChatOpenAI } from "@langchain/openai";
import { createDeepAgent, FilesystemBackend } from "deepagents";
import {
  BudgetAllocation,
  InterestSlice,
  TripContext,
  UserProfile,
  WeekendRecommendation,
  WeekendScouterRequest,
  WeekendScouterResult,
} from "@weekend/core";
import { env } from "../config/env";
import { loadPrompts } from "../lib/promptLoader";
import { BudgetManager, BudgetStage } from "../lib/budgetManager";
import { slugify } from "../lib/slugify";

const prompts = loadPrompts();
const INTEREST_PROMPT = prompts["scouting/interest_subagent.md"];
const REPORT_DIR = "reports";

export type WeekendScouterAgentOptions = {
  workspaceRoot?: string;
  modelName?: string;
  searchBudget?: number;
  maxParallel?: number;
};

const DEFAULT_BUDGET = 12;
const TAVILY_MAX_ATTEMPTS = 3;
const DEFAULT_MAX_PARALLEL = 3; // Don't overload APIs

type InterestAgentResult = {
  interestId: string;
  interestLabel: string;
  recommendations: WeekendRecommendation[];
  success: boolean;
  error?: string;
};

export class WeekendScouterAgent {
  private readonly logger = pino({ name: "weekend-scouter-agent" });
  private readonly tavily = new TavilyClient({ apiKey: env.tavilyApiKey });

  constructor(private readonly options: WeekendScouterAgentOptions = {}) {}

  async run(request: WeekendScouterRequest): Promise<WeekendScouterResult> {
    const trip = this.resolveTrip(request);
    const workspacePath = this.prepareWorkspace(trip, request.profile.interests);
    const budgetManager = new BudgetManager(
      this.options.searchBudget ?? DEFAULT_BUDGET,
      request.profile.interests,
      workspacePath,
    );

    this.logger.info(
      {
        workspace: workspacePath,
        interests: request.profile.interests.length,
        budget: this.options.searchBudget ?? DEFAULT_BUDGET,
      },
      "Starting parallel interest scouting",
    );

    // Run all interest agents in parallel (with concurrency limit)
    const results = await this.runInterestAgentsParallel(
      request.profile,
      trip,
      budgetManager,
      workspacePath,
    );

    // Compile all recommendations
    const allRecommendations = this.compileRecommendations(results, workspacePath);

    // Generate summary report
    const report = this.generateSummaryReport(results, trip, request.profile);
    const summaryPath = path.join(workspacePath, REPORT_DIR, "summary.md");
    fs.writeFileSync(summaryPath, report, "utf-8");

    this.logger.info(
      {
        totalRecommendations: allRecommendations.length,
        successfulInterests: results.filter((r) => r.success).length,
        failedInterests: results.filter((r) => !r.success).length,
      },
      "Parallel scouting completed",
    );

    return {
      workspacePath,
      budget: budgetManager.getAllocations(),
      report,
      recommendations: allRecommendations,
    };
  }

  /**
   * Run agents for all interests in parallel with concurrency control
   */
  private async runInterestAgentsParallel(
    profile: UserProfile,
    trip: TripContext,
    budgetManager: BudgetManager,
    workspacePath: string,
  ): Promise<InterestAgentResult[]> {
    const maxParallel = this.options.maxParallel ?? DEFAULT_MAX_PARALLEL;
    const interests = profile.interests;
    const results: InterestAgentResult[] = [];

    // Process in batches to control concurrency
    for (let i = 0; i < interests.length; i += maxParallel) {
      const batch = interests.slice(i, i + maxParallel);
      
      this.logger.info(
        { batch: Math.floor(i / maxParallel) + 1, interests: batch.map((b: InterestSlice) => b.id) },
        "Starting interest batch",
      );

      const batchResults = await Promise.all(
        batch.map((interest: InterestSlice) =>
          this.runSingleInterestAgent(interest, profile, trip, budgetManager, workspacePath),
        ),
      );

      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Run a single interest agent
   */
  private async runSingleInterestAgent(
    interest: InterestSlice,
    profile: UserProfile,
    trip: TripContext,
    budgetManager: BudgetManager,
    workspacePath: string,
  ): Promise<InterestAgentResult> {
    const interestLabel = this.getInterestLabel(interest);
    const interestSlug = slugify(interestLabel);

    this.logger.info({ interest: interest.id, label: interestLabel }, "Starting interest agent");

    try {
      const searchTool = this.createInterestSearchTool(budgetManager, interest, workspacePath);
      const saveRecommendationsTool = this.createSaveRecommendationsTool(workspacePath, interest);

      const systemPrompt = this.buildInterestAgentPrompt(interest, profile, trip, budgetManager);

      const agent = createDeepAgent({
        model: new ChatOpenAI({
          apiKey: env.openRouter.apiKey,
          configuration: { baseURL: env.openRouter.apiBase },
          model: this.options.modelName ?? env.openRouter.defaultModel,
          temperature: 0.2,
        }),
        tools: [searchTool, saveRecommendationsTool],
        systemPrompt,
        backend: () =>
          new FilesystemBackend({
            rootDir: path.join(workspacePath, "interests", interestSlug),
            virtualMode: true,
          }),
      });

      const payload = {
        interest,
        trip,
        profile: {
          identity: profile.identity,
          macroPreferences: profile.macroPreferences,
          latentTraits: profile.latentTraits,
          budget: profile.budget,
        },
        allocation: budgetManager.getAllocations().find((a) => a.interestId === interest.id),
      };

      await agent.invoke(
        {
          messages: [
            {
              role: "user",
              content: `Research and find recommendations for this interest:\n\n${JSON.stringify(payload, null, 2)}\n\nAfter finding recommendations, call save_recommendations to save them.`,
            },
          ],
        },
        {
          recursionLimit: 200, // Each interest agent gets its own limit
        },
      );

      // Read saved recommendations
      const recommendations = this.readInterestRecommendations(workspacePath, interestSlug);

      this.logger.info(
        { interest: interest.id, count: recommendations.length },
        "Interest agent completed",
      );

      return {
        interestId: interest.id,
        interestLabel,
        recommendations,
        success: true,
      };
    } catch (error) {
      this.logger.error({ err: error, interest: interest.id }, "Interest agent failed");

      return {
        interestId: interest.id,
        interestLabel,
        recommendations: [],
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Build system prompt for individual interest agent
   */
  private buildInterestAgentPrompt(
    interest: InterestSlice,
    profile: UserProfile,
    trip: TripContext,
    budgetManager: BudgetManager,
  ): string {
    const base = INTEREST_PROMPT.replaceAll("{{INTEREST_NAME}}", this.getInterestLabel(interest))
      .replaceAll("{{INTEREST_SLUG}}", slugify(this.getInterestLabel(interest)));

    const allocation = budgetManager.getAllocations().find((a) => a.interestId === interest.id);

    const context = `
## Your Mission
You are researching "${this.getInterestLabel(interest)}" for a trip to ${trip.city}, ${trip.country}.
Trip dates: ${trip.startDate} to ${trip.endDate}

## Search Budget
You have ${allocation?.totalCalls ?? 0} search calls available. Use them wisely across SCAN, DEEP_DIVE, and VALIDATION passes.

## Traveler Context
- Languages: ${profile.identity?.preferredLanguages?.join(", ") ?? "English"}
- Bio: ${profile.identity?.bioSummary ?? "n/a"}

## Interest Details
${JSON.stringify(interest, null, 2)}

## IMPORTANT
After completing your research, you MUST call \`save_recommendations\` with your findings.
Structure each recommendation properly with all required fields (type, id, title, venue, startDateTime/operatingHours, touristTrap score, sources, etc.)
`;

    return `${base}\n${context}`;
  }

  private prepareWorkspace(trip: TripContext, interests: InterestSlice[]): string {
    const base = this.options.workspaceRoot ?? path.resolve(process.cwd(), "storage/weekend_scouter_runs");
    const slugBase = trip.city ? slugify(trip.city) : "trip";
    const slug = `${slugBase}-${Date.now()}`;
    const runDir = path.join(base, slug);

    fs.mkdirSync(path.join(runDir, "planning"), { recursive: true });
    fs.mkdirSync(path.join(runDir, "interests"), { recursive: true });
    fs.mkdirSync(path.join(runDir, REPORT_DIR), { recursive: true });

    for (const topic of interests) {
      fs.mkdirSync(path.join(runDir, "interests", slugify(this.getInterestLabel(topic))), { recursive: true });
    }

    return runDir;
  }

  private createInterestSearchTool(
    budgetManager: BudgetManager,
    interest: InterestSlice,
    workspacePath: string,
  ) {
    return tool(
      async ({
        intent,
        query,
        localeHint,
        maxResults = 6,
        includeRawContent = true,
      }: {
        intent: BudgetStage;
        query: string;
        localeHint?: string;
        maxResults?: number;
        includeRawContent?: boolean;
      }) => {
        budgetManager.consume(interest.id, intent);

        const search = await this.searchWithRetry(
          {
            query,
            max_results: maxResults,
            include_raw_content: includeRawContent,
          },
          {
            interest: this.getInterestLabel(interest),
            stage: intent,
            query,
          },
        );

        this.persistSearchArtifact(workspacePath, interest, intent, query, {
          localeHint,
          intent,
          query,
          timestamp: new Date().toISOString(),
          results: search.results ?? [],
        });

        return {
          status: "ok",
          interest: this.getInterestLabel(interest),
          intent,
          remainingBudget: budgetManager.getAllocations().find((a) => a.interestId === interest.id),
          results: search.results ?? [],
        };
      },
      {
        name: "search",
        description: `Search for ${this.getInterestLabel(interest)} related content. Specify intent (scan|deep_dive|validation) to track budget.`,
        schema: z.object({
          intent: z.enum(["scan", "deep_dive", "validation"]).describe("Search stage"),
          query: z.string().min(4).describe("Search query with local language keywords"),
          localeHint: z.string().optional().describe("Language/source reasoning"),
          maxResults: z.number().int().min(3).max(8).optional(),
          includeRawContent: z.boolean().optional(),
        }),
      },
    );
  }

  private createSaveRecommendationsTool(workspacePath: string, interest: InterestSlice) {
    const interestSlug = slugify(this.getInterestLabel(interest));
    
    return tool(
      async ({ recommendations }: { recommendations: WeekendRecommendation[] }) => {
        const interestDir = path.join(workspacePath, "interests", interestSlug);
        fs.mkdirSync(interestDir, { recursive: true });

        const filePath = path.join(interestDir, "recommendations.json");
        fs.writeFileSync(filePath, JSON.stringify(recommendations, null, 2), "utf-8");

        this.logger.info(
          { interest: interest.id, count: recommendations.length },
          "Saved interest recommendations",
        );

        return {
          status: "ok",
          savedCount: recommendations.length,
          filePath: `interests/${interestSlug}/recommendations.json`,
        };
      },
      {
        name: "save_recommendations",
        description: "Save your found recommendations. Call this after completing research.",
        schema: z.object({
          recommendations: z.array(z.any()).describe("Array of recommendation objects"),
        }),
      },
    );
  }

  private readInterestRecommendations(workspacePath: string, interestSlug: string): WeekendRecommendation[] {
    const filePath = path.join(workspacePath, "interests", interestSlug, "recommendations.json");

    if (!fs.existsSync(filePath)) {
      return [];
    }

    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as WeekendRecommendation[]) : [];
    } catch (error) {
      this.logger.warn({ err: error, interestSlug }, "Failed to parse interest recommendations");
      return [];
    }
  }

  private compileRecommendations(
    results: InterestAgentResult[],
    workspacePath: string,
  ): WeekendRecommendation[] {
    const allRecommendations: WeekendRecommendation[] = [];

    for (const result of results) {
      allRecommendations.push(...result.recommendations);
    }

    // Write compiled file
    const finalPath = path.join(workspacePath, REPORT_DIR, "recommendations.json");
    fs.writeFileSync(finalPath, JSON.stringify(allRecommendations, null, 2), "utf-8");

    this.logger.info({ totalCount: allRecommendations.length }, "Compiled all recommendations");

    return allRecommendations;
  }

  private generateSummaryReport(
    results: InterestAgentResult[],
    trip: TripContext,
    profile: UserProfile,
  ): string {
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);
    const totalRecs = results.reduce((sum, r) => sum + r.recommendations.length, 0);

    let report = `# Weekend Scouting Report: ${trip.city}, ${trip.country}

**Trip Dates**: ${trip.startDate} → ${trip.endDate}
**Total Recommendations**: ${totalRecs}
**Interests Processed**: ${successful.length}/${results.length}

---

## Summary by Interest

`;

    for (const result of results) {
      const status = result.success ? "✅" : "❌";
      report += `### ${status} ${result.interestLabel}\n`;
      report += `- Recommendations found: ${result.recommendations.length}\n`;
      if (result.error) {
        report += `- Error: ${result.error}\n`;
      }
      report += "\n";
    }

    if (failed.length > 0) {
      report += `---\n\n## Failed Interests\n\n`;
      for (const fail of failed) {
        report += `- **${fail.interestLabel}**: ${fail.error}\n`;
      }
    }

    report += `\n---\n\n## Recommendations Overview\n\n`;

    // Group by type
    const events = results.flatMap((r) => r.recommendations.filter((rec) => rec.type === "event"));
    const locations = results.flatMap((r) => r.recommendations.filter((rec) => rec.type === "location"));

    report += `- **Events**: ${events.length}\n`;
    report += `- **Locations**: ${locations.length}\n`;

    return report;
  }

  private persistSearchArtifact(
    workspacePath: string,
    interest: InterestSlice,
    intent: BudgetStage,
    query: string,
    payload: unknown,
  ) {
    const interestDir = path.join(workspacePath, "interests", slugify(this.getInterestLabel(interest)));
    fs.mkdirSync(interestDir, { recursive: true });
    const fileName = `search-${intent}-${Date.now()}.json`;
    const content = JSON.stringify(
      {
        interest: this.getInterestLabel(interest),
        intent,
        query,
        payload,
      },
      null,
      2,
    );
    fs.writeFileSync(path.join(interestDir, fileName), content, "utf-8");
  }

  private async searchWithRetry(
    options: Parameters<TavilyClient["search"]>[0],
    context: { interest: string; stage: BudgetStage; query: string },
  ) {
    let lastError: unknown;
    for (let attempt = 0; attempt < TAVILY_MAX_ATTEMPTS; attempt++) {
      try {
        return await this.tavily.search(options);
      } catch (error) {
        lastError = error;
        const retryable = this.isRetryableSearchError(error);
        this.logger.warn(
          {
            attempt: attempt + 1,
            interest: context.interest,
            stage: context.stage,
            query: context.query,
            retryable,
            err: error,
          },
          "Tavily search failed",
        );

        if (!retryable || attempt === TAVILY_MAX_ATTEMPTS - 1) {
          throw new Error(
            `Tavily search failed for ${context.interest} [${context.stage}] with query "${context.query}": ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }

        await this.delay((attempt + 1) * 1000);
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Tavily search failed after retries");
  }

  private isRetryableSearchError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }
    return error.name === "TimeoutError" || /timed out/i.test(error.message);
  }

  private async delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private resolveTrip(request: WeekendScouterRequest): TripContext {
    const trip = request.trip ?? request.profile.trip;
    if (!trip) {
      throw new Error("Trip context is required (provide via profile.trip or request.trip)");
    }
    if (!trip.city) {
      throw new Error("Trip context must include city");
    }
    return trip;
  }

  private getInterestLabel(interest: InterestSlice): string {
    return interest.label || (interest as Record<string, string>).name || interest.id;
  }
}

