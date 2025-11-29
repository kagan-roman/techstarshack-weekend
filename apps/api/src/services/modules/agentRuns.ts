import { sql } from "../../lib/db";

const TABLE = "hackathon.agent_runs";

export type RunType = "interest_extraction" | "weekend_scouter";
export type RunStatus = "queued" | "running" | "succeeded" | "failed";

export type EnqueueRunInput = {
  userId: string;
  type: RunType;
  payload: Record<string, unknown>;
};

export type AgentRun = {
  id: string;
  user_id: string;
  type: RunType;
  payload: Record<string, unknown>;
  status: RunStatus;
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: Date;
  updated_at: Date;
};

export const createAgentRun = async (input: EnqueueRunInput): Promise<AgentRun> => {
  const [row] = await sql.unsafe(`
    INSERT INTO ${TABLE} (user_id, type, payload, status)
    VALUES ($1::uuid, $2, $3, 'queued')
    RETURNING *
  `, [input.userId, input.type, JSON.stringify(input.payload)]);

  return row as AgentRun;
};

export const updateAgentRunStatus = async (
  runId: string,
  status: RunStatus,
  result?: Record<string, unknown>,
  error?: string,
): Promise<AgentRun> => {
  const [row] = await sql.unsafe(`
    UPDATE ${TABLE}
    SET status = $1,
        result = $2,
        error = $3,
        updated_at = now()
    WHERE id = $4::uuid
    RETURNING *
  `, [status, result ? JSON.stringify(result) : null, error ?? null, runId]);

  return row as AgentRun;
};

export const getAgentRun = async (runId: string): Promise<AgentRun | null> => {
  const [row] = await sql.unsafe(`
    SELECT * FROM ${TABLE} WHERE id = $1::uuid
  `, [runId]);

  return (row as AgentRun) ?? null;
};

export const getAgentRunsByUser = async (userId: string, limit = 20): Promise<AgentRun[]> => {
  const rows = await sql.unsafe(`
    SELECT * FROM ${TABLE}
    WHERE user_id = $1::uuid
    ORDER BY created_at DESC
    LIMIT $2
  `, [userId, limit]);

  return rows as AgentRun[];
};

// Legacy alias
export const enqueueAgentRun = createAgentRun;
