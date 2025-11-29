import { supabaseAdmin } from "../../lib/supabase";

export type InterestTopic = {
  label: string;
  confidence: number;
  evidence?: string;
};

export type SaveInterestProfileInput = {
  userId: string;
  agentRunId: string;
  summary: string;
  topics: InterestTopic[];
  rawContextUrl?: string;
};

export const saveInterestProfile = async (input: SaveInterestProfileInput) => {
  const { data, error } = await supabaseAdmin
    .from("interest_profiles")
    .insert({
      user_id: input.userId,
      agent_run_id: input.agentRunId,
      summary: input.summary,
      topics: input.topics,
      raw_context_url: input.rawContextUrl,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to save interest profile: ${error.message}`);
  }

  return data;
};

export const getLatestInterestProfile = async (userId: string) => {
  const { data, error } = await supabaseAdmin
    .from("interest_profiles")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    throw new Error(`Failed to load interest profile: ${error.message}`);
  }

  return data;
};

