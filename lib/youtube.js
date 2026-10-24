const store = require("./store");

// Talks to the YouTube Data API. Every call here costs quota units out of a
// free daily allowance of about 10,000, so this file keeps a running count
// per day and refuses to search once a safety cap is reached.
//   search.list   ~100 units (the expensive one: 2 per report, 4 when the
//                 first page finds too few videos from channels your size)
//   videos.list     1 unit  (views and dates for up to 50 videos)
//   channels.list   1 unit  (subscriber counts for up to 50 channels)

const API = "https://www.googleapis.com/youtube/v3";
const USAGE_KEY = "youtube-usage";
const CACHE_KEY = "youtube-cache";

const DAILY_CAP = Number(process.env.YOUTUBE_DAILY_UNIT_CAP) || 8000;
const SEARCH_COST = 100;
// 50 is the most a search returns, and costs the same 100 units as 25.
const SEARCH_RESULTS = 50;
// Repeating the same search within this window reuses the saved result
// instead of spending another 100 units.
const CACHE_HOURS = 24;

// code is a short name for the problem, so pages can explain it in the
// tester's language.
class YouTubeError extends Error {
  constructor(message, code = "error") {
    super(message);
    this.code = code;
  }
}

// YouTube resets the quota at midnight Pacific time.
function quotaDay() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

async function unitsUsedToday() {
  const usage = await store.get(USAGE_KEY, {});
  return usage[quotaDay()] || 0;
}

function recordUnits(units) {
  const day = quotaDay();
  return store.update(USAGE_KEY, {}, (usage) => ({ ...usage, [day]: (usage[day] || 0) + units }));
}

async function call(endpoint, params, cost) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new YouTubeError("The YouTube API key is not set on the server.", "no_key");

  const url = new URL(`${API}/${endpoint}`);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  url.searchParams.set("key", key);

  const response = await fetch(url);
  await recordUnits(cost);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = body.error?.errors?.[0]?.reason;
    if (reason === "quotaExceeded") {
      throw new YouTubeError("YouTube's daily limit is used up. Try again tomorrow.", "quota");
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

  const body = await call("channels", { part: "snippet,statistics,contentDetails", ...params }, 1);
  const channel = body.items?.[0];
  if (!channel) return null;
  return {
    id: channel.id,
    title: channel.snippet.title,
    subscribers: channel.statistics.hiddenSubscriberCount ? null : Number(channel.statistics.subscriberCount),
    // The playlist of every upload, used for the channel's track record.
    uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads || null,
  };
}

// Runs one page of a search (about 100 units) and saves it, so the same
// page of the same search within CACHE_HOURS is free.
async function searchPage(query, page, lang = "en") {
  const cache = await store.get(CACHE_KEY, {});
  const cacheKey = `${SEARCH_RESULTS}:${lang}:p${page}:${query.toLowerCase()}`;
  const cached = cache[cacheKey];
  if (cached && Date.now() - Date.parse(cached.at) < CACHE_HOURS * 3600 * 1000) return cached;

  let pageToken;
  if (page > 1) {
    pageToken = (await searchPage(query, page - 1, lang)).nextPageToken;
    if (!pageToken) return { ids: [] };
  }
  if ((await unitsUsedToday()) + SEARCH_COST > DAILY_CAP) {
    throw new YouTubeError("The tool has reached its safety limit for YouTube searches today. Try again tomorrow.", "quota");
  }
  const params = { part: "id", type: "video", q: query, maxResults: SEARCH_RESULTS, order: "relevance", relevanceLanguage: lang };
  if (pageToken) params.pageToken = pageToken;
  const body = await call("search", params, SEARCH_COST);
  const result = {
    at: new Date().toISOString(),
    ids: (body.items || []).map((item) => item.id.videoId).filter(Boolean),
    nextPageToken: body.nextPageToken || null,
  };
  // Save it, and drop expired entries so the cache does not grow forever.
  const maxAge = CACHE_HOURS * 3600 * 1000;
  await store.update(CACHE_KEY, {}, (latest) => ({
    ...Object.fromEntries(Object.entries(latest).filter(([, entry]) => Date.now() - Date.parse(entry.at) < maxAge)),
    [cacheKey]: result,
  }));
  return result;
}

// The first `pages` pages of a search, as one list of video ids.
async function searchVideos(query, pages, lang) {
  const ids = [];
  for (let page = 1; page <= pages; page++) ids.push(...(await searchPage(query, page, lang)).ids);
  return [...new Set(ids)];
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
    "then there here has have had one ever every all any some " +
    // French
    "les des une un le la de du et ou mais donc car ni que qui quoi dont où comment pourquoi quand " +
    "est sont été être avoir ont fait faire pour par avec sans dans sur sous entre vers chez plus moins " +
    "très tout tous toute toutes son sa ses leur leurs notre nos votre vos ce cet cette ces il elle ils " +
    "elles nous vous on pas ne se comme aussi encore même déjà")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(" "),
);

