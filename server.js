const path = require("path");
const express = require("express");
const ideas = require("./lib/ideas");
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

// Returns a saved idea and its report, for the report page. Ids are random
// and unguessable, so only someone with the link can see it.
app.get("/api/ideas/:id", (req, res) => {
  const record = ideas.find(req.params.id);
  if (!record) return res.status(404).json({ error: "Report not found." });
  res.json(record);
});

// Listen on all interfaces so a phone on the same Wi-Fi can open the page.
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Idea Check running at http://localhost:${PORT}`);
});
