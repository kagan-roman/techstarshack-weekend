import { sql } from "../../lib/db";

const TABLE = "hackathon.trips";
const PARTICIPANTS_TABLE = "hackathon.trip_participants";

export type Trip = {
  id: string;
  ownerId: string;
  destination: string;
  country?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
  status: "planning" | "active" | "completed" | "cancelled";
  createdAt: string;
  updatedAt: string;
};

export type TripParticipant = {
  id: string;
  tripId: string;
  userId: string;
  role: "owner" | "participant";
  joinedAt: string;
};

export type CreateTripInput = {
  ownerId: string;
  destination: string;
  country?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
};

/**
 * Create a new trip and add owner as participant
 */
export async function createTrip(input: CreateTripInput): Promise<Trip> {
  const [row] = await sql.unsafe(
    `INSERT INTO ${TABLE} (owner_id, destination, country, start_date, end_date, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [input.ownerId, input.destination, input.country ?? null, input.startDate ?? null, input.endDate ?? null, input.notes ?? null],
  );

  if (!row) {
    throw new Error("Failed to create trip");
  }

  // Add owner as participant with 'owner' role
  await sql.unsafe(
    `INSERT INTO ${PARTICIPANTS_TABLE} (trip_id, user_id, role)
     VALUES ($1, $2, 'owner')`,
    [row.id, input.ownerId],
  );

  return mapTripRow(row);
}

/**
 * Get a trip by ID
 */
export async function getTrip(tripId: string): Promise<Trip | null> {
  const [row] = await sql.unsafe(
    `SELECT * FROM ${TABLE} WHERE id = $1`,
    [tripId],
  );

  return row ? mapTripRow(row) : null;
}

/**
 * Get all trips where user is a participant
 */
export async function getUserTrips(userId: string): Promise<Trip[]> {
  const rows = await sql.unsafe(
    `SELECT t.* FROM ${TABLE} t
     JOIN ${PARTICIPANTS_TABLE} tp ON t.id = tp.trip_id
     WHERE tp.user_id = $1
     ORDER BY t.created_at DESC`,
    [userId],
  );

  return rows.map(mapTripRow);
}

/**
 * Check if user is a participant of a trip
 */
export async function isUserParticipant(tripId: string, userId: string): Promise<boolean> {
  const [row] = await sql.unsafe(
    `SELECT id FROM ${PARTICIPANTS_TABLE} 
     WHERE trip_id = $1 AND user_id = $2`,
    [tripId, userId],
  );

  return !!row;
}

/**
 * Get trip participants
 */
export async function getTripParticipants(tripId: string): Promise<TripParticipant[]> {
  const rows = await sql.unsafe(
    `SELECT * FROM ${PARTICIPANTS_TABLE} WHERE trip_id = $1`,
    [tripId],
  );

  return rows.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    tripId: row.trip_id as string,
    userId: row.user_id as string,
    role: row.role as "owner" | "participant",
    joinedAt: row.joined_at as string,
  }));
}

/**
 * Add a participant to a trip
 */
export async function addParticipant(
  tripId: string,
  userId: string,
  role: "owner" | "participant" = "participant",
): Promise<TripParticipant> {
  const [row] = await sql.unsafe(
    `INSERT INTO ${PARTICIPANTS_TABLE} (trip_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (trip_id, user_id) DO UPDATE SET role = $3
     RETURNING *`,
    [tripId, userId, role],
  );

  if (!row) {
    throw new Error("Failed to add participant");
  }

  return {
    id: row.id,
    tripId: row.trip_id,
    userId: row.user_id,
    role: row.role as "owner" | "participant",
    joinedAt: row.joined_at,
  };
}

// Helper
function mapTripRow(row: Record<string, unknown>): Trip {
  return {
    id: row.id as string,
    ownerId: row.owner_id as string,
    destination: row.destination as string,
    country: (row.country as string) ?? undefined,
    startDate: (row.start_date as string) ?? undefined,
    endDate: (row.end_date as string) ?? undefined,
    notes: (row.notes as string) ?? undefined,
    status: row.status as Trip["status"],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
