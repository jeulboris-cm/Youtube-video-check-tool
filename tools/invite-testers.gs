/**
 * Idea Check: invite testers from a Google Sheet, through your own Gmail.
 *
 * Paste this into the sheet (Extensions > Apps Script), fill in YOUR_NAME
 * and YOUR_CHANNEL below, save, and reload the sheet. A menu
 * "Idea Check invites" appears with two steps:
 *   1. Create drafts: one personal draft per contact in Gmail > Drafts.
 *      Nothing is sent. Check a few of them.
 *   2. Send the drafts: sends the drafts this script created, at most 60 a
 *      run (run it again the next day for the rest).
 * The "Idea Check invite" column records what happened to each row, so
 * running it again never emails anyone twice. Type "skip" in that column
 * for anyone who should not get the email.
 */

// ---- Fill these in ----
const YOUR_NAME = "";      // for example "Teka"
const YOUR_CHANNEL = "";   // your channel's link, for example "https://www.youtube.com/@yourchannel"

// ---- Settings ----
const SHEET_NAME = "Idea check (trial)";
const TOOL_URL = "https://idea-check.onrender.com";
// Rows whose Status is one of these are left out (they said no before).
// Use [] to include everyone.
const SKIP_STATUSES = ["Rejected"];
// Sending many emails at once from a personal Gmail can get it flagged as
// spam, so each run sends at most this many; run step 2 again the next day.
const MAX_PER_RUN = 60;

// Column names in the sheet's first row.
const COL = {
  channel: "Channels",
  email: "Email",
  name: "Names",
  status: "Status",
  language: "Language",        // optional: EN or FR (EN when empty)
  invite: "Idea Check invite", // added by this script
  draftId: "Idea Check draft", // added by this script (used to send the right draft)
};

const TEMPLATES = {
  EN: {
    subject: "Would you test a free tool I built for documentary creators?",
    greeting: (name, channel) => (name ? `Hi ${name},` : `Hi ${channel} team,`),
    body: (greeting) => `${greeting}

I wrote to you a little while ago, and I wanted to share something new: I've built a free tool called Idea Check, and I'd love your opinion on it.

You describe a video idea before you make it, and in about a minute it shows what similar videos really got, what your own recent videos get, how long the idea will stay relevant, who already owns the topic, and your cost per 1,000 views. Honest ranges, never promises.

I'm looking for 10 creators to test it first. It only takes one real idea and about 3 minutes: ${TOOL_URL}
Then answer the two short questions at the end of the report. Your idea stays private.

Would you give it a try? Your feedback would mean a lot.

Thanks,
${YOUR_NAME}
${YOUR_CHANNEL}`,
  },
  FR: {
    subject: "Vous voulez tester un outil gratuit pour les créateurs de documentaires ?",
    greeting: (name, channel) => (name ? `Bonjour ${name},` : `Bonjour à l'équipe de ${channel},`),
    body: (greeting) => `${greeting}

Je vous ai écrit il y a quelque temps, et je voulais vous partager quelque chose de nouveau : j'ai créé un outil gratuit, Idea Check, et votre avis m'intéresse beaucoup.

Vous décrivez une idée de vidéo avant de la faire, et en une minute environ l'outil montre ce qu'ont vraiment obtenu des vidéos similaires, ce que vos propres vidéos récentes obtiennent, combien de temps l'idée restera d'actualité, qui domine déjà le sujet, et votre coût pour 1 000 vues. Des fourchettes honnêtes, jamais de promesses.

Je cherche 10 créateurs pour le tester en premier. Il suffit d'une vraie idée et d'environ 3 minutes : ${TOOL_URL}
Répondez ensuite aux deux petites questions à la fin du rapport. Votre idée reste privée.

Vous voulez bien essayer ? Votre retour compterait beaucoup.

Merci,
${YOUR_NAME}
${YOUR_CHANNEL}`,
  },
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Idea Check invites")
    .addItem("1. Create drafts (sends nothing)", "createDrafts")
    .addItem("2. Send the drafts", "sendDrafts")
    .addToUi();
}

// "kamran" -> "Kamran", "Malte Greiner" -> "Malte".
function firstName(raw) {
  const first = String(raw || "").trim().split(/\s+/)[0] || "";
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : "";
}

