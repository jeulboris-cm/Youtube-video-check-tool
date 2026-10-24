const compare = require("./compare");
const youtube = require("./youtube");

// What the niche tells the tester beyond raw views: which title formats
// appear among similar videos (and how they did), whether the idea fits the
// tester's own channel, and which videos make a "related ideas" shortlist.

// ---- Title formats (English and French) ----
// Each format is a recognisable way of framing a title. Detecting it says
// nothing about the tester's own title: it counts how often the format shows
// up among the similar videos and how those videos did against their own
// channel's average, hits and misses alike.
const FORMATS = [
  { id: "how_to", test: /^(how to|how can|comment (faire|savoir|devenir|gagner|réussir|reussir))\b/i },
  { id: "why", test: /^(why|pourquoi)\b/i },
  { id: "how_story", test: /^(how|comment)\b.{3,}\b(became|built|made|got|went|turned|rose|fell|lost|won|conquered|dominates?|a (construit|fait|perdu|gagné|conquis|dominé)|est devenu|sont devenus|est devenue|a réussi)/i },
  { id: "number_list", test: /(^|\s)(top\s)?\d{1,3}\s(things|ways|reasons|secrets|lessons|facts|mistakes|rules|steps|choses|façons|manières|raisons|secrets|leçons|faits|erreurs|règles|étapes)\b/i },
  { id: "rise_fall", test: /\b(rise and fall|the rise of|the fall of|rise & fall|ascension|la chute|l['’]ascension|grandeur et décadence)\b/i },
  { id: "untold_truth", test: /\b(untold|the truth|real story|true story|dark side|hidden|dirty secret|la vérité|histoire vraie|l['’]histoire cachée|côté obscur|jamais racont)/i },
  { id: "most_biggest", test: /^(the )?(most|biggest|worst|richest|largest|greatest|le plus|la plus|les plus|le pire|la pire)\b/i },
  { id: "i_did", test: /^(i|we|j['’]ai|nous avons)\s/i },
  { id: "versus", test: /(\bvs\.?\b|\bversus\b|\bcontre\b)/i },
  { id: "new_era", test: /\b(new rules|new era|the future of|everything (is )?changing|nouvelles règles|nouvelle ère|le futur de|l['’]avenir de|tout change)\b/i },
  { id: "cheating", test: /\b(feels like cheating|so fast|in \d+ (minutes|days|hours)|comme (de )?la triche|en \d+ (minutes|jours|heures))\b/i },
  { id: "question", test: /\?\s*$/ },
];

const MIN_FORMAT_VIDEOS = 3;

// Formats used by at least 3 of the similar videos, most often a hit first.
function formatEvidence(videos) {
  const known = videos.map((v) => ({ v, ...compare.outlierInfo(v) })).filter((x) => x.outlierRatio !== null);
  const rows = [];
  for (const format of FORMATS) {
    const used = known.filter((x) => format.test.test(x.v.title.trim()));
    if (used.length < MIN_FORMAT_VIDEOS) continue;
    const outliers = used.filter((x) => x.outlier);
    const best = [...used].sort((a, b) => b.outlierRatio - a.outlierRatio)[0];
    rows.push({
      id: format.id,
      count: used.length,
      outliers: outliers.length,
      under: used.filter((x) => x.outlierRatio < 0.5).length,
      example: { title: best.v.title, url: best.v.url, outlierRatio: best.outlierRatio, views: best.v.views, channelTitle: best.v.channelTitle },
    });
  }
  rows.sort((a, b) => b.outliers / b.count - a.outliers / a.count || b.count - a.count);
  return { status: known.length >= 5 ? "ok" : "thin", videoCount: known.length, formats: rows.slice(0, 5), minimum: MIN_FORMAT_VIDEOS };
}

// ---- Does the idea fit the tester's channel? ----
// A rough check from words in titles only: how many of the tester's recent
// videos share a key word with the idea and title. (Claude, when connected,
// judges this better and its answer replaces this one.)
function fitCheck(idea, ownVideos) {
  if (!ownVideos || ownVideos.length < 3) return null;
  const keywords = new Set(youtube.words(`${idea.idea} ${idea.workingTitle}`));
  if (keywords.size === 0) return null;
  const matches = ownVideos.filter((v) => youtube.words(v.title).some((w) => keywords.has(w))).length;
  const share = matches / ownVideos.length;
  return {
    source: "keywords",
    level: share >= 0.5 ? "close" : share >= 0.2 ? "partial" : "far",
    matches,
    total: ownVideos.length,
  };
}

// ---- Related ideas with proven demand ----
// The strongest outlier channels among the similar videos, best first (up to
// 8, one entry per channel), whose other videos are then read.
function topOutlierChannels(videos, max = 8) {
  const best = new Map();
  for (const v of videos) {
    const info = compare.outlierInfo(v);
    if (!info.outlier) continue;
    const current = best.get(v.channelId);
    if (!current || info.outlierRatio > current.ratio) {
      best.set(v.channelId, { ratio: info.outlierRatio, channelId: v.channelId, channelTitle: v.channelTitle, channelSubscribers: v.channelSubscribers, channelAvgViews: v.channelAvgViews });
    }
  }
  return [...best.values()].sort((a, b) => b.ratio - a.ratio).slice(0, max);
}

// Roughly what the lookup costs in YouTube quota units, to check the daily
// allowance first: one playlist read per channel plus the videos' views.
const relatedCost = (channelCount) => channelCount + Math.ceil((channelCount * 20) / 50);

// Reads the related videos. Returns the best 12 (by how far they beat their
// own channel's average), none of them already among the similar videos.
async function relatedVideos(similarVideos) {
  const channels = topOutlierChannels(similarVideos);
  if (channels.length < 2) return [];
  if ((await youtube.unitsUsedToday()) + relatedCost(channels.length) + 200 > Number(process.env.YOUTUBE_DAILY_UNIT_CAP || 8000)) return [];
  const found = await youtube.relatedOutlierVideos(channels, {
    excludeIds: new Set(similarVideos.map((v) => v.videoId)),
    isOutlier: compare.isOutlier,
  });
  return found
    .map((v) => ({ ...v, ...compare.outlierInfo(v) }))
    .sort((a, b) => b.outlierRatio - a.outlierRatio)
    .slice(0, 12);
}

module.exports = { FORMATS, formatEvidence, fitCheck, topOutlierChannels, relatedVideos, relatedCost };
