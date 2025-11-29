import { sql } from "../../lib/db";

const TABLE = "hackathon.users";

export type CreateOrUpdateUserInput = {
  googleId: string;
  email?: string;
  name?: string;
  picture?: string;
};

export const findOrCreateUser = async (input: CreateOrUpdateUserInput, forceNewAlias = false) => {
  // If forcing new alias, create a new user with modified google_id
  if (forceNewAlias) {
    return createUserAlias(input);
  }

  // Try to find existing user by google_id
  const [existing] = await sql.unsafe(`
    SELECT * FROM ${TABLE} WHERE google_id = $1
  `, [input.googleId]);

  if (existing) {
    // Update user info if changed
    const [updated] = await sql.unsafe(`
      UPDATE ${TABLE}
      SET email = $1,
          name = $2,
          picture = $3,
          updated_at = now()
      WHERE google_id = $4
      RETURNING *
    `, [input.email ?? existing.email, input.name ?? existing.name, input.picture ?? existing.picture, input.googleId]);
    return updated;
  }

  // Create new user
  const [created] = await sql.unsafe(`
    INSERT INTO ${TABLE} (google_id, email, name, picture)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `, [input.googleId, input.email ?? null, input.name ?? null, input.picture ?? null]);

  return created;
};

/**
 * Create a new user alias (for testing with single Google account)
 * Creates user with unique google_id suffix
 */
export const createUserAlias = async (input: CreateOrUpdateUserInput) => {
  // Count existing aliases
  const [countResult] = await sql.unsafe(`
    SELECT COUNT(*) as count FROM ${TABLE} 
    WHERE google_id LIKE $1
  `, [`${input.googleId}%`]);

  const aliasNum = parseInt(countResult?.count ?? "0", 10) + 1;
  const aliasGoogleId = `${input.googleId}_alias_${aliasNum}`;
  const aliasName = input.name ? `${input.name} (Test ${aliasNum})` : `Test User ${aliasNum}`;
  const aliasEmail = input.email ? input.email.replace("@", `+test${aliasNum}@`) : null;

  const [created] = await sql.unsafe(`
    INSERT INTO ${TABLE} (google_id, email, name, picture)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `, [aliasGoogleId, aliasEmail, aliasName, input.picture ?? null]);

  return created;
};

export const getUserById = async (id: string) => {
  const [user] = await sql.unsafe(`
    SELECT * FROM ${TABLE} WHERE id = $1
  `, [id]);
  return user;
};

export const getUserByGoogleId = async (googleId: string) => {
  const [user] = await sql.unsafe(`
    SELECT * FROM ${TABLE} WHERE google_id = $1
  `, [googleId]);
  return user;
};
