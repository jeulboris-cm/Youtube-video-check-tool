const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Submissions are stored in a JSON file outside of git, so testers'
// unpublished ideas never end up in the repository.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const IDEAS_FILE = path.join(DATA_DIR, "ideas.json");

const NEWS_TIED_OPTIONS = ["yes", "no", "not_sure"];

function readAll() {
  if (!fs.existsSync(IDEAS_FILE)) return [];
  return JSON.parse(fs.readFileSync(IDEAS_FILE, "utf8"));
}

function writeAll(ideas) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  // Write to a temp file first so a crash mid-write cannot corrupt the data.
  const tmp = `${IDEAS_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(ideas, null, 2));
  fs.renameSync(tmp, IDEAS_FILE);
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

  let newsTied = text(input.newsTied) || null;
  if (newsTied && !NEWS_TIED_OPTIONS.includes(newsTied)) {
    errors.newsTied = "Choose yes, no or not sure.";
    newsTied = null;
  }

  return {
    errors,
    values: { idea, workingTitle, channelUrl, lengthMinutes, costUsd, productionDays, newsTied },
  };
}

function save(values) {
  const record = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...values,
    // Filled in from YouTube right after saving (see server.js).
    channelSubscribers: null,
  };
  const ideas = readAll();
  ideas.push(record);
  writeAll(ideas);
  return record;
}

// Merges new fields into a saved idea, for example the YouTube results.
function update(id, changes) {
  const ideas = readAll();
  const record = ideas.find((i) => i.id === id);
  if (!record) return null;
  Object.assign(record, changes);
  writeAll(ideas);
  return record;
}

module.exports = { validate, save, update, readAll };
