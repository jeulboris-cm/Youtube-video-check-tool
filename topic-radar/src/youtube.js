// What YouTube says about a subject: which recent videos beat their own
// channel's usual views (demand), and how much has already been made on it
// (saturation). Uses the YouTube Data API, whose free allowance is about
// 10,000 units a day. A search costs 100 units; reading video and channel
// details costs 1 unit per 50. Each run has its own unit budget.

const API = "https://www.googleapis.com/youtube/v3";
const DAY = 86400000;
// Shorts and clips are a different format from long documentaries.
const MIN_SECONDS = 4 * 60;
// A video with at least this many times its channel's average views, and at
// least 5,000 views, counts as an outlier: people chose the subject itself.
const OUTLIER_RATIO = 3;
const OUTLIER_MIN_VIEWS = 5000;

class YouTubeError extends Error {}

function createYouTube({ apiKey = process.env.YOUTUBE_API_KEY, budget = Number(process.env.RADAR_YOUTUBE_UNITS) || 2500 } = {}) {
  let used = 0;

  async function call(endpoint, params, cost) {
    if (!apiKey) throw new YouTubeError("No YouTube API key is set (YOUTUBE_API_KEY), so YouTube data is not available this run.");
    if (used + cost > budget) throw new YouTubeError(`This run's YouTube budget is used up (${used} of ${budget} units). Work with what you have.`);
    const url = new URL(`${API}/${endpoint}`);
    for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
    url.searchParams.set("key", apiKey);
    const response = await fetch(url);
    used += cost;
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const reason = body.error?.errors?.[0]?.reason;
      // Never put the URL in an error: it contains the key.
      throw new YouTubeError(reason === "quotaExceeded" ? "YouTube's daily quota is used up." : `YouTube returned an error (${response.status}${reason ? `, ${reason}` : ""}).`);
    }
    return body;
  }

  // "PT1H2M3S" -> 3723
  function seconds(iso) {
    const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || "");
    if (!m) return null;
    const [, d = 0, h = 0, min = 0, s = 0] = m.map((x) => Number(x || 0));
    return ((d * 24 + h) * 60 + min) * 60 + s;
  }

  // Search, then read the videos and their channels. Returns long videos with
  // views, age, channel size and how they did against the channel's average.
  async function searchWithDetails(params) {
    const found = await call("search", { part: "id", type: "video", maxResults: 50, ...params }, 100);
    const ids = (found.items || []).map((i) => i.id.videoId).filter(Boolean);
    if (!ids.length) return [];
    const details = await call("videos", { part: "snippet,statistics,contentDetails", id: ids.join(",") }, 1);
    const videos = (details.items || []).filter((v) => !(seconds(v.contentDetails?.duration) < MIN_SECONDS));
    const channelIds = [...new Set(videos.map((v) => v.snippet.channelId))];
    const channels = new Map();
    for (let i = 0; i < channelIds.length; i += 50) {
      const body = await call("channels", { part: "statistics", id: channelIds.slice(i, i + 50).join(",") }, 1);
      for (const c of body.items || []) {
        const s = c.statistics || {};
        const count = Number(s.videoCount);
        channels.set(c.id, {
          subscribers: s.hiddenSubscriberCount ? null : Number(s.subscriberCount),
          // All views over all videos: a rough yardstick (it includes Shorts).
          avgViews: count >= 5 ? Math.round(Number(s.viewCount) / count) : null,
        });
      }
    }
    const now = Date.now();
    return videos.map((v) => {
      const channel = channels.get(v.snippet.channelId) || {};
      const views = v.statistics.viewCount === undefined ? null : Number(v.statistics.viewCount);
      const ratio = views != null && channel.avgViews ? Math.round((views / channel.avgViews) * 10) / 10 : null;
      return {
        title: v.snippet.title,
        channel: v.snippet.channelTitle,
        channelSubscribers: channel.subscribers ?? null,
        views,
        ageDays: Math.floor((now - Date.parse(v.snippet.publishedAt)) / DAY),
        minutes: Math.round((seconds(v.contentDetails?.duration) || 0) / 60),
        timesChannelAverage: ratio,
        outlier: ratio != null && ratio >= OUTLIER_RATIO && views >= OUTLIER_MIN_VIEWS,
        url: `https://www.youtube.com/watch?v=${v.id}`,
      };
    });
  }

  const median = (list) => {
    const s = list.filter((x) => x != null).sort((a, b) => a - b);
    return s.length ? s[Math.floor((s.length - 1) / 2)] : null;
  };

  // Demand: the most-watched long videos on a subject from the last `days`
  // days, and which of them beat their channel's usual. About 102 units.
  async function recentHits(query, { days = 30, language = "en" } = {}) {
    const since = new Date(Date.now() - days * DAY).toISOString();
    const videos = await searchWithDetails({ q: query, order: "viewCount", publishedAfter: since, relevanceLanguage: language });
    const top = videos.sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 15);
    return {
      query,
      days,
      longVideosFound: videos.length,
      outliers: videos.filter((v) => v.outlier).length,
      videos: top,
      unitsLeft: budget - used,
    };
  }

  // Saturation: everything YouTube ranks as most relevant for a story, of any
  // age. How many exist, how many came out recently, how they did, and
  // whether big channels already own it. About 102 units.
  async function coverage(query, { language = "en" } = {}) {
    const videos = await searchWithDetails({ q: query, order: "relevance", relevanceLanguage: language });
    const within = (d) => videos.filter((v) => v.ageDays <= d).length;
    const totalViews = videos.reduce((sum, v) => sum + (v.views || 0), 0);
    const bigViews = videos.filter((v) => v.channelSubscribers >= 1_000_000).reduce((sum, v) => sum + (v.views || 0), 0);
    return {
      query,
      note: "Search returns the 50 most relevant videos, not all of them; long videos only.",
      longVideosFound: videos.length,
      publishedLast14Days: within(14),
      publishedLast90Days: within(90),
      medianViews: median(videos.map((v) => v.views)),
      medianTimesChannelAverage: median(videos.map((v) => v.timesChannelAverage)),
      outliers: videos.filter((v) => v.outlier).length,
      shareOfViewsOnChannelsOver1M: totalViews ? Math.round((bigViews / totalViews) * 100) / 100 : null,
      topVideos: [...videos].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 6),
      newestVideos: [...videos].sort((a, b) => a.ageDays - b.ageDays).slice(0, 4),
      unitsLeft: budget - used,
    };
  }

  // The creator's own recent long videos, so the agent knows what the
  // audience already watches. Accepts a link like youtube.com/@name. 3 units.
  async function channelRecent(channelUrl) {
    const parts = new URL(channelUrl).pathname.split("/").filter(Boolean);
    const params = parts[0]?.startsWith("@") ? { forHandle: decodeURIComponent(parts[0]) } : parts[0] === "channel" ? { id: parts[1] } : null;
    if (!params) return null;
    const ch = (await call("channels", { part: "snippet,statistics,contentDetails", ...params }, 1)).items?.[0];
    const uploads = ch?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploads) return null;
    const list = await call("playlistItems", { part: "contentDetails", playlistId: uploads, maxResults: 30 }, 1);
    const ids = (list.items || []).map((i) => i.contentDetails.videoId);
    const body = ids.length ? await call("videos", { part: "snippet,statistics,contentDetails", id: ids.join(",") }, 1) : { items: [] };
    const now = Date.now();
    return {
      title: ch.snippet.title,
      subscribers: ch.statistics.hiddenSubscriberCount ? null : Number(ch.statistics.subscriberCount),
      recentVideos: (body.items || [])
        .filter((v) => !(seconds(v.contentDetails?.duration) < MIN_SECONDS))
        .slice(0, 15)
        .map((v) => ({ title: v.snippet.title, views: Number(v.statistics.viewCount || 0), ageDays: Math.floor((now - Date.parse(v.snippet.publishedAt)) / DAY) })),
    };
  }

  return { recentHits, coverage, channelRecent, available: Boolean(apiKey), unitsUsed: () => used, budget };
}

module.exports = { createYouTube, YouTubeError };
