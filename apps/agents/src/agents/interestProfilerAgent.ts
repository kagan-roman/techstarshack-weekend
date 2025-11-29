import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import pino from "pino";
import { tool } from "langchain";
import { TavilyClient } from "tavily";
import { ChatOpenAI } from "@langchain/openai";
import { createDeepAgent, FilesystemBackend } from "deepagents";
import {
  InterestProfilerRequest,
  InterestProfilerResult,
  InterestProfilerTopic,
  DataBlob,
  UserProfile,
} from "@weekend/core";
import { env } from "../config/env";
import { loadPrompts } from "../lib/promptLoader";
import { SearchBudget } from "../lib/searchBudget";

const prompts = loadPrompts();
const SYSTEM_PROMPT_TEMPLATE = prompts["interest/profiler_system.md"];

export type InterestProfilerAgentOptions = {
  workspaceRoot?: string;
  modelName?: string;
  searchBudget?: number;
};

const DEFAULT_SEARCH_BUDGET = 10;

export class InterestProfilerAgent {
  private readonly logger = pino({ name: "interest-profiler-agent" });
  private readonly tavily = new TavilyClient({ apiKey: env.tavilyApiKey });

  constructor(private readonly options: InterestProfilerAgentOptions = {}) {}

  async run(request: InterestProfilerRequest): Promise<InterestProfilerResult> {
    const workspacePath = this.prepareWorkspace();
    this.persistInputs(workspacePath, request.dataBlobs);

    const budget = new SearchBudget(
      request.searchBudget ?? this.options.searchBudget ?? DEFAULT_SEARCH_BUDGET,
      workspacePath,
    );
    const lookupTool = this.createLookupTool(budget, workspacePath);
    const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace("{{SEARCH_BUDGET}}", budget.getUsage().total.toString());

    const agent = createDeepAgent({
      model: new ChatOpenAI({
        apiKey: env.openRouter.apiKey,
        configuration: { baseURL: env.openRouter.apiBase },
        model: this.options.modelName ?? env.openRouter.defaultModel,
        temperature: 0.1,
      }),
      tools: [lookupTool],
      systemPrompt,
      backend: () =>
        new FilesystemBackend({
          rootDir: workspacePath,
          virtualMode: true,
        }),
    });

    const payload = {
      userId: request.userId,
      blobs: request.dataBlobs.map((blob) => ({
        id: blob.id,
        source: blob.source,
        filename: blob.filename,
      })),
      budget: budget.getUsage(),
    };

    await agent.invoke(
      {
        messages: [
          {
            role: "user",
            content: JSON.stringify(payload, null, 2),
          },
        ],
      },
      { recursionLimit: 200 },
    );

    const personaSummary = this.readPersona(workspacePath);
    const profile = this.readProfile(workspacePath, request.userId);
    const evidences = this.readLegacyInterests(workspacePath);
    const rawArtifacts = this.collectArtifacts(workspacePath);

    return {
      workspacePath,
      budgetUsed: budget.getUsage().used,
      personaSummary,
      profile,
      evidences,
      rawArtifacts,
    };
  }

  private prepareWorkspace(): string {
    const base = this.options.workspaceRoot ?? path.resolve(process.cwd(), "storage/interest_profiler_runs");
    const dir = path.join(base, `${Date.now()}`);
    fs.mkdirSync(path.join(dir, "inputs"), { recursive: true });
    fs.mkdirSync(path.join(dir, "analysis"), { recursive: true });
    fs.mkdirSync(path.join(dir, "reports"), { recursive: true });
    return dir;
  }

  private persistInputs(workspacePath: string, blobs: DataBlob[]) {
    const dir = path.join(workspacePath, "inputs");
    fs.mkdirSync(dir, { recursive: true });

    blobs.forEach((blob, index) => {
      const baseName =
        blob.filename ??
        `${blob.source.replace(/\s+/g, "_").toLowerCase()}-${blob.id || index}.txt`;
      const filePath = path.join(dir, baseName);

      const envelope = [
        `Source: ${blob.source}`,
        blob.description ? `Description: ${blob.description}` : null,
        blob.metadata ? `Metadata: ${JSON.stringify(blob.metadata)}` : null,
        "",
        blob.content,
      ]
        .filter(Boolean)
        .join("\n");

      fs.writeFileSync(filePath, envelope, "utf-8");
    });
  }