// " ASHLEY DOCUMENTARY " -> "ASHLEY DOCUMENTARY" (kept as written, just trimmed).
function channelName(raw) {
  return String(raw || "").trim().replace(/\s+/g, " ");
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

// Finds each column by its header, adding the script's own columns if missing.
function columns(sheet) {
  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map((h) => String(h).trim());
  const index = {};
  for (const [key, title] of Object.entries(COL)) {
    let i = headers.indexOf(title);
    if (i === -1 && (key === "invite" || key === "draftId")) {
      headers.push(title);
      i = headers.length - 1;
      sheet.getRange(1, i + 1).setValue(title).setFontWeight("bold");
    }
    index[key] = i; // -1 when an optional column is absent
  }
  for (const key of ["channel", "email", "name", "status"]) {
    if (index[key] === -1) throw new Error(`Column "${COL[key]}" not found in row 1 of "${SHEET_NAME}".`);
  }
  return index;
}

// Builds the email for one row, or returns why the row is skipped.
function emailFor(row, c) {
  const email = String(row[c.email] || "").trim();
  const invite = String(row[c.invite] || "").trim().toLowerCase();
  if (!email) return { skip: "no email" };
  if (invite) return { skip: `already "${invite}"` };
  if (!isEmail(email)) return { skip: "email looks wrong" };
  if (SKIP_STATUSES.includes(String(row[c.status] || "").trim())) return { skip: "status" };
  const language = c.language >= 0 && String(row[c.language] || "").trim().toUpperCase() === "FR" ? "FR" : "EN";
  const template = TEMPLATES[language];
  const greeting = template.greeting(firstName(row[c.name]), channelName(row[c.channel]));
  return { email, subject: template.subject, body: template.body(greeting) };
}

function checkSettings() {
  if (!YOUR_NAME || !YOUR_CHANNEL) {
    throw new Error("Fill in YOUR_NAME and YOUR_CHANNEL at the top of the script first.");
  }
}

// Step 1: one Gmail draft per contact. Nothing is sent.
function createDrafts() {
  checkSettings();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const c = columns(sheet);
  const rows = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 0), sheet.getLastColumn()).getValues();
  let created = 0;
  let skipped = 0;
  rows.forEach((row, i) => {
    const mail = emailFor(row, c);
    if (mail.skip) {
      skipped += 1;
      return;
    }
    const draft = GmailApp.createDraft(mail.email, mail.subject, mail.body);
    sheet.getRange(i + 2, c.invite + 1).setValue("draft created");
    sheet.getRange(i + 2, c.draftId + 1).setValue(draft.getId());
    created += 1;
  });
  SpreadsheetApp.getUi().alert(
    `${created} drafts created in Gmail > Drafts. ${skipped} rows skipped (no email, already done, "skip", or status ${SKIP_STATUSES.join("/") || "none"}).\n\n` +
      "Open a few drafts to check them, then use step 2 to send.",
  );
}

// Step 2: sends the drafts created in step 1 (at most MAX_PER_RUN a run).
function sendDrafts() {
  checkSettings();
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const c = columns(sheet);
  const rows = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 0), sheet.getLastColumn()).getValues();
  const waiting = rows.map((row, i) => ({ row, i })).filter(({ row }) => String(row[c.invite]).trim() === "draft created");
  if (!waiting.length) {
    ui.alert("No drafts waiting. Run step 1 first.");
    return;
  }
  const batch = waiting.slice(0, MAX_PER_RUN);
  const answer = ui.alert(`Send ${batch.length} emails now? This cannot be undone.`, ui.ButtonSet.YES_NO);
  if (answer !== ui.Button.YES) return;

  let sent = 0;
  const problems = [];
  for (const { row, i } of batch) {
    try {
      GmailApp.getDraft(String(row[c.draftId])).send();
      sheet.getRange(i + 2, c.invite + 1).setValue(`sent ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd")}`);
      sent += 1;
    } catch (error) {
      // For example the draft was deleted or already sent from Gmail.
      sheet.getRange(i + 2, c.invite + 1).setValue("draft missing: check Gmail");
      problems.push(String(row[c.email]));
    }
  }
  const left = waiting.length - batch.length;
  ui.alert(
    `${sent} emails sent.` +
      (problems.length ? ` ${problems.length} drafts were missing (marked in the sheet).` : "") +
      (left ? ` ${left} drafts are still waiting: run step 2 again tomorrow.` : ""),
  );
}
