const crypto = require("crypto");
const ideas = require("./ideas");
const youtube = require("./youtube");
const reminders = require("./reminders");

// "Watch this idea": once a week, looks on YouTube for new videos on the
// idea's subject and emails the tester (only at the address they gave in the
// form) if there are any. Each check is one date-filtered search, about 102
// YouTube units, so the limits below keep it far under the daily quota.

const CHECK_EVERY_DAYS = 7;
const WATCH_DAYS = 90;
const MAX_ACTIVE = 40;
const MAX_PER_EMAIL = 3;
const MAX_CHECKS_PER_RUN = 8;
const STOP_WHEN_UNITS_ABOVE = 5000;
const MAX_LISTED = 5;

const DAY = 86400000;
const isActive = (idea, now = Date.now()) => Boolean(idea.watch?.on) && Date.parse(idea.watch.expiresAt) > now;

// What the report page may see: never the token.
function publicState(idea, now = Date.now()) {
  const w = idea.watch;
  if (!w) return { on: false, available: Boolean(idea.email) && Boolean(idea.report) && reminders.isConfigured() };
  return {
    on: isActive(idea, now),
    available: Boolean(idea.email) && reminders.isConfigured(),
    expiresAt: w.expiresAt,
    lastCheckedAt: w.lastCheckedAt || null,
    found: w.found || 0,
  };
}

// Returns { ok: true, idea } or { ok: false, reason } with a reason key.
async function start(id) {
  const idea = await ideas.find(id);
  if (!idea) return { ok: false, reason: "not_found" };
  if (!idea.email || !reminders.isConfigured()) return { ok: false, reason: "no_email" };
  if (!idea.report) return { ok: false, reason: "not_ready" };
  const all = await ideas.readAll();
  const active = all.filter((i) => isActive(i) && i.id !== id);
  if (active.length >= MAX_ACTIVE) return { ok: false, reason: "full" };
  if (active.filter((i) => i.email === idea.email).length >= MAX_PER_EMAIL) return { ok: false, reason: "too_many" };
  const now = new Date();
  const updated = await ideas.update(id, {
    watch: {
      on: true,
      startedAt: now.toISOString(),
      lastCheckedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + WATCH_DAYS * DAY).toISOString(),
      token: idea.watch?.token || crypto.randomBytes(16).toString("hex"),
      seen: [],
      found: 0,
    },
  });
  return { ok: true, idea: updated };
}

// token is only needed from the email link; the report page knows the id.
async function stop(id, token) {
  const idea = await ideas.find(id);
  if (!idea?.watch) return false;
  if (token !== undefined && token !== idea.watch.token) return false;
  await ideas.modify(id, (i) => ({ ...i, watch: { ...i.watch, on: false } }));
  return true;
}

function tokenMatches(idea, token) {
  const a = Buffer.from(String(idea?.watch?.token || ""));
  const b = Buffer.from(String(token || ""));
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Checks every watched idea that is due (at most MAX_CHECKS_PER_RUN a run).
async function runDue(now = Date.now()) {
  const result = { checked: 0, alerts: 0, skipped: null };
  if (!reminders.isConfigured()) return { ...result, skipped: "email not configured" };
  const due = (await ideas.readAll())
    .filter((i) => isActive(i, now) && now - Date.parse(i.watch.lastCheckedAt) >= CHECK_EVERY_DAYS * DAY)
    .sort((a, b) => Date.parse(a.watch.lastCheckedAt) - Date.parse(b.watch.lastCheckedAt));
  for (const idea of due) {
    if (result.checked >= MAX_CHECKS_PER_RUN) break;
    if ((await youtube.unitsUsedToday()) > STOP_WHEN_UNITS_ABOVE) {
      result.skipped = "quota";
      break;
    }
    try {
      const since = idea.watch.lastCheckedAt;
      const found = (await youtube.newSimilarVideos(idea, since)).filter((v) => !idea.watch.seen.includes(v.videoId));
      result.checked++;
      let alerted = false;
      if (found.length) {
        alerted = await reminders.sendWatchAlert(idea, found.slice(0, MAX_LISTED), found.length);
        if (alerted) result.alerts++;
      }
      // Only move the clock forward when the email went out (or none was needed),
      // so a failed email is tried again at the next run.
      if (!found.length || alerted) {
        await ideas.modify(idea.id, (i) => ({
          ...i,
          watch: {
            ...i.watch,
            lastCheckedAt: new Date(now).toISOString(),
            seen: [...i.watch.seen, ...found.map((v) => v.videoId)].slice(-200),
            found: (i.watch.found || 0) + found.length,
          },
        }));
      }
    } catch (error) {
      console.error(`Watch check for idea ${idea.id} failed: ${error.message}`);
      if (error.code === "quota") {
        result.skipped = "quota";
        break;
      }
    }
  }
  return result;
}

module.exports = { start, stop, tokenMatches, runDue, publicState, isActive, MAX_ACTIVE, MAX_PER_EMAIL, WATCH_DAYS };
