import { pool } from "@workspace/db";
import { logger } from "./logger";

const SQL = `
CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  auth_provider text NOT NULL DEFAULT 'email',
  password_hash text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  expires_at timestamp NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS businesses (
  id serial PRIMARY KEY,
  user_id text NOT NULL UNIQUE,
  business_name text NOT NULL,
  share_link_id text NOT NULL UNIQUE,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id serial PRIMARY KEY,
  user_id text NOT NULL,
  business_id integer NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  price text NOT NULL,
  description text NOT NULL,
  image text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id serial PRIMARY KEY,
  business_id integer NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
`;

export async function ensureSchema(): Promise<void> {
  try {
    await pool.query(SQL);
    logger.info("Database schema ensured");
  } catch (err) {
    logger.error({ err: String(err) }, "Failed to ensure database schema");
    throw err;
  }
}
