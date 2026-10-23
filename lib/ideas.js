const crypto = require("crypto");
const store = require("./store");
const i18n = require("./i18n");

// Submissions are stored outside of git (see lib/store.js), so testers'
// unpublished ideas never end up in the repository.
const KEY = "ideas";

const NEWS_TIED_OPTIONS = ["yes", "no", "not_sure"];

function readAll() {
  return store.get(KEY, []);
}

function isYouTubeChannelUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^(www\.|m\.)/, "");
    return ["http:", "https:"].includes(url.protocol) && host === "youtube.com" && url.pathname.length > 1;
  } catch {
    return false;
  }
}

function optionalNumber(value, field, errors, { integer = false } = {}) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || (integer && !Number.isInteger(n))) {
    errors[field] = integer ? "err.whole_number" : "err.number";
    return null;
  }
  return n;
}

// Checks the form answers and returns { errors, values }. errors is empty
// when the submission is valid; its messages are keys for lib/i18n.js.
function validate(input) {
  const errors = {};
  const text = (v) => (typeof v === "string" ? v.trim() : "");

  const idea = text(input.idea);
  const workingTitle = text(input.workingTitle);
  const channelUrl = text(input.channelUrl);

  if (!idea) errors.idea = "err.idea_required";
  else if (idea.length > 1000) errors.idea = "err.idea_long";

  if (!workingTitle) errors.workingTitle = "err.title_required";
  else if (workingTitle.length > 200) errors.workingTitle = "err.title_long";

  if (!channelUrl) errors.channelUrl = "err.channel_required";
  else if (!isYouTubeChannelUrl(channelUrl)) {
    errors.channelUrl = "err.channel_invalid";
  }

  const lengthMinutes = optionalNumber(input.lengthMinutes, "lengthMinutes", errors);
  const costUsd = optionalNumber(input.costUsd, "costUsd", errors);
  const productionDays = optionalNumber(input.productionDays, "productionDays", errors, { integer: true });

  const email = text(input.email) || null;
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    errors.email = "err.email_invalid";
  }

  let newsTied = text(input.newsTied) || null;
  if (newsTied && !NEWS_TIED_OPTIONS.includes(newsTied)) {
    errors.newsTied = "err.news_tied";
    newsTied = null;
  }

  return {
    errors,
    // The page's language: used for the YouTube search and the emails.
    values: { idea, workingTitle, channelUrl, lengthMinutes, costUsd, productionDays, newsTied, email, language: i18n.normalize(input.language) },
  };
}

// Pulls the video id out of a YouTube video link (watch, youtu.be, shorts
// or live links). Returns null when the link is not a video link.
function videoIdFromUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^(www\.|m\.)/, "");
    let id = null;
    if (host === "youtu.be") id = url.pathname.slice(1);
    else if (host === "youtube.com") {
      const parts = url.pathname.split("/").filter(Boolean);
      id = parts[0] === "watch" ? url.searchParams.get("v") : ["shorts", "live", "embed"].includes(parts[0]) ? parts[1] : null;
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

// Checks a result entry: the published video's link and the views at 7, 30
// and 90 days, all optional.
function validateResults(input) {
  const errors = {};
  const videoUrl = typeof input.videoUrl === "string" ? input.videoUrl.trim() : "";
  const videoId = videoUrl ? videoIdFromUrl(videoUrl) : null;
  if (videoUrl && !videoId) errors.videoUrl = "err.video_invalid";
  // "I decided not to make this video" (a checkbox sends "on").
  const notMade = input.notMade === true || input.notMade === "on";
  const values = { videoUrl: videoUrl || null, videoId, notMade };
  for (const field of ["views7", "views30", "views90"]) {
    values[field] = optionalNumber(input[field], field, errors, { integer: true });
  }
  return { errors, values };
}

const USEFUL_OPTIONS = ["yes", "no"];
const DECISION_OPTIONS = ["changed", "confirmed", "no_effect"];

// Checks the feedback answers: "Was this useful?" and "Would it have
// changed your decision?", plus an optional comment.
function validateFeedback(input) {
  const errors = {};
  const useful = USEFUL_OPTIONS.includes(input.useful) ? input.useful : null;
  const decision = DECISION_OPTIONS.includes(input.decision) ? input.decision : null;
  const comment = typeof input.comment === "string" ? input.comment.trim() : "";
  if (!useful) errors.useful = "err.useful";
  if (!decision) errors.decision = "err.decision";
  if (comment.length > 2000) errors.comment = "err.comment_long";
  return { errors, values: { useful, decision, comment: comment || null } };
}

async function save(values) {
  const record = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...values,
    // Filled in from YouTube when the report is built (see lib/report.js).
    channelSubscribers: null,
  };
  await store.update(KEY, [], (ideas) => [...ideas, record]);
  return record;
}

async function find(id) {
  return (await readAll()).find((i) => i.id === id) || null;
}

// Replaces a saved idea with change(idea), in one step, so changes made at
// the same moment (a tester saving results while the daily job reads views)
// cannot overwrite each other. Returns the new idea, or null if not found.
async function modify(id, change) {
  let updated = null;
  await store.update(KEY, [], (ideas) =>
    ideas.map((i) => {
      if (i.id !== id) return i;
      updated = change(i);
      return updated;
    }),
  );
  return updated;
}

// Merges new fields into a saved idea, for example the YouTube results.
function update(id, changes) {
  return modify(id, (idea) => ({ ...idea, ...changes }));
}

module.exports = { validate, validateResults, validateFeedback, videoIdFromUrl, save, update, modify, find, readAll };
