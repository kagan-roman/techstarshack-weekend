import fs from "node:fs";
import path from "node:path";
import pino from "pino";
import { InterestProfilerAgent } from "../agents/interestProfilerAgent";
import { DataBlob, InterestProfilerRequest } from "@weekend/core";

const logger = pino({ name: "interest-profiler-experiment" });
const dataDir = path.resolve(__dirname, "data");

const requestFromFiles = (): InterestProfilerRequest => {
  if (!fs.existsSync(dataDir)) {
    throw new Error(`Data directory missing at ${dataDir}`);
  }

  const files = fs
    .readdirSync(dataDir)
    .filter((file) => file !== ".gitkeep")
    .map((file) => path.join(dataDir, file));

  if (!files.length) {
    throw new Error(`No data files found in ${dataDir}`);
  }

  const dataBlobs: DataBlob[] = files.map((filePath, index) => {
    const content = fs.readFileSync(filePath, "utf-8");
    const filename = path.basename(filePath);
    return {
      id: `blob-${index + 1}`,
      source: "dataset",
      filename,
      description: `Imported from ${filename}`,
      content,
    };
  });

  return {
    userId: "demo-user",
    searchBudget: 8,
    dataBlobs,
  };
};

const main = async () => {
  const agent = new InterestProfilerAgent({
    workspaceRoot: path.resolve(process.cwd(), "storage/interest_profiler_runs"),
    searchBudget: 8,
  });

  const mockRequest = requestFromFiles();
  const result = await agent.run(mockRequest);
  logger.info(
    {
      workspace: result.workspacePath,
      hasProfile: Boolean(result.profile),
    },
    "Profiler completed",
  );

  console.log("=== Persona Summary ===");
  console.log(result.personaSummary);
  console.log("=== User Profile ===");
  console.log(JSON.stringify(result.profile, null, 2));
};

main().catch((error) => {
  logger.error({ err: error }, "Experiment failed");
  process.exit(1);
});