  private createLookupTool(budget: SearchBudget, workspacePath: string) {
    return tool(
      async ({
        query,
        context,
        maxResults = 5,
        includeRawContent = false,
      }: {
        query: string;
        context?: string;
        maxResults?: number;
        includeRawContent?: boolean;
      }) => {
        budget.consume(query);
        const response = await this.tavily.search({
          query,
          max_results: maxResults,
          include_raw_content: includeRawContent,
        });

        this.writeLookupArtifact(workspacePath, {
          query,
          context,
          timestamp: new Date().toISOString(),
          results: response.results ?? [],
        });

        return response.results;
      },
      {
        name: "entity_lookup",
        description:
          "Verify unfamiliar brands, venues, channels, or slang using a limited search budget. Use when evidence needs clarification.",
        schema: z.object({
          query: z.string().min(3),
          context: z.string().optional(),
          maxResults: z.number().int().min(3).max(8).optional(),
          includeRawContent: z.boolean().optional(),
        }),
      },
    );
  }

  private writeLookupArtifact(workspacePath: string, payload: unknown) {
    const dir = path.join(workspacePath, "analysis");
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `lookup-${Date.now()}.json`);
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  }

  private readPersona(workspacePath: string): string {
    const personaPath = path.join(workspacePath, "reports/persona.md");
    if (fs.existsSync(personaPath)) {
      return fs.readFileSync(personaPath, "utf-8");
    }
    return "Persona summary missing. Check workspace artifacts.";
  }

  private readProfile(workspacePath: string, userId: string): UserProfile | null {
    const profilePath = path.join(workspacePath, "reports/profile.json");
    if (!fs.existsSync(profilePath)) {
      this.logger.warn("profile.json not found; returning null");
      return null;
    }

    try {
      const profile = JSON.parse(fs.readFileSync(profilePath, "utf-8"));
      return {
        userId,
        identity: profile.identity ?? {},
        macroPreferences: profile.macroPreferences ?? this.emptyMacroPreferences(),
        latentTraits: profile.latentTraits ?? this.emptyLatentTraits(),
        budget: profile.budget ?? { final: { score: null, level: null } },
        interests: profile.interests ?? [],
        trip: profile.trip,
        outputPreferences: profile.outputPreferences,
      } as UserProfile;
    } catch (error) {
      this.logger.error({ err: error }, "Failed to parse profile.json");
      return null;
    }
  }

  private readLegacyInterests(workspacePath: string): InterestProfilerTopic[] {
    const interestsPath = path.join(workspacePath, "reports/interests.json");
    if (!fs.existsSync(interestsPath)) {
      return [];
    }

    try {
      const data = JSON.parse(fs.readFileSync(interestsPath, "utf-8"));
      if (!Array.isArray(data)) {
        return [];
      }

      return data.map((topic) => ({
        id: topic.id ?? topic.name ?? `topic-${Math.random().toString(36).slice(2)}`,
        name: topic.name,
        summary: topic.summary,
        tags: topic.tags ?? [],
        confidence: topic.confidence ?? topic.weight,
        evidence: topic.evidence ?? [],
      })) as InterestProfilerTopic[];
    } catch (error) {
      this.logger.error({ err: error }, "Failed to parse interests.json (legacy)");
      return [];
    }
  }

  private collectArtifacts(workspacePath: string): string[] {
    const reportsDir = path.join(workspacePath, "reports");
    if (!fs.existsSync(reportsDir)) {
      return [];
    }

    const entries: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir)) {
        const absolute = path.join(dir, entry);
        const relative = path.relative(workspacePath, absolute);
        if (fs.statSync(absolute).isDirectory()) {
          walk(absolute);
        } else {
          entries.push(relative);
        }
      }
    };

    walk(reportsDir);
    return entries;
  }

  private emptyMacroPreferences() {
    return {
      adventureOutdoor: null,
      cultureArt: null,
      nightlifeFestivals: null,
      foodCulinary: null,
      wellnessRelaxation: null,
      natureScenic: null,
      urbanExploration: null,
      techInnovation: null,
      sportsActive: null,
      luxuryTravel: null,
    };
  }

  private emptyLatentTraits() {
    return {
      curiosity: null,
      socialEnergy: null,
      intensity: null,
      aestheticSensitivity: null,
      natureAffinity: null,
      culturalDepth: null,
      festivalAffinity: null,
    };
  }
}

