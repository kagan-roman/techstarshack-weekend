import { supabaseAdmin } from "../../lib/supabase";

export type DataSourceStatus = "pending" | "ready" | "failed";

export type CreateDataSourceInput = {
  userId: string;
  provider: string;
  payloadUrl?: string;
  notes?: string;
};

export const createDataSource = async (input: CreateDataSourceInput) => {
  const { data, error } = await supabaseAdmin
    .from("data_sources")
    .insert({
      user_id: input.userId,
      provider: input.provider,
      payload_url: input.payloadUrl,
      notes: input.notes,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create data source: ${error.message}`);
  }

  return data;
};

export const listDataSources = async (userId: string) => {
  const { data, error } = await supabaseAdmin
    .from("data_sources")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list data sources: ${error.message}`);
  }

  return data;
};

