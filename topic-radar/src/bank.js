const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// The idea bank: every idea the agent has suggested, kept from week to week
// in idea-bank.json. You can change an idea's "status" yourself (by editing
// the file, also possible on github.com):
//   new          suggested, not looked at yet
//   shortlisted  you like it
//   made         you made the video (the agent stops suggesting it)
//   dismissed    not for you (the agent stops suggesting it)
// The agent never changes a status you set, and it counts how many weeks a
// story keeps coming back, which is a sign it has staying power.

const ROOT = path.join(__dirname, "..");
const BANK_FILE = path.join(ROOT, "idea-bank.json");
const BANK_MD = path.join(ROOT, "IDEA-BANK.md");
const STATUSES = ["new", "shortlisted", "made", "dismissed"];

function load() {
  try {
    const bank = JSON.parse(fs.readFileSync(BANK_FILE, "utf8"));
    return Array.isArray(bank.ideas) ? bank : { ideas: [] };
  } catch (error) {
    if (error.code === "ENOENT") return { ideas: [] };
    throw new Error(`idea-bank.json could not be read (${error.message}). Fix or delete it.`);
  }
}

// What the agent sees of the bank: enough to spot repeats and respect your
// choices, without the full write-ups.
function summary(bank) {
  return bank.ideas.map((i) => ({
    bankId: i.id,
    title: i.title,
    beat: i.beat,
    status: i.status,
    weeksSeen: i.weeksSeen,
    lastSeen: i.lastSeen,
    lastVerdict: i.verdict,
  }));
}

function newId(title) {
  const slug = title.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return `${slug}-${crypto.randomBytes(2).toString("hex")}`;
}

// Adds this week's ideas: a story the agent matched to an earlier idea
// updates that entry (keeping your status); anything else is a new entry.
function merge(bank, ideas, week) {
  const byId = new Map(bank.ideas.map((i) => [i.id, i]));
  const touched = new Set();
  for (const idea of ideas) {
    const existing = idea.bankId && byId.get(idea.bankId);
    if (existing && !touched.has(existing.id)) {
      touched.add(existing.id);
      Object.assign(existing, {
        title: idea.title,
        beat: idea.beat,
        verdict: idea.verdict,
        lastSeen: week,
        weeksSeen: existing.lastSeen === week ? existing.weeksSeen : existing.weeksSeen + 1,
        latest: idea,
      });
      existing.history = [...(existing.history || []).filter((h) => h.week !== week), { week, verdict: idea.verdict }].slice(-26);
      idea.bankId = existing.id;
      idea.weeksSeen = existing.weeksSeen;
    } else {
      const entry = { id: newId(idea.title), title: idea.title, beat: idea.beat, status: "new", verdict: idea.verdict, firstSeen: week, lastSeen: week, weeksSeen: 1, history: [{ week, verdict: idea.verdict }], latest: idea };
      bank.ideas.push(entry);
      byId.set(entry.id, entry);
      touched.add(entry.id);
      idea.bankId = entry.id;
      idea.weeksSeen = 1;
    }
  }
  for (const i of bank.ideas) if (!STATUSES.includes(i.status)) i.status = "new";
  bank.updatedAt = week;
  return bank;
}

const VERDICT_ORDER = { strong: 0, promising: 1, risky: 2 };
const cell = (text) => String(text ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

function renderMarkdown(bank) {
  const groups = [
    ["shortlisted", "Shortlisted by you"],
    ["new", "New and not reviewed"],
    ["made", "Made"],
    ["dismissed", "Dismissed"],
  ];
  const lines = [
    "# Idea bank",
    "",
    `Updated ${bank.updatedAt || "never"} by Topic Radar. To shortlist, mark as made or dismiss an idea, change its \`status\` in [idea-bank.json](idea-bank.json).`,
    "",
  ];
  for (const [status, heading] of groups) {
    const ideas = bank.ideas
      .filter((i) => i.status === status)
      .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen) || (VERDICT_ORDER[a.verdict] ?? 9) - (VERDICT_ORDER[b.verdict] ?? 9));
    if (!ideas.length) continue;
    lines.push(`## ${heading} (${ideas.length})`, "", "| Idea | Beat | Verdict | Weeks seen | Last seen | Shelf life | id |", "|---|---|---|---|---|---|---|");
    for (const i of ideas) {
      lines.push(`| ${cell(i.title)} | ${cell(i.beat)} | ${cell(i.verdict)} | ${i.weeksSeen} | ${i.lastSeen} | ${cell(i.latest?.shelfLife)} | \`${i.id}\` |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function save(bank) {
  fs.writeFileSync(BANK_FILE, `${JSON.stringify(bank, null, 2)}\n`);
  fs.writeFileSync(BANK_MD, renderMarkdown(bank));
}

module.exports = { load, save, merge, summary, renderMarkdown, STATUSES };
