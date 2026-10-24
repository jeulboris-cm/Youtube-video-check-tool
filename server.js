const path = require("path");
const express = require("express");
const ideas = require("./lib/ideas");
const youtube = require("./lib/youtube");
const reminders = require("./lib/reminders");
const admin = require("./lib/admin");
const tracking = require("./lib/tracking");
const { createLimiter } = require("./lib/ratelimit");
const { buildReport } = require("./lib/report");
const i18n = require("./lib/i18n");

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
    return res.status(400).json({ errors: i18n.errors(i18n.fromRequest(req), errors) });
  }
  const record = await ideas.save({ ...values, build: { status: "building", step: "start", startedAt: new Date().toISOString() } });
  // Answer straight away; the report page shows progress while it builds.
  res.status(201).json({ id: record.id });
  runBuild(record);
});

// A build that has not finished after this long has died (for example the
// server restarted), and may be started again.
const STUCK_MS = 5 * 60 * 1000;

function canRetry(record) {
  const build = record.build;
  if (!build || record.report) return false;
  return build.status === "failed" || (build.status === "building" && Date.now() - Date.parse(build.startedAt) > STUCK_MS);
}

// Builds the report in the background and records each step, so the
// report page can show what is happening. Never throws.
async function runBuild(record) {
  const startedAt = new Date().toISOString();
  const setStep = (step) => ideas.update(record.id, { build: { status: "building", step, startedAt } });
  try {
    // Keep a snapshot of the report as it was that day, as the spec asks.
    const report = await buildReport(record, setStep);
    await ideas.update(record.id, {
      channelSubscribers: report.channel?.subscribers ?? null,
      report,
      build: { status: "done", startedAt, finishedAt: new Date().toISOString() },
    });
    // Email the report's link if the tester left an address (never throws).
    await reminders.sendReportLink(record);
  } catch (error) {
    console.error(error);
    await ideas.update(record.id, { build: { status: "failed", startedAt } }).catch(() => {});
  }
}

// Starts a failed or stuck build again, from the report page.
app.post("/api/ideas/:id/retry", async (req, res) => {
  const record = await ideas.find(req.params.id);
  if (!record) return res.status(404).json({ error: i18n.t(i18n.fromRequest(req), "msg.not_found") });
  if (!canRetry(record)) return res.status(409).json({ error: i18n.t(i18n.fromRequest(req), "msg.already_building") });
  await ideas.update(record.id, { build: { status: "building", step: "start", startedAt: new Date().toISOString() } });
  res.json({ ok: true });
  runBuild(record);
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
    canRetry: canRetry(record),
  };
}

// Returns a saved idea and its report, for the report page. Ids are random
// and unguessable, so only someone with the link can see it.
app.get("/api/ideas/:id", async (req, res) => {
  const record = await ideas.find(req.params.id);
  if (!record) return res.status(404).json({ error: i18n.t(i18n.fromRequest(req), "msg.not_found") });
  res.json(publicView(record));
});

// Saves the real results: the published video's link and the views at 7,
// 30 and 90 days. With a link, the current views are also read from
// YouTube (1 quota unit).
app.post("/api/ideas/:id/results", async (req, res) => {
  const record = await ideas.find(req.params.id);
  if (!record) return res.status(404).json({ error: i18n.t(i18n.fromRequest(req), "msg.not_found") });
  const lang = i18n.fromRequest(req);
  const { errors, values } = ideas.validateResults(req.body || {});
  if (Object.keys(errors).length > 0) return res.status(400).json({ errors: i18n.errors(lang, errors) });

  // Keep what we already know about the same video if YouTube cannot be
  // reached right now.
  const sameVideo = values.videoId && record.results?.videoId === values.videoId;
  let video = sameVideo ? record.results.video : null;
  let videoError;
  if (values.videoId) {
    try {
      video = await youtube.videoStats(values.videoId);
      if (!video) return res.status(400).json({ errors: { videoUrl: i18n.t(lang, "err.video_not_found") } });
    } catch (error) {
      if (!(error instanceof youtube.YouTubeError)) console.error(error);
      videoError = "msg.video_read_failed";
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
  if (!record) return res.status(404).json({ error: i18n.t(i18n.fromRequest(req), "msg.not_found") });
  const { errors, values } = ideas.validateFeedback(req.body || {});
  if (Object.keys(errors).length > 0) return res.status(400).json({ errors: i18n.errors(i18n.fromRequest(req), errors) });
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
  const lang = i18n.fromRequest(req);
  if (!reminders.isConfigured()) {
    return res.status(503).json({ error: i18n.t(lang, "msg.email_off") });
  }
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return res.status(400).json({ errors: { email: i18n.t(lang, "err.find_email") } });
  }
  if (findLimitPerVisitor(req.ip) || findLimitPerEmail(email)) {
    return res.status(429).json({ error: i18n.t(lang, "msg.too_many") });
  }
  const list = (await ideas.readAll())
    .filter((idea) => idea.email && idea.email.toLowerCase() === email)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  // Answer before sending, so a known address does not answer more slowly
  // than an unknown one.
  res.json({ message: i18n.t(lang, "msg.find_sent") });
  if (list.length) {
    // Never log the address itself.
    reminders.sendReportLinks(email, list, lang).catch((error) => console.error(`Report links email failed: ${error.message}`));
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

// Owner page: sends one test email and reports what the mail server said.
app.post("/api/admin/test-email", async (req, res) => {
  const denied = admin.checkAccess(req);
  if (denied) return res.status(denied[0]).json({ error: denied[1] });
  const to = typeof req.body?.to === "string" ? req.body.to.trim() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return res.status(400).json({ error: "Enter a valid email address." });
  res.json(await reminders.sendTestEmail(to));
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
    return res.status(error.status).json({ error: i18n.t(i18n.fromRequest(req), "msg.bad_request") });
  }
  console.error(error);
  res.status(500).json({ error: i18n.t(i18n.fromRequest(req), "msg.server_error") });
});

// Listen on all interfaces so a phone on the same Wi-Fi can open the page.
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Idea Check running at http://localhost:${PORT}`);
  reminders.start();
});
