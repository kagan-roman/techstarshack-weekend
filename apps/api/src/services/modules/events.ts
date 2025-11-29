import { sql } from "../../lib/db";

const TABLE = "hackathon.events";

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
  const rows = await sql.unsafe(`
    SELECT * FROM ${TABLE}
    WHERE user_id = $1::uuid
    ORDER BY start_at ASC
    LIMIT 100
  `, [userId]);

  return rows;
};
