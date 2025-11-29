import { sql } from "../../lib/db";

const TABLE = "hackathon.recommendations";

export type RecommendationType = "event" | "location";

export type StoredRecommendation = {
  id: string;
  tripId: string;
  externalId: string;
  addedBy?: string;
  type: RecommendationType;
  title: string;
  description?: string;
  venue?: {
    name: string;
    address?: string;
    neighborhood?: string;
    lat?: number;
    lng?: number;
  };
  address?: string;
  startDateTime?: string;
  endDateTime?: string;
  operatingHours?: {
    summary: string;
    details?: Record<string, string>;
  };
  uniquenessReason?: string;
  tags?: string[];
  touristTrap?: number;
  price?: {
    amount?: number;
    currency?: string;
    note?: string;
  };
  sources?: Array<{
    url: string;
    type?: string;
    note?: string;
    name?: string;
  }>;
  languages?: string[];
  interestFit?: string;
  confidence?: number;
  rawData?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type RawRecommendation = {
  id: string;
  type: "event" | "location";
  title: string;
  description?: string;
  venue?: {
    name: string;
    address?: string;
    neighborhood?: string;
    lat?: number;
    lng?: number;
  };
  address?: string;
  startDateTime?: string;
  endDateTime?: string;
  operatingHours?: {
    summary: string;
    details?: Record<string, string>;
  };
  uniquenessReason?: string;
  tags?: string[];
  touristTrap?: number;
  price?: {
    amount?: number;
    currency?: string;
    note?: string;
    notes?: string;
  };
  sources?: Array<{
    url: string;
    type?: string;
    note?: string;
    name?: string;
  }>;
  languages?: string[];
  interestFit?: string;
  whyItFits?: string;
  fitReason?: string;
  confidence?: number;
  [key: string]: unknown;
};

/**
 * Save multiple recommendations for a trip (bulk insert)
 */
export async function saveRecommendations(
  tripId: string,
  recommendations: RawRecommendation[],
  addedBy?: string,
): Promise<StoredRecommendation[]> {
  const results: StoredRecommendation[] = [];

  for (const rec of recommendations) {
    const stored = await saveRecommendation(tripId, rec, addedBy);
    results.push(stored);
  }

  return results;
}

/**
 * Save a single recommendation
 */
export async function saveRecommendation(
  tripId: string,
  rec: RawRecommendation,
  addedBy?: string,
): Promise<StoredRecommendation> {
  const interestFit = rec.interestFit || rec.whyItFits || rec.fitReason;
  
  const [row] = await sql.unsafe(
    `INSERT INTO ${TABLE} (
      trip_id, external_id, added_by, type, title, description,
      venue, address, start_date_time, end_date_time,
      operating_hours, uniqueness_reason, tags, tourist_trap,
      price, sources, languages, interest_fit, confidence, raw_data
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
    ON CONFLICT (trip_id, external_id) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      venue = EXCLUDED.venue,
      address = EXCLUDED.address,
      start_date_time = EXCLUDED.start_date_time,
      end_date_time = EXCLUDED.end_date_time,
      operating_hours = EXCLUDED.operating_hours,
      uniqueness_reason = EXCLUDED.uniqueness_reason,
      tags = EXCLUDED.tags,
      tourist_trap = EXCLUDED.tourist_trap,
      price = EXCLUDED.price,
      sources = EXCLUDED.sources,
      languages = EXCLUDED.languages,
      interest_fit = EXCLUDED.interest_fit,
      confidence = EXCLUDED.confidence,
      raw_data = EXCLUDED.raw_data,
      updated_at = now()
    RETURNING *`,
    [
      tripId,
      rec.id,
      addedBy ?? null,
      rec.type,
      rec.title,
      rec.description ?? null,
      rec.venue ? JSON.stringify(rec.venue) : null,
      rec.address ?? null,
      rec.startDateTime ?? null,
      rec.endDateTime ?? null,
      rec.operatingHours ? JSON.stringify(rec.operatingHours) : null,
      rec.uniquenessReason ?? null,
      rec.tags ?? null,
      rec.touristTrap ?? null,
      rec.price ? JSON.stringify(rec.price) : null,
      rec.sources ? JSON.stringify(rec.sources) : null,
      rec.languages ?? null,
      interestFit ?? null,
      rec.confidence ?? null,
      JSON.stringify(rec),
    ],
  );

  if (!row) {
    throw new Error("Failed to save recommendation");
  }

  return mapRecommendationRow(row);
}

/**
 * Get all recommendations for a trip
 */
export async function getTripRecommendations(tripId: string): Promise<StoredRecommendation[]> {
  const rows = await sql.unsafe(
    `SELECT * FROM ${TABLE} 
     WHERE trip_id = $1 
     ORDER BY created_at ASC`,
    [tripId],
  );

  return rows.map(mapRecommendationRow);
}

/**
 * Get a single recommendation by external ID within a trip
 */
export async function getRecommendationByExternalId(
  tripId: string,
  externalId: string,
): Promise<StoredRecommendation | null> {
  const [row] = await sql.unsafe(
    `SELECT * FROM ${TABLE} 
     WHERE trip_id = $1 AND external_id = $2`,
    [tripId, externalId],
  );

  return row ? mapRecommendationRow(row) : null;
}

/**
 * Delete a recommendation
 */
export async function deleteRecommendation(tripId: string, externalId: string): Promise<boolean> {
  const result = await sql.unsafe(
    `DELETE FROM ${TABLE} 
     WHERE trip_id = $1 AND external_id = $2
     RETURNING id`,
    [tripId, externalId],
  );

  return result.length > 0;
}

// Helper to parse JSON fields that might be strings
function parseJsonField<T>(value: unknown): T | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return undefined;
    }
  }
  return value as T;
}

