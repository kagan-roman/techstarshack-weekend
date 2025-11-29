import { supabaseAdmin } from "../../lib/supabase";

export type RunType = "interest_extraction" | "weekend_scouter";
export type RunStatus = "queued" | "running" | "succeeded" | "failed";

export type EnqueueRunInput = {
  userId: string;
  type: RunType;
  payload: Record<string, unknown>;
};

export const enqueueAgentRun = async (input: EnqueueRunInput) => {
  const { data, error } = await supabaseAdmin
    .from("agent_runs")
    .insert({
      user_id: input.userId,
      type: input.type,
      payload: input.payload,
      status: "queued",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to enqueue agent run: ${error.message}`);
  }

  return data;
};

