import fs from "node:fs";
import path from "node:path";

export class SearchBudget {
  private remaining: number;
  private readonly logPath: string;

  constructor(
    private readonly total: number,
    private readonly workspacePath: string,
  ) {
    if (total <= 0 || !Number.isFinite(total)) {
      throw new Error("Search budget must be a positive number");
    }

    this.remaining = total;
    const dir = path.join(this.workspacePath, "budget");
    fs.mkdirSync(dir, { recursive: true });
    this.logPath = path.join(dir, "search_budget.json");
    this.writeSnapshot("init", null);
  }

  consume(reason: string) {
    if (this.remaining <= 0) {
      throw new Error("Search budget exhausted");
    }
    this.remaining -= 1;
    this.writeSnapshot("consume", reason);
  }

  getUsage() {
    return {
      total: this.total,
      used: this.total - this.remaining,
      remaining: this.remaining,
    };
  }

  private writeSnapshot(event: string, reason: string | null) {
    const entry = {
      event,
      reason,
      timestamp: new Date().toISOString(),
      total: this.total,
      remaining: this.remaining,
    };

    let history: typeof entry[] = [];
    if (fs.existsSync(this.logPath)) {
      history = JSON.parse(fs.readFileSync(this.logPath, "utf-8"));
    }
    history.push(entry);
    fs.writeFileSync(this.logPath, JSON.stringify(history, null, 2));
  }
}