// Helper
function mapRecommendationRow(row: Record<string, unknown>): StoredRecommendation {
  return {
    id: row.id as string,
    tripId: row.trip_id as string,
    externalId: row.external_id as string,
    addedBy: (row.added_by as string) ?? undefined,
    type: row.type as RecommendationType,
    title: row.title as string,
    description: (row.description as string) ?? undefined,
    venue: parseJsonField<StoredRecommendation["venue"]>(row.venue),
    address: (row.address as string) ?? undefined,
    startDateTime: (row.start_date_time as string) ?? undefined,
    endDateTime: (row.end_date_time as string) ?? undefined,
    operatingHours: parseJsonField<StoredRecommendation["operatingHours"]>(row.operating_hours),
    uniquenessReason: (row.uniqueness_reason as string) ?? undefined,
    tags: (row.tags as string[]) ?? undefined,
    touristTrap: (row.tourist_trap as number) ?? undefined,
    price: parseJsonField<StoredRecommendation["price"]>(row.price),
    sources: parseJsonField<StoredRecommendation["sources"]>(row.sources),
    languages: (row.languages as string[]) ?? undefined,
    interestFit: (row.interest_fit as string) ?? undefined,
    confidence: (row.confidence as number) ?? undefined,
    rawData: parseJsonField<Record<string, unknown>>(row.raw_data),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/**
 * Convert stored recommendation back to client format
 */
export function toClientFormat(rec: StoredRecommendation): Record<string, unknown> {
  return {
    id: rec.externalId, // Use external ID for client
    type: rec.type,
    title: rec.title,
    description: rec.description,
    venue: rec.venue,
    address: rec.address,
    startDateTime: rec.startDateTime,
    endDateTime: rec.endDateTime,
    operatingHours: rec.operatingHours,
    uniquenessReason: rec.uniquenessReason,
    tags: rec.tags,
    touristTrap: rec.touristTrap,
    price: rec.price,
    sources: rec.sources,
    languages: rec.languages,
    interestFit: rec.interestFit,
    confidence: rec.confidence,
  };
}
