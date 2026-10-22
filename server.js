const path = require("path");
const express = require("express");
const ideas = require("./lib/ideas");
const youtube = require("./lib/youtube");
const reminders = require("./lib/reminders");
const { buildReport } = require("./lib/report");

const app = express();
const PORT = process.env.PORT || 3000;

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
  const record = ideas.save(values);
  try {
    // Keep a snapshot of the report as it was that day, as the spec asks.
    const report = await buildReport(record);
    ideas.update(record.id, { channelSubscribers: report.channel?.subscribers ?? null, report });
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
  };
}

// Returns a saved idea and its report, for the report page. Ids are random
// and unguessable, so only someone with the link can see it.
app.get("/api/ideas/:id", (req, res) => {
  const record = ideas.find(req.params.id);
  if (!record) return res.status(404).json({ error: "Report not found." });
  res.json(publicView(record));
});

// Saves the real results: the published video's link and the views at 7,
// 30 and 90 days. With a link, the current views are also read from
// YouTube (1 quota unit).
app.post("/api/ideas/:id/results", async (req, res) => {
  const record = ideas.find(req.params.id);
  if (!record) return res.status(404).json({ error: "Report not found." });
  const { errors, values } = ideas.validateResults(req.body || {});
  if (Object.keys(errors).length > 0) return res.status(400).json({ errors });

  const results = { ...values, video: record.results?.video || null, updatedAt: new Date().toISOString() };
  if (values.videoId) {
    try {
      results.video = await youtube.videoStats(values.videoId);
      if (!results.video) return res.status(400).json({ errors: { videoUrl: "No public YouTube video found at that link." } });
    } catch (error) {
      if (!(error instanceof youtube.YouTubeError)) console.error(error);
      results.videoError = "Could not read the current views from YouTube. Your numbers were still saved.";
    }
  } else {
    results.video = null;
  }
  res.json(publicView(ideas.update(record.id, { results })));
});

// Saves the answers to "Was this useful?" and "Would it have changed your
// decision?".
app.post("/api/ideas/:id/feedback", (req, res) => {
  const record = ideas.find(req.params.id);
  if (!record) return res.status(404).json({ error: "Report not found." });
  const { errors, values } = ideas.validateFeedback(req.body || {});
  if (Object.keys(errors).length > 0) return res.status(400).json({ errors });
  const feedback = { ...values, at: new Date().toISOString() };
  res.json(publicView(ideas.update(record.id, { feedback })));
});

// Listen on all interfaces so a phone on the same Wi-Fi can open the page.
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Idea Check running at http://localhost:${PORT}`);
  reminders.start();
});
