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
  InterestTopic,
  WeekendRecommendation,
  WeekendScouterRequest,
  WeekendScouterResult,
} from "@weekend/core";
import { env } from "../config/env";
import { loadPrompts } from "../lib/promptLoader";
import { BudgetManager, BudgetStage } from "../lib/budgetManager";
import { slugify } from "../lib/slugify";

const prompts = loadPrompts();
const BASE_PROMPT = prompts["scouting/weekend_scouter_system.md"];
const REPORT_DIR = "reports";

export type WeekendScouterAgentOptions = {
  workspaceRoot?: string;
  modelName?: string;
  searchBudget?: number;
};

const DEFAULT_BUDGET = 5;

export class WeekendScouterAgent {
  private readonly logger = pino({ name: "weekend-scouter-agent" });
  private readonly tavily = new TavilyClient({ apiKey: env.tavilyApiKey });

  constructor(private readonly options: WeekendScouterAgentOptions = {}) {}

  async run(request: WeekendScouterRequest): Promise<WeekendScouterResult> {
    const workspacePath = this.prepareWorkspace(request);
    const budgetManager = new BudgetManager(
      this.options.searchBudget ?? DEFAULT_BUDGET,
      request.profile.interests,
      workspacePath,
    );

    const searchTool = this.createLayeredSearchTool(budgetManager, request.profile.interests, workspacePath);
    const systemPrompt = this.buildSystemPrompt(request, budgetManager.getAllocations());

    const agent = createDeepAgent({
      model: new ChatOpenAI({
        apiKey: env.openRouter.apiKey,
        configuration: { baseURL: env.openRouter.apiBase },
        model: this.options.modelName ?? env.openRouter.defaultModel,
        temperature: 0.2,
      }),
      tools: [searchTool],
      systemPrompt,
      backend: () =>
        new FilesystemBackend({
          rootDir: workspacePath,
          virtualMode: true,
        }),
    });

    const payload = {
      profile: request.profile,
      trip: request.trip,
      deliverableFormat: request.deliverableFormat ?? "markdown",
      allocations: budgetManager.getAllocations(),
    };

    const result = await agent.invoke(
      {
        messages: [
          {
            role: "user",
            content: JSON.stringify(payload, null, 2),
          },
        ],
      },
      {
        recursionLimit: 100,
      },
    );

    const finalReport = this.readReport(workspacePath, result);
    const recommendations = this.readRecommendations(workspacePath);

    return {
      workspacePath,
      budget: budgetManager.getAllocations(),
      report: finalReport,
      recommendations,
    };
  }

  private prepareWorkspace(request: WeekendScouterRequest): string {
    const base = this.options.workspaceRoot ?? path.resolve(process.cwd(), "storage/weekend_scouter_runs");
    const slug = `${slugify(request.trip.city)}-${Date.now()}`;
    const runDir = path.join(base, slug);

    fs.mkdirSync(path.join(runDir, "planning"), { recursive: true });
    fs.mkdirSync(path.join(runDir, "interests"), { recursive: true });
    fs.mkdirSync(path.join(runDir, REPORT_DIR), { recursive: true });

    for (const topic of request.profile.interests) {
      fs.mkdirSync(path.join(runDir, "interests", slugify(topic.name)), { recursive: true });
    }

    return runDir;
  }

