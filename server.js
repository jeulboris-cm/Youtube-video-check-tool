const path = require("path");
const express = require("express");
const ideas = require("./lib/ideas");
const youtube = require("./lib/youtube");
const reminders = require("./lib/reminders");
const admin = require("./lib/admin");
const tracking = require("./lib/tracking");
const { createLimiter } = require("./lib/ratelimit");
const { buildReport } = require("./lib/report");

const app = express();
const PORT = process.env.PORT || 3000;
// Hosts like Render sit in front of the app; this makes req.ip the visitor's
// address, which the admin password lockout relies on.
app.set("trust proxy", 1);

app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

// Simple check that the server is up, used by hosting platforms.
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Saves one idea from the input form, then builds its report. The idea is
// saved first, so it is kept even if building the report fails.
app.post("/api/ideas", async (req, res) => {
  const { errors, values } = ideas.validate(req.body || {});
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }
  const record = await ideas.save(values);
  try {
    // Keep a snapshot of the report as it was that day, as the spec asks.
    const report = await buildReport(record);
    await ideas.update(record.id, { channelSubscribers: report.channel?.subscribers ?? null, report });
    // Email the report's link if the tester left an address. Not awaited:
    // the tester does not need to wait for it, and it never throws.
    reminders.sendReportLink(record);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Your idea was saved, but the report could not be built. Try again." });
  }
  res.status(201).json({ id: record.id });
});

// What the report page gets: everything except the email address, plus
// when the reminder is due.
function publicView(record) {
  const { email, ...rest } = record;
  return {
    ...rest,
    reminder: {
      hasEmail: Boolean(email),
      emailOn: reminders.isConfigured(),
      dueAt: reminders.dueAt(record),
      sentAt: record.reminderSentAt || null,
    },
    tracking: tracking.schedule(record.results),
  };
}

// Returns a saved idea and its report, for the report page. Ids are random
// and unguessable, so only someone with the link can see it.
app.get("/api/ideas/:id", async (req, res) => {
  const record = await ideas.find(req.params.id);
  if (!record) return res.status(404).json({ error: "Report not found." });
  res.json(publicView(record));
});

// Saves the real results: the published video's link and the views at 7,
// 30 and 90 days. With a link, the current views are also read from
// YouTube (1 quota unit).
app.post("/api/ideas/:id/results", async (req, res) => {
  const record = await ideas.find(req.params.id);
  if (!record) return res.status(404).json({ error: "Report not found." });
  const { errors, values } = ideas.validateResults(req.body || {});
  if (Object.keys(errors).length > 0) return res.status(400).json({ errors });

  // Keep what we already know about the same video if YouTube cannot be
  // reached right now.
  const sameVideo = values.videoId && record.results?.videoId === values.videoId;
  let video = sameVideo ? record.results.video : null;
  let videoError;
  if (values.videoId) {
    try {
      video = await youtube.videoStats(values.videoId);
      if (!video) return res.status(400).json({ errors: { videoUrl: "No public YouTube video found at that link." } });
    } catch (error) {
      if (!(error instanceof youtube.YouTubeError)) console.error(error);
      videoError = "Could not read the current views from YouTube. Your numbers were still saved.";
    }
  }
  const updated = await ideas.modify(record.id, (idea) => {
    // The automatic 7/30/90-day readings belong to one video; a new link
    // starts them again.
    const keepAuto = values.videoId && idea.results?.videoId === values.videoId;
    const results = { ...values, video, auto: keepAuto ? idea.results.auto || {} : {}, updatedAt: new Date().toISOString() };
    if (videoError) results.videoError = videoError;
    return { ...idea, results };
  });
  res.json(publicView(updated));
});

// Saves the answers to "Was this useful?" and "Would it have changed your
// decision?".
app.post("/api/ideas/:id/feedback", async (req, res) => {
  const record = await ideas.find(req.params.id);
  if (!record) return res.status(404).json({ error: "Report not found." });
  const { errors, values } = ideas.validateFeedback(req.body || {});
  if (Object.keys(errors).length > 0) return res.status(400).json({ errors });
  const feedback = { ...values, at: new Date().toISOString() };
  res.json(publicView(await ideas.update(record.id, { feedback })));
});

// "Lost your link?": emails the links of every report checked with an email
// address, to that address only. The answer is the same whether or not the
// address is known, so nobody can find out who used the tool. Limited to 5
// requests an hour per visitor and 3 per address, so it cannot flood inboxes.
const findLimitPerVisitor = createLimiter({ max: 5, windowMs: 60 * 60 * 1000 });
const findLimitPerEmail = createLimiter({ max: 3, windowMs: 60 * 60 * 1000 });
app.post("/api/find-reports", async (req, res) => {
  if (!reminders.isConfigured()) {
    return res.status(503).json({ error: "Email is not set up yet. Please contact the person who invited you to Idea Check." });
  }
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return res.status(400).json({ errors: { email: "Enter the email address you gave on the form." } });
  }
  if (findLimitPerVisitor(req.ip) || findLimitPerEmail(email)) {
    return res.status(429).json({ error: "Too many requests. Please try again in an hour." });
  }
  const list = (await ideas.readAll())
    .filter((idea) => idea.email && idea.email.toLowerCase() === email)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  // Answer before sending, so a known address does not answer more slowly
  // than an unknown one.
  res.json({ message: "If we have reports for that address, we have just emailed the links to it. Check your spam folder too." });
  if (list.length) {
    // Never log the address itself.
    reminders.sendReportLinks(email, list).catch((error) => console.error(`Report links email failed: ${error.message}`));
  }
});

// The owner's private overview of every check (public/admin.html). Needs
// the ADMIN_PASSWORD setting; without it this answers "Not found".
app.get("/api/admin/ideas", async (req, res) => {
  const denied = admin.checkAccess(req);
  if (denied) return res.status(denied[0]).json({ error: denied[1] });
  res.set("Cache-Control", "no-store");
  res.json(admin.overview(await ideas.readAll()));
});

// The daily jobs: read the views of published videos at 7, 30 and 90 days,
// and send the reminder emails that are due. A free scheduler (the GitHub
// Actions workflow in .github/workflows/reminders.yml) calls this once a
// day, which also wakes the app on hosts that put it to sleep. It needs the
// CRON_SECRET, so strangers cannot trigger it.
app.post("/api/cron/reminders", async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.get("authorization") !== `Bearer ${secret}`) return res.status(401).json({ error: "Not allowed." });
  let views;
  try {
    views = await tracking.readDueViews();
  } catch (error) {
    // A YouTube problem must not stop the reminders.
    console.error(error);
    views = { read: 0, error: error.message };
  }
  res.json({ views, reminders: await reminders.sendDueReminders() });
});

// Any error not handled above: log it and answer with a plain message.
app.use((error, req, res, next) => {
  // Malformed or oversized requests are the sender's problem, not a crash.
  if (error.status >= 400 && error.status < 500) {
    return res.status(error.status).json({ error: "The request could not be read." });
  }
  console.error(error);
  res.status(500).json({ error: "Something went wrong on the server. Try again." });
});

// Listen on all interfaces so a phone on the same Wi-Fi can open the page.
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Idea Check running at http://localhost:${PORT}`);
  reminders.start();
});
