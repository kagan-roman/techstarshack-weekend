import fs from "node:fs";
import path from "node:path";

export type PromptMap = Record<string, string>;

export const loadPrompts = (baseDir = path.resolve(process.cwd(), "../../prompts")): PromptMap => {
  const map: PromptMap = {};

  if (!fs.existsSync(baseDir)) {
    throw new Error(`Prompt directory missing at ${baseDir}`);
  }

  const walk = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const currentPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(currentPath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        const key = path.relative(baseDir, currentPath).replace(/\\/g, "/");
        map[key] = fs.readFileSync(currentPath, "utf-8");
      }
    }
  };

  walk(baseDir);
  return map;
};

