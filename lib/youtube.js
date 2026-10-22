const fs = require("fs");
const path = require("path");

// Talks to the YouTube Data API. Every call here costs quota units out of a
// free daily allowance of about 10,000, so this file keeps a running count
// per day and refuses to search once a safety cap is reached.
//   search.list   ~100 units (the expensive one, used twice per report)
//   videos.list     1 unit  (views and dates for up to 50 videos)
//   channels.list   1 unit  (subscriber counts for up to 50 channels)

const API = "https://www.googleapis.com/youtube/v3";
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const USAGE_FILE = path.join(DATA_DIR, "youtube-usage.json");
const CACHE_FILE = path.join(DATA_DIR, "youtube-cache.json");

const DAILY_CAP = Number(process.env.YOUTUBE_DAILY_UNIT_CAP) || 8000;
const SEARCH_COST = 100;
// 50 is the most a search returns, and costs the same 100 units as 25.
const SEARCH_RESULTS = 50;
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
  const cacheKey = `${SEARCH_RESULTS}:${query.toLowerCase()}`;
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

// Scores each video by its position in each search list, so a video near
// the top of both the idea search and the title search ranks highest.
// (Reciprocal rank fusion: 1 / (10 + position), added up across lists.)
function rankScores(lists) {
  const scores = new Map();
  for (const ids of lists) {
    ids.forEach((id, index) => scores.set(id, (scores.get(id) || 0) + 1 / (10 + index)));
  }
  return scores;
}

// "PT1H2M3S" -> 3723 seconds.
function durationSeconds(iso) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || "");
  if (!m) return null;
  const [, d = 0, h = 0, min = 0, sec = 0] = m.map((x) => Number(x || 0));
  return ((d * 24 + h) * 60 + min) * 60 + sec;
}

const STOP_WORDS = new Set(
  ("the a an and or but of to in on at for from by with about into over after before how why what who when " +
    "where which that this these those is are was were be been being it its it's their they them his her our " +
    "your you we can can't cant does doesn't do did not no yes even though still just most more very so than " +
    "then there here has have had one ever every all any some")
    .split(" "),
);

// Lowercase words without punctuation, with a simple plural "s" removed so
// "tanks" matches "tank".
function words(text) {
  return (text.toLowerCase().match(/[\p{L}\p{N}']+/gu) || [])
    .map((w) => w.replace(/'s$/, "").replace(/'/g, ""))
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .map((w) => (w.length > 4 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));
}

// How well a video's own words cover the key words of the idea and title,
// from 0 to 1. A key word in the video title counts double one that is only
// in the description or tags.
function textMatch(keywords, video) {
  const title = new Set(words(video.snippet.title));
  const rest = new Set(words(`${video.snippet.description || ""} ${(video.snippet.tags || []).join(" ")}`));
  let points = 0;
  let matched = 0;
  for (const k of keywords) {
    if (title.has(k)) points += 2;
    else if (rest.has(k)) points += 1;
    else continue;
    matched += 1;
  }
  return { score: points / (2 * keywords.length), matched };
}

// Shorts and short clips are a different format from the high-effort videos
// this tool is for, so they are left out of the comparison.
const MIN_SECONDS = 3 * 60;
// Views on very new videos have not settled yet, so they say little.
const MIN_AGE_DAYS = 14;

// Finds videos similar to the idea and returns every one that passes the
// filters, with views, age and channel size, most relevant first. Runs one search for the idea and one
// for the working title (about 100 units each), then ranks the combined
// list by search position and by how many of the idea's key words each
// video shares.
async function findSimilarVideos({ idea, workingTitle }) {
  const queries = [...new Set([idea, workingTitle].filter(Boolean))];
  const lists = [];
  for (const query of queries) lists.push(await searchVideos(query));
  const rank = rankScores(lists);
  const ids = [...rank.keys()];
  if (ids.length === 0) return [];

  // videos.list takes 50 ids per call (1 unit each).
  const details = [];
  for (let i = 0; i < ids.length; i += 50) {
    const body = await call("videos", { part: "snippet,statistics,contentDetails", id: ids.slice(i, i + 50).join(",") }, 1);
    details.push(...(body.items || []));
  }

  const keywords = [...new Set(words(`${idea} ${workingTitle}`))];
  const needed = Math.min(2, keywords.length);
  const maxRank = Math.max(...rank.values());
  const minPublished = Date.now() - MIN_AGE_DAYS * 86400000;

  const items = details
    .filter((v) => !(durationSeconds(v.contentDetails?.duration) < MIN_SECONDS))
    .filter((v) => Date.parse(v.snippet.publishedAt) < minPublished)
    .map((v) => {
      const match = textMatch(keywords, v);
      return { v, match, score: 0.6 * match.score + 0.4 * (rank.get(v.id) / maxRank) };
    })
    .filter(({ match }) => match.matched >= needed)
    .sort((a, b) => b.score - a.score)
    .map(({ v }) => v);
  if (items.length === 0) return [];

  // channels.list also takes 50 ids per call (1 unit each).
  const channelIds = [...new Set(items.map((v) => v.snippet.channelId))];
  const subscribers = new Map();
  for (let i = 0; i < channelIds.length; i += 50) {
    const body = await call("channels", { part: "statistics", id: channelIds.slice(i, i + 50).join(",") }, 1);
    for (const c of body.items || []) {
      subscribers.set(c.id, c.statistics.hiddenSubscriberCount ? null : Number(c.statistics.subscriberCount));
    }
  }

  return items.map((v) => ({
    videoId: v.id,
    url: `https://www.youtube.com/watch?v=${v.id}`,
    title: v.snippet.title,
    channelId: v.snippet.channelId,
    channelTitle: v.snippet.channelTitle,
    channelSubscribers: subscribers.get(v.snippet.channelId) ?? null,
    views: v.statistics.viewCount === undefined ? null : Number(v.statistics.viewCount),
    publishedAt: v.snippet.publishedAt,
    durationSeconds: durationSeconds(v.contentDetails?.duration),
    foundBy: queries.filter((_, i) => lists[i].includes(v.id)).map((q) => (q === idea ? "idea" : "title")),
  }));
}

module.exports = { lookupChannel, findSimilarVideos, unitsUsedToday, YouTubeError };
