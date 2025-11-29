import { supabaseAdmin } from "../../lib/supabase";

export type EventRecord = {
  id: string;
  title: string;
  summary?: string;
  location?: string;
  start_at?: string;
  score?: number;
  source_url?: string;
};

export const listEvents = async (userId: string) => {
  const { data, error } = await supabaseAdmin
    .from("events")
    .select("*")
    .eq("user_id", userId)
    .order("start_at", { ascending: true })
    .limit(100);

  if (error) {
    throw new Error(`Failed to list events: ${error.message}`);
  }

  return data;
};

