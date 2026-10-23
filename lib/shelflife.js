// Free, rule-based shelf-life check, following the signal table in the spec.
// Used when Claude is not connected. Each signal points to short, long or
// unclear, and the label comes from adding them up.

const DAY = 86400000;

// Each signal also carries a code and params, so the report page can show
// it in the tester's language; detail stays as plain English for Claude.

// Words that tie an idea to a moment in the news, in English and French.
// (?<!\p{L}) and (?!\p{L}) are word edges that also work for accents.
const NEWS_WORDS = new RegExp(
  "(?<!\\p{L})(" +
    [
      "breaking news", "breaking:", "just (?:announced|happened|released|launched|revealed|leaked)", "latest",
      "announced?", "announces", "this (?:week|month|year)", "today", "yesterday", "right now",
      "new (?:report|study|law|bill|deal|policy|data)", "leaked", "update",
      "derni[eè]re minute", "vient d['’]annoncer", "vient de (?:sortir|tomber|lancer|r[ée]v[ée]ler)", "annonc[ée]e?s?",
      "cette (?:semaine|ann[ée]e)", "ce mois", "aujourd['’]hui", "hier", "en ce moment",
      "nouveau rapport", "nouvelle (?:loi|[ée]tude|r[ée]forme)", "fuit[ée]e?s?", "actualit[ée]",
    ].join("|") +
    ")(?!\\p{L})",
  "iu",
);
// Words that point to how or why something works, which keeps being searched.
const MECHANISM_WORDS = new RegExp(
  "(?<!\\p{L})(" +
    [
      "how", "why", "explained", "history of", "the rise", "the fall", "system", "works?", "inside", "behind", "secret of",
      "comment", "pourquoi", "expliqu[ée]e?s?", "l['’]histoire", "histoire d[eu']", "l['’]ascension", "la chute",
      "syst[èe]me", "fonctionne", "à l['’]int[ée]rieur", "derri[èe]re", "secret",
    ].join("|") +
    ")(?!\\p{L})",
  "iu",
);

function wordingSignal({ idea, workingTitle }) {
  const text = `${idea} ${workingTitle}`;
  const year = new Date().getFullYear();
  const news = text.match(NEWS_WORDS)?.[0] || text.match(new RegExp(`\\b(${year}|${year - 1})\\b`))?.[0];
  const mechanism = text.match(MECHANISM_WORDS)?.[0];
  if (news && !mechanism) {
    return { signal: "wording", pointsTo: "short", code: "wording_news", params: { word: news }, detail: `The wording ("${news}") ties the idea to a recent moment.` };
  }
  if (mechanism && !news) {
    return { signal: "wording", pointsTo: "long", code: "wording_mechanism", params: { word: mechanism }, detail: `The wording ("${mechanism}") frames it around how or why something happens.` };
  }
  if (news && mechanism) {
    return {
      signal: "wording",
      pointsTo: "unclear",
      code: "wording_mixed",
      params: { news, mechanism },
      detail: `The wording mixes a news hook ("${news}") with a how/why framing ("${mechanism}").`,
    };
  }
  return { signal: "wording", pointsTo: "unclear", code: "wording_none", params: {}, detail: "The wording has no clear news or how/why markers." };
}

// Older similar videos: do videos older than a year still hold real views,
// or do videos older than six months have almost none?
function olderCompetitorsSignal(videos, now = Date.now()) {
  const withData = videos.filter((v) => v.views !== null);
  const age = (v) => (now - Date.parse(v.publishedAt)) / DAY;
  const overYear = withData.filter((v) => age(v) > 365);
  const overHalfYear = withData.filter((v) => age(v) > 182);
  // "Strong" means at least 1,000 views and at least a fifth of the channel's
  // subscribers; "almost none" means under 100 views or under 1% of them.
  const strong = overYear.filter((v) => v.views >= Math.max(1000, 0.2 * (v.channelSubscribers || 0)));
  const weak = overHalfYear.filter((v) => v.views < Math.max(100, 0.01 * (v.channelSubscribers || 0)));

  if (overYear.length >= 3 && strong.length / overYear.length >= 0.4) {
    return {
      signal: "older_competitors",
      pointsTo: "long",
      code: "older_strong",
      params: { count: strong.length, total: overYear.length },
      detail: `${strong.length} of ${overYear.length} similar videos older than a year have strong view counts, so people keep watching this topic.`,
    };
  }
  if (overHalfYear.length >= 3 && weak.length / overHalfYear.length >= 0.6) {
    return {
      signal: "older_competitors",
      pointsTo: "short",
      code: "older_weak",
      params: { count: weak.length, total: overHalfYear.length },
      detail: `${weak.length} of ${overHalfYear.length} similar videos older than six months have almost no views.`,
    };
  }
  if (withData.length >= 5 && overHalfYear.length / withData.length <= 0.25) {
    return {
      signal: "older_competitors",
      pointsTo: "short",
      code: "older_recent",
      params: {},
      detail: `Most similar videos are less than six months old, so the topic looks recent.`,
    };
  }
  return {
    signal: "older_competitors",
    pointsTo: "unclear",
    code: "older_unclear",
    params: {},
    detail: "Older similar videos give no clear picture either way.",
  };
}

function testerAnswerSignal({ newsTied }) {
  if (newsTied === "yes") return { signal: "tester_answer", pointsTo: "short", code: "tester_yes", params: {}, detail: "You said the idea is tied to a recent news event." };
  if (newsTied === "no") return { signal: "tester_answer", pointsTo: "long", code: "tester_no", params: {}, detail: "You said the idea is not tied to a news event." };
  return { signal: "tester_answer", pointsTo: "unclear", code: "tester_none", params: {}, detail: "You did not say whether the idea is tied to news." };
}

const POINTS = { short: -1, long: 1, unclear: 0 };

// Returns { label, reason, signals, source } in the same shape Claude uses.
function assessShelfLife(idea, similarVideos) {
  const signals = [wordingSignal(idea), olderCompetitorsSignal(similarVideos), testerAnswerSignal(idea)];
  const total = signals.reduce((sum, s) => sum + POINTS[s.pointsTo], 0);
  const label = total >= 2 ? "long" : total <= -2 ? "short" : "medium";

  const toLong = signals.filter((s) => s.pointsTo === "long").length;
  const toShort = signals.filter((s) => s.pointsTo === "short").length;
  let reason;
  let reasonCode;
  if (toLong === 0 && toShort === 0) {
    reasonCode = "reason_none";
    reason = "None of the signals is clear, so this is a cautious middle guess.";
  } else if (toShort === 0) {
    reasonCode = "reason_long";
    reason = `${toLong} of 3 signals point to a long shelf life and none to a short one.`;
  } else if (toLong === 0) {
    reasonCode = "reason_short";
    reason = `${toShort} of 3 signals point to a short shelf life and none to a long one.`;
  } else {
    reasonCode = "reason_mixed";
    reason = `The signals disagree: ${toLong} point to long and ${toShort} to short.`;
  }

  return { label, reason, reasonCode, reasonParams: { toLong, toShort }, signals, source: "rules" };
}

module.exports = { assessShelfLife, wordingSignal, olderCompetitorsSignal, testerAnswerSignal };
