const fs = require("fs");
const path = require("path");

// Talks to the YouTube Data API. Every call here costs quota units out of a
// free daily allowance of about 10,000, so this file keeps a running count
// per day and refuses to search once a safety cap is reached.
//   search.list   ~100 units (the expensive one, used once per report)
//   videos.list     1 unit  (views and dates for up to 50 videos)
//   channels.list   1 unit  (subscriber counts for up to 50 channels)

const API = "https://www.googleapis.com/youtube/v3";
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const USAGE_FILE = path.join(DATA_DIR, "youtube-usage.json");
const CACHE_FILE = path.join(DATA_DIR, "youtube-cache.json");

const DAILY_CAP = Number(process.env.YOUTUBE_DAILY_UNIT_CAP) || 8000;
const SEARCH_COST = 100;
const SEARCH_RESULTS = 25;
const SHOWN_RESULTS = 12;
// Repeating the same search within this window reuses the saved result
// instead of spending another 100 units.
const CACHE_HOURS = 24;

class YouTubeError extends Error {}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

// YouTube resets the quota at midnight Pacific time.
function quotaDay() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

function unitsUsedToday() {
  const usage = readJson(USAGE_FILE, {});
  return usage[quotaDay()] || 0;
}

function recordUnits(units) {
  const usage = readJson(USAGE_FILE, {});
  const day = quotaDay();
  usage[day] = (usage[day] || 0) + units;
  writeJson(USAGE_FILE, usage);
}

async function call(endpoint, params, cost) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new YouTubeError("The YouTube API key is not set on the server.");

  const url = new URL(`${API}/${endpoint}`);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  url.searchParams.set("key", key);

  const response = await fetch(url);
  recordUnits(cost);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = body.error?.errors?.[0]?.reason;
    if (reason === "quotaExceeded") {
      throw new YouTubeError("YouTube's daily limit is used up. Try again tomorrow.");
    }
    // Never include the request URL in errors: it contains the key.
    throw new YouTubeError(`YouTube returned an error (${response.status}${reason ? `, ${reason}` : ""}).`);
  }
  return body;
}

// Works out which channel a link points to and returns its id and
// subscriber count. Costs 1 unit. Returns null when the link format cannot
// be looked up cheaply (old /c/ custom links).
async function lookupChannel(channelUrl) {
  const url = new URL(channelUrl);
  const parts = url.pathname.split("/").filter(Boolean);
  let params;
  if (parts[0]?.startsWith("@")) params = { forHandle: decodeURIComponent(parts[0]) };
  else if (parts[0] === "channel" && parts[1]) params = { id: parts[1] };
  else if (parts[0] === "user" && parts[1]) params = { forUsername: parts[1] };
  else return null;

  const body = await call("channels", { part: "snippet,statistics", ...params }, 1);
  const channel = body.items?.[0];
  if (!channel) return null;
  return {
    id: channel.id,
    title: channel.snippet.title,
    subscribers: channel.statistics.hiddenSubscriberCount ? null : Number(channel.statistics.subscriberCount),
  };
}

async function searchVideos(query) {
  const cache = readJson(CACHE_FILE, {});
  const cacheKey = query.toLowerCase();
  const cached = cache[cacheKey];
  if (cached && Date.now() - Date.parse(cached.at) < CACHE_HOURS * 3600 * 1000) {
    return cached.ids;
  }

  if (unitsUsedToday() + SEARCH_COST > DAILY_CAP) {
    throw new YouTubeError("The tool has reached its safety limit for YouTube searches today. Try again tomorrow.");
  }
  const body = await call(
    "search",
    { part: "id", type: "video", q: query, maxResults: SEARCH_RESULTS, order: "relevance", relevanceLanguage: "en" },
    SEARCH_COST,
  );
  const ids = (body.items || []).map((item) => item.id.videoId).filter(Boolean);
  cache[cacheKey] = { at: new Date().toISOString(), ids };
  writeJson(CACHE_FILE, cache);
  return ids;
}

// Finds videos similar to the idea and returns them with views, age and
// channel size, most relevant first.
async function findSimilarVideos(query) {
  const ids = await searchVideos(query);
  if (ids.length === 0) return [];

  const videos = await call("videos", { part: "snippet,statistics", id: ids.join(",") }, 1);
  const items = (videos.items || []).slice(0, SHOWN_RESULTS);

  const channelIds = [...new Set(items.map((v) => v.snippet.channelId))];
  const channels = await call("channels", { part: "statistics", id: channelIds.join(",") }, 1);
  const subscribers = new Map(
    (channels.items || []).map((c) => [
      c.id,
      c.statistics.hiddenSubscriberCount ? null : Number(c.statistics.subscriberCount),
    ]),
  );

  return items.map((v) => ({
    videoId: v.id,
    url: `https://www.youtube.com/watch?v=${v.id}`,
    title: v.snippet.title,
    channelId: v.snippet.channelId,
    channelTitle: v.snippet.channelTitle,
    channelSubscribers: subscribers.get(v.snippet.channelId) ?? null,
    views: v.statistics.viewCount === undefined ? null : Number(v.statistics.viewCount),
    publishedAt: v.snippet.publishedAt,
  }));
}

module.exports = { lookupChannel, findSimilarVideos, unitsUsedToday, YouTubeError };
