const fs = require("fs");
const path = require("path");

// Where the app keeps its data: saved ideas, the YouTube quota count and
// the search cache. Each is one JSON value under a key.
//
// With DATABASE_URL set (a Postgres address, for example from Neon's free
// plan), values live in a database table. That is needed on free hosts like
// Render, whose own disk is wiped whenever the app goes to sleep.
// Without it, each value is a file in DATA_DIR (default: ./data).

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");

// Changes to the same key run one after another, so two requests at the
// same moment cannot overwrite each other's change.
const queues = new Map();
function serialize(key, task) {
  const run = (queues.get(key) || Promise.resolve()).then(task, task);
  queues.set(key, run.catch(() => {}));
  return run;
}

const fileBackend = {
  file: (key) => path.join(DATA_DIR, `${key}.json`),
  async get(key) {
    try {
      return JSON.parse(await fs.promises.readFile(this.file(key), "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return undefined;
      throw error;
    }
  },
  async update(key, fallback, change) {
    const value = change((await this.get(key)) ?? fallback);
    await fs.promises.mkdir(DATA_DIR, { recursive: true });
    // Write to a temp file first so a crash mid-write cannot corrupt the data.
    const tmp = `${this.file(key)}.tmp`;
    await fs.promises.writeFile(tmp, JSON.stringify(value, null, 2));
    await fs.promises.rename(tmp, this.file(key));
    return value;
  },
};

function postgresBackend(connectionString) {
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString, max: 3 });
  const ready = pool.query(
    "CREATE TABLE IF NOT EXISTS app_data (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())",
  );
  return {
    async get(key) {
      await ready;
      const { rows } = await pool.query("SELECT value FROM app_data WHERE key = $1", [key]);
      return rows[0]?.value;
    },
    async update(key, fallback, change) {
      await ready;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        // Lock the row so a second copy of the app cannot change it meanwhile.
        await client.query("INSERT INTO app_data (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING", [
          key,
          JSON.stringify(fallback),
        ]);
        const { rows } = await client.query("SELECT value FROM app_data WHERE key = $1 FOR UPDATE", [key]);
        const value = change(rows[0].value);
        await client.query("UPDATE app_data SET value = $2, updated_at = now() WHERE key = $1", [key, JSON.stringify(value)]);
        await client.query("COMMIT");
        return value;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

const backend = process.env.DATABASE_URL ? postgresBackend(process.env.DATABASE_URL) : fileBackend;

// The value under key, or fallback when nothing is saved yet.
async function get(key, fallback) {
  return (await backend.get(key)) ?? fallback;
}

// Replaces the value under key with change(current value) and returns it.
function update(key, fallback, change) {
  return serialize(key, () => backend.update(key, fallback, change));
}

module.exports = { get, update, usesDatabase: Boolean(process.env.DATABASE_URL) };