// Lowercase words without punctuation or accents, with a simple plural "s"
// removed so "tanks" matches "tank", and French elisions (l', d', qu'…)
// split off.
// Accents removed, so "pétrole" matches "petrole" (common in titles).
const plain = (text) => text.normalize("NFD").replace(/\p{M}/gu, "");

function words(text) {
  return (plain(text).toLowerCase().replace(/’/g, "'").match(/[\p{L}\p{N}']+/gu) || [])
    // English "Africa's" -> "africa"; French "l'histoire", "d'Afrique" -> "histoire", "afrique".
    .map((w) => w.replace(/'s$/, "").replace(/^(?:l|d|qu|n|s|j|c|m|t)'/, "").replace(/'/g, ""))
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

// Below this many videos from the two searches, a key-word search is added.
const FEW_RESULTS = 30;

// Up to 6 key words of the idea, in their original spelling and order.
function searchKeywords(text) {
  const seen = new Set();
  const kept = [];
  for (const word of text.replace(/’/g, "'").match(/[\p{L}\p{N}']+/gu) || []) {
    const bare = word.replace(/^(?:l|d|qu|n|s|j|c|m|t)'/i, "").replace(/'s$/i, "");
    const key = plain(bare).toLowerCase();
    if (key.length > 2 && !STOP_WORDS.has(key) && !seen.has(key)) {
      seen.add(key);
      kept.push(bare);
    }
  }
  return kept.slice(0, 6).join(" ");
}

// Shorts and short clips are a different format from the high-effort videos
// this tool is for, so they are left out of the comparison.
const MIN_SECONDS = 3 * 60;
// Views on very new videos have not settled yet, so they say little.
const MIN_AGE_DAYS = 14;

// Finds videos similar to the idea and returns every one that passes the
// filters, with views, age and channel size, most relevant first. Searches
// for the idea and for the working title (about 100 units per page each;
// `pages` is 1 or 2), then ranks the combined list by search position and
// by how many of the idea's key words each video shares.
async function findSimilarVideos({ idea, workingTitle, language }, { pages = 1 } = {}) {
  const queries = [...new Set([idea, workingTitle].filter(Boolean))];
  const lists = [];
  // Search in the idea's language (YouTube favours videos in it).
  const lang = language === "fr" ? "fr" : "en";
  for (const query of queries) lists.push(await searchVideos(query, pages, lang));
  // Long sentences can match few titles (often in French): then also search
  // the idea's key words alone, for example "Nigeria carburant pétrole
  // Afrique" (100 more units, only when needed).
  if (new Set(lists.flat()).size < FEW_RESULTS) {
    const keywordQuery = searchKeywords(`${idea} ${workingTitle}`);
    if (keywordQuery && !queries.includes(keywordQuery)) {
      queries.push(keywordQuery);
      lists.push(await searchVideos(keywordQuery, pages, lang));
    }
  }
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
  const channelStats = new Map();
  for (let i = 0; i < channelIds.length; i += 50) {
    const body = await call("channels", { part: "statistics", id: channelIds.slice(i, i + 50).join(",") }, 1);
    for (const c of body.items || []) channelStats.set(c.id, statsOf(c));
  }

  return items.map((v) => ({
    ...toVideo(v, channelStats.get(v.snippet.channelId)?.subscribers ?? null, channelStats.get(v.snippet.channelId)?.avgViews ?? null),
    foundBy: queries.filter((_, i) => lists[i].includes(v.id)).map((q) => (q === idea ? "idea" : q === workingTitle ? "title" : "keywords")),
  }));
}

// The fields the report uses for one video from videos.list.
// A channel's subscriber count and its average views per video (all its
// views divided by its video count), from channels.list statistics. The
// average is null for channels with fewer than 5 videos, where it says
// little. It includes Shorts and the video itself, so it is a rough yardstick.
function statsOf(channel) {
  const stats = channel.statistics || {};
  const videos = Number(stats.videoCount);
  const views = Number(stats.viewCount);
  return {
    subscribers: stats.hiddenSubscriberCount ? null : Number(stats.subscriberCount),
    avgViews: videos >= 5 && Number.isFinite(views) ? Math.round(views / videos) : null,
  };
}

function toVideo(v, channelSubscribers, channelAvgViews = null) {
  return {
    videoId: v.id,
    url: `https://www.youtube.com/watch?v=${v.id}`,
    title: v.snippet.title,
    channelId: v.snippet.channelId,
    channelTitle: v.snippet.channelTitle,
    channelSubscribers,
    channelAvgViews,
    views: v.statistics.viewCount === undefined ? null : Number(v.statistics.viewCount),
    publishedAt: v.snippet.publishedAt,
    durationSeconds: durationSeconds(v.contentDetails?.duration),
  };
}

// The channel's own recent long videos (the same filters as similar
// videos: no Shorts, nothing under 2 weeks old), newest first. Costs 2
// units: one for the upload list, one for the videos' views.
async function channelRecentVideos(channel, max = 10) {
  if (!channel?.uploadsPlaylistId) return [];
  const list = await call("playlistItems", { part: "contentDetails", playlistId: channel.uploadsPlaylistId, maxResults: 50 }, 1);
  const ids = (list.items || []).map((item) => item.contentDetails.videoId).filter(Boolean);
  if (ids.length === 0) return [];
  const body = await call("videos", { part: "snippet,statistics,contentDetails", id: ids.join(",") }, 1);
  const minPublished = Date.now() - MIN_AGE_DAYS * 86400000;
  return (body.items || [])
    .filter((v) => !(durationSeconds(v.contentDetails?.duration) < MIN_SECONDS))
    .filter((v) => Date.parse(v.snippet.publishedAt) < minPublished)
    .sort((a, b) => Date.parse(b.snippet.publishedAt) - Date.parse(a.snippet.publishedAt))
    .slice(0, max)
    .map((v) => toVideo(v, channel.subscribers));
}

// "Related ideas with proven demand": the other videos of the strongest
// channels that also beat their own channel's average. For each channel the
// uploads playlist is read (1 unit; its id is the channel id with UC -> UU),
// then all their videos' views in batches of 50 (1 unit each): about 10 to
// 15 units for 8 channels. `channels` is [{ channelId, channelTitle,
// channelSubscribers, channelAvgViews }]; `isOutlier(video)` decides what
// counts; ids in `excludeIds` (already shown) are left out.
async function relatedOutlierVideos(channels, { excludeIds = new Set(), isOutlier, perChannel = 20 } = {}) {
  const ids = [];
  const owners = new Map();
  for (const channel of channels) {
    if (!channel.channelId?.startsWith("UC")) continue;
    let items = [];
    try {
      const list = await call("playlistItems", { part: "contentDetails", playlistId: `UU${channel.channelId.slice(2)}`, maxResults: perChannel }, 1);
      items = list.items || [];
    } catch (error) {
      // A channel without a public uploads list is skipped; running out of
      // quota stops the whole lookup.
      if (error.code === "quota") throw error;
      continue;
    }
    for (const item of items) {
      const id = item.contentDetails?.videoId;
      if (id && !excludeIds.has(id)) {
        ids.push(id);
        owners.set(id, channel);
      }
    }
  }
  const found = [];
  const minPublished = Date.now() - MIN_AGE_DAYS * 86400000;
  for (let i = 0; i < ids.length; i += 50) {
    const body = await call("videos", { part: "snippet,statistics,contentDetails", id: ids.slice(i, i + 50).join(",") }, 1);
    for (const v of body.items || []) {
      if (durationSeconds(v.contentDetails?.duration) < MIN_SECONDS) continue;
      if (Date.parse(v.snippet.publishedAt) >= minPublished) continue;
      const owner = owners.get(v.id);
      const video = toVideo(v, owner.channelSubscribers, owner.channelAvgViews);
      if (isOutlier(video)) found.push(video);
    }
  }
  return found;
}

// Current views and publish date of one video (1 unit), for result entries.
async function videoStats(videoId) {
  const body = await call("videos", { part: "snippet,statistics", id: videoId }, 1);
  const video = body.items?.[0];
  if (!video) return null;
  return {
    videoId,
    title: video.snippet.title,
    channelId: video.snippet.channelId,
    publishedAt: video.snippet.publishedAt,
    views: video.statistics.viewCount === undefined ? null : Number(video.statistics.viewCount),
    readAt: new Date().toISOString(),
  };
}

// Current views of many videos at once: 1 unit per 50 videos. Returns a
// Map of video id to views; videos that are gone or private are left out.
async function videoViews(videoIds) {
  const views = new Map();
  for (let i = 0; i < videoIds.length; i += 50) {
    const body = await call("videos", { part: "statistics", id: videoIds.slice(i, i + 50).join(",") }, 1);
    for (const video of body.items || []) {
      if (video.statistics.viewCount !== undefined) views.set(video.id, Number(video.statistics.viewCount));
    }
  }
  return views;
}

module.exports = {
  words,
  lookupChannel,
  findSimilarVideos,
  relatedOutlierVideos,
  channelRecentVideos,
  videoStats,
  videoViews,
  unitsUsedToday,
  YouTubeError,
};