  private createLayeredSearchTool(
    budgetManager: BudgetManager,
    interests: InterestTopic[],
    workspacePath: string,
  ) {
    const interestMap = new Map(interests.map((topic) => [topic.id, topic]));

    return tool(
      async ({
        interestId,
        intent,
        query,
        localeHint,
        maxResults = 6,
        includeRawContent = true,
      }: {
        interestId: string;
        intent: BudgetStage;
        query: string;
        localeHint?: string;
        maxResults?: number;
        includeRawContent?: boolean;
      }) => {
        const interest = interestMap.get(interestId);
        if (!interest) {
          throw new Error(`Unknown interest ${interestId}`);
        }

        budgetManager.consume(interestId, intent);

        const search = await this.tavily.search({
          query,
          max_results: maxResults,
          include_raw_content: includeRawContent,
        });

        this.persistSearchArtifact(workspacePath, interest, intent, query, {
          localeHint,
          intent,
          query,
          timestamp: new Date().toISOString(),
          results: search.results ?? [],
        });

        return {
          status: "ok",
          interest: interest.name,
          intent,
          usedBudget: budgetManager.getAllocations(),
          results: search.results,
        };
      },
      {
        name: "layered_search",
        description:
          "Layered Tavily search. Always specify interestId and intent (scan|deep_dive|validation). Each invocation spends budget.",
        schema: z.object({
          interestId: z.string().describe("ID of the interest topic you are researching"),
          intent: z.enum(["scan", "deep_dive", "validation"]).describe("Search stage to help distribute budget"),
          query: z
            .string()
            .min(4)
            .describe("Concrete query including local language keywords and venue/scene hints"),
          localeHint: z.string().optional().describe("Optional reasoning about language/source choices"),
          maxResults: z.number().int().min(3).max(8).optional(),
          includeRawContent: z.boolean().optional(),
        }),
      },
    );
  }

  private buildSystemPrompt(
    request: WeekendScouterRequest,
    allocations: BudgetAllocation[],
  ): string {
    const interestDetails = request.profile.interests
      .map((interest) => {
        const allocation = allocations.find((item) => item.interestId === interest.id);
        return [
          `- ${interest.name} (budget: ${allocation?.totalCalls ?? 0} calls, tags: ${interest.tags?.join(", ") ?? "n/a"})`,
          interest.summary ? `  Summary: ${interest.summary}` : null,
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n");

    const languageHints = request.profile.preferredLanguages.join(", ");

    const tripContext = [
      `Destination: ${request.trip.city}, ${request.trip.country ?? ""}`.trim(),
      `Dates: ${request.trip.startDate} → ${request.trip.endDate}`,
      request.trip.notes ? `Trip notes: ${request.trip.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const dynamicAddendum = `
## Traveler Profile
Bio: ${request.profile.bioSummary}
Preferred languages: ${languageHints}

## Interest Buckets & Budget
${interestDetails}

## Trip Window
${tripContext}
`;

    return `${BASE_PROMPT}\n${dynamicAddendum}`;
  }

  private persistSearchArtifact(
    workspacePath: string,
    interest: InterestTopic,
    intent: BudgetStage,
    query: string,
    payload: unknown,
  ) {
    const interestDir = path.join(workspacePath, "interests", slugify(interest.name));
    fs.mkdirSync(interestDir, { recursive: true });
    const fileName = `search-${intent}-${Date.now()}.json`;
    const content = JSON.stringify(
      {
        interest: interest.name,
        intent,
        query,
        payload,
      },
      null,
      2,
    );
    fs.writeFileSync(path.join(interestDir, fileName), content, "utf-8");
  }

  private readReport(workspacePath: string, agentResult: any): string {
    const summaryPath = path.join(workspacePath, REPORT_DIR, "summary.md");
    if (fs.existsSync(summaryPath)) {
      return fs.readFileSync(summaryPath, "utf-8");
    }

    const messages = agentResult?.messages;
    if (Array.isArray(messages) && messages.length > 0) {
      const last = messages[messages.length - 1];
      if (typeof last?.content === "string") {
        return last.content;
      }
    }

    return "Agent finished without producing summary.md. Check workspace files for context.";
  }

  private readRecommendations(workspacePath: string): WeekendRecommendation[] {
    const recPath = path.join(workspacePath, REPORT_DIR, "recommendations.json");
    if (!fs.existsSync(recPath)) {
      return [];
    }

    try {
      const raw = fs.readFileSync(recPath, "utf-8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as WeekendRecommendation[]) : [];
    } catch (error) {
      this.logger.warn({ err: error }, "Failed to parse recommendations.json");
      return [];
    }
  }
}

