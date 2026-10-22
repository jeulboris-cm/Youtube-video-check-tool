const crypto = require("crypto");
const store = require("./store");

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
    errors[field] = integer ? "Enter a whole number of 0 or more." : "Enter a number of 0 or more.";
    return null;
  }
  return n;
}

// Checks the form answers and returns { errors, values }.
// errors is empty when the submission is valid.
function validate(input) {
  const errors = {};
  const text = (v) => (typeof v === "string" ? v.trim() : "");

  const idea = text(input.idea);
  const workingTitle = text(input.workingTitle);
  const channelUrl = text(input.channelUrl);

  if (!idea) errors.idea = "Describe the idea in one or two sentences.";
  else if (idea.length > 1000) errors.idea = "Keep the idea under 1,000 characters.";

  if (!workingTitle) errors.workingTitle = "Enter a working title.";
  else if (workingTitle.length > 200) errors.workingTitle = "Keep the title under 200 characters.";

  if (!channelUrl) errors.channelUrl = "Enter your YouTube channel link.";
  else if (!isYouTubeChannelUrl(channelUrl)) {
    errors.channelUrl = "Enter a YouTube channel link, like https://www.youtube.com/@yourchannel.";
  }

  const lengthMinutes = optionalNumber(input.lengthMinutes, "lengthMinutes", errors);
  const costUsd = optionalNumber(input.costUsd, "costUsd", errors);
  const productionDays = optionalNumber(input.productionDays, "productionDays", errors, { integer: true });

  const email = text(input.email) || null;
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    errors.email = "Enter a valid email address, or leave it empty.";
  }

  let newsTied = text(input.newsTied) || null;
  if (newsTied && !NEWS_TIED_OPTIONS.includes(newsTied)) {
    errors.newsTied = "Choose yes, no or not sure.";
    newsTied = null;
  }

  return {
    errors,
    values: { idea, workingTitle, channelUrl, lengthMinutes, costUsd, productionDays, newsTied, email },
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
  if (videoUrl && !videoId) errors.videoUrl = "Enter a YouTube video link, like https://www.youtube.com/watch?v=…";
  const values = { videoUrl: videoUrl || null, videoId };
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
  if (!useful) errors.useful = "Choose yes or no.";
  if (!decision) errors.decision = "Choose one answer.";
  if (comment.length > 2000) errors.comment = "Keep the comment under 2,000 characters.";
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

// Merges new fields into a saved idea, for example the YouTube results.
async function update(id, changes) {
  let updated = null;
  await store.update(KEY, [], (ideas) =>
    ideas.map((i) => {
      if (i.id !== id) return i;
      updated = { ...i, ...changes };
      return updated;
    }),
  );
  return updated;
}

module.exports = { validate, validateResults, validateFeedback, videoIdFromUrl, save, update, find, readAll };
