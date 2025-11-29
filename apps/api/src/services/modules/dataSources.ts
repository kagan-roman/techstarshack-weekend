import { sql } from "../../lib/db";

const TABLE = "hackathon.data_sources";

export type DataSourceStatus = "pending" | "ready" | "failed";

export type CreateDataSourceInput = {
  userId: string;
  provider: string;
  payloadUrl?: string;
  notes?: string;
};

export const createDataSource = async (input: CreateDataSourceInput) => {
  const [row] = await sql.unsafe(`
    INSERT INTO ${TABLE} (user_id, provider, payload_url, notes, status)
    VALUES ($1::uuid, $2, $3, $4, 'pending')
    RETURNING *
  `, [input.userId, input.provider, input.payloadUrl ?? null, input.notes ?? null]);

  return row;
};

export const listDataSources = async (userId: string) => {
  const rows = await sql.unsafe(`
    SELECT * FROM ${TABLE}
    WHERE user_id = $1::uuid
    ORDER BY created_at DESC
  `, [userId]);

  return rows;
};
