const nodemailer = require("nodemailer");
const ideas = require("./ideas");

// 30 days after a report, testers who left an email get one reminder asking
// for their real views. Email is sent through any SMTP service (Brevo,
// Resend, Gmail with an app password, …) set in these variables:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM
// PUBLIC_URL is the site's address, used for the link in the email.
// Without them, nothing is sent and the report page asks testers to come
// back on their own.

const REMINDER_DAYS = 30;
const CHECK_EVERY_MS = 60 * 60 * 1000;

function isConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.EMAIL_FROM && process.env.PUBLIC_URL);
}

function dueAt(idea) {
  return new Date(Date.parse(idea.createdAt) + REMINDER_DAYS * 86400000).toISOString();
}

let transport;

function reportLink(idea) {
  return `${process.env.PUBLIC_URL.replace(/\/$/, "")}/report.html?id=${idea.id}#results`;
}

async function sendReminder(idea) {
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  const link = reportLink(idea);
  await transport.sendMail({
    from: process.env.EMAIL_FROM,
    to: idea.email,
    subject: `How did "${idea.workingTitle}" do?`,
    text:
      `Hi,\n\n30 days ago you checked this idea on Idea Check:\n"${idea.workingTitle}"\n\n` +
      "If you made the video, could you add how many views it got? It takes a minute and tells us " +
      "whether the predicted range was right, which is the only way to make the tool better.\n\n" +
      `Add your results: ${link}\n\n` +
      "If you didn't make the video, you can say that on the same page.\n\n" +
      "This is the only reminder we will send for this idea.\n\nIdea Check",
  });
}

// Sends every reminder that is due. Each idea gets at most one, and none
// once the 30-day views are already entered.
async function sendDueReminders(now = Date.now()) {
  if (!isConfigured()) return { sent: 0, skipped: "email not configured" };
  let sent = 0;
  for (const idea of ideas.readAll()) {
    if (!idea.email || idea.reminderSentAt || idea.results?.views30 != null) continue;
    if (Date.parse(dueAt(idea)) > now) continue;
    try {
      await sendReminder(idea);
      ideas.update(idea.id, { reminderSentAt: new Date().toISOString() });
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

module.exports = { start, sendDueReminders, isConfigured, dueAt, REMINDER_DAYS };
