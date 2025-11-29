import fs from "node:fs";
import path from "node:path";
import { BudgetAllocation, InterestTopic } from "@weekend/core";
import { slugify } from "./slugify";

export type BudgetStage = "scan" | "deep_dive" | "validation";

type BudgetRecord = {
  interestId: string;
  interestName: string;
  slug: string;
  totalCalls: number;
  usedCalls: number;
  stageUsage: Record<BudgetStage, number>;
};

export class BudgetManager {
  private readonly ledger: Record<string, BudgetRecord> = {};
  private readonly budgetDir: string;

  constructor(
    totalBudget: number,
    interests: InterestTopic[],
    private readonly workspaceRoot: string,
  ) {
    if (!Number.isFinite(totalBudget) || totalBudget <= 0) {
      throw new Error("searchBudget must be a positive number");
    }

    if (!interests.length) {
      throw new Error("At least one interest topic is required");
    }

    const base = Math.floor(totalBudget / interests.length);
    let remainder = totalBudget % interests.length;

    for (const topic of interests) {
      const slug = slugify(topic.name || topic.id);
      const allowance = base + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;

      this.ledger[topic.id] = {
        interestId: topic.id,
        interestName: topic.name,
        slug,
        totalCalls: allowance,
        usedCalls: 0,
        stageUsage: {
          scan: 0,
          deep_dive: 0,
          validation: 0,
        },
      };
    }

    this.budgetDir = path.join(this.workspaceRoot, "budget");
    fs.mkdirSync(this.budgetDir, { recursive: true });
    this.writeSnapshot("init");
  }

  consume(interestId: string, stage: BudgetStage) {
    const record = this.ledger[interestId];
    if (!record) {
      throw new Error(`Unknown interest ${interestId}`);
    }

    if (record.usedCalls >= record.totalCalls) {
      throw new Error(
        `Budget exhausted for ${record.interestName}. Limit ${record.totalCalls} calls reached.`,
      );
    }

    record.usedCalls += 1;
    record.stageUsage[stage] += 1;
    this.writeSnapshot(stage);
  }

  getAllocations(): BudgetAllocation[] {
    return Object.values(this.ledger).map((entry) => ({
      interestId: entry.interestId,
      interestName: entry.interestName,
      totalCalls: entry.totalCalls,
      usedCalls: entry.usedCalls,
    }));
  }

  private writeSnapshot(trigger: string) {
    const snapshot = {
      trigger,
      generatedAt: new Date().toISOString(),
      entries: Object.values(this.ledger),
    };

    fs.writeFileSync(
      path.join(this.budgetDir, "budget.json"),
      JSON.stringify(snapshot, null, 2),
      "utf-8",
    );
  }
}

