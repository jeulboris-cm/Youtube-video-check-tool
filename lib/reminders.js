const nodemailer = require("nodemailer");
const ideas = require("./ideas");
const i18n = require("./i18n");

// Emails to testers who left an address: the link to their report right
// after the check, and 30 days later one reminder asking for their real
// views. Email is sent through any SMTP service (Brevo,
// Resend, Gmail with an app password, …) set in these variables:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM
// PUBLIC_URL is the site's address, used for the link in the email (on
// Render it is filled in automatically).
// Without them, nothing is sent and the report page asks testers to come
// back on their own.

const REMINDER_DAYS = 30;
const CHECK_EVERY_MS = 60 * 60 * 1000;

// Render sets RENDER_EXTERNAL_URL itself, so PUBLIC_URL is optional there.
function publicUrl() {
  return process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || "";
}

function isConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.EMAIL_FROM && publicUrl());
}

function dueAt(idea) {
  return new Date(Date.parse(idea.createdAt) + REMINDER_DAYS * 86400000).toISOString();
}

let transport;

// The report's address, opening in the tester's language.
function reportLink(idea, section = "") {
  return `${publicUrl().replace(/\/$/, "")}/report.html?id=${idea.id}&lang=${i18n.normalize(idea.language)}${section}`;
}

function sendMail(message) {
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transport.sendMail({ from: process.env.EMAIL_FROM, ...message });
}

// Right after a check: the link to the report, so the tester never loses it.
// Never throws; a failed email must not break the check itself.
async function sendReportLink(idea) {
  if (!isConfigured() || !idea.email) return false;
  try {
    const lang = idea.language;
    await sendMail({
      to: idea.email,
      subject: i18n.t(lang, "mail.report.subject", { title: idea.workingTitle }),
      text: i18n.t(lang, "mail.report.body", { title: idea.workingTitle, link: reportLink(idea), days: REMINDER_DAYS }),
    });
    await ideas.update(idea.id, { reportEmailSentAt: new Date().toISOString() });
    return true;
  } catch (error) {
    // Never log the address itself.
    console.error(`Report email for idea ${idea.id} failed: ${error.message}`);
    return false;
  }
}

// "Lost your link?": emails every report link checked with this address.
// Only ever sends to the address itself, so nobody else learns the links.
async function sendReportLinks(email, list, lang) {
  const items = list
    .slice(0, 20)
    .map((idea) => i18n.t(lang, "mail.links.item", { title: idea.workingTitle, date: idea.createdAt.slice(0, 10), link: reportLink(idea) }))
    .join("\n\n");
  await sendMail({
    to: email,
    subject: i18n.t(lang, list.length === 1 ? "mail.links.subject.one" : "mail.links.subject.many"),
    text: i18n.t(lang, "mail.links.body", { list: items }),
  });
}

async function sendReminder(idea) {
  const link = reportLink(idea, "#results");
  await sendMail({
    to: idea.email,
    subject: i18n.t(idea.language, "mail.reminder.subject", { title: idea.workingTitle }),
    text: i18n.t(idea.language, "mail.reminder.body", { title: idea.workingTitle, link, days: REMINDER_DAYS }),
  });
}

// Sends every reminder that is due. Each idea gets at most one, and none
// once the 30-day views or the video's link are already in.
async function sendDueReminders(now = Date.now()) {
  if (!isConfigured()) return { sent: 0, skipped: "email not configured" };
  let sent = 0;
  for (const idea of await ideas.readAll()) {
    // Testers who pasted their video's link need no reminder: its views
    // are read automatically (lib/tracking.js).
    if (!idea.email || idea.reminderSentAt || idea.results?.views30 != null || idea.results?.videoId) continue;
    if (Date.parse(dueAt(idea)) > now) continue;
    try {
      await sendReminder(idea);
      await ideas.update(idea.id, { reminderSentAt: new Date().toISOString() });
      sent += 1;
    } catch (error) {
      // Try again on the next check; never log the address itself.
      console.error(`Reminder for idea ${idea.id} failed: ${error.message}`);
    }
  }
  return { sent };
}

function start() {
  if (!isConfigured()) {
    console.log("Reminder emails are off (SMTP_HOST, EMAIL_FROM and PUBLIC_URL are not all set).");
    return;
  }
  const run = () => sendDueReminders().catch((error) => console.error(error));
  run();
  setInterval(run, CHECK_EVERY_MS).unref();
}

module.exports = { start, sendDueReminders, sendReportLink, sendReportLinks, isConfigured, dueAt, REMINDER_DAYS };
