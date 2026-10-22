const path = require("path");
const express = require("express");
const ideas = require("./lib/ideas");
const youtube = require("./lib/youtube");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

// Simple check that the server is up, used by hosting platforms.
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Saves one idea from the input form, then looks up similar videos on
// YouTube. The idea is saved even if the YouTube lookup fails.
app.post("/api/ideas", async (req, res) => {
  const { errors, values } = ideas.validate(req.body || {});
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }
  const record = ideas.save(values);
  const result = { id: record.id, createdAt: record.createdAt, channel: null, similarVideos: null };

  try {
    result.channel = await youtube.lookupChannel(record.channelUrl);
    result.similarVideos = await youtube.findSimilarVideos(record.idea);
    // Keep a snapshot of what was shown that day, as the spec asks.
    ideas.update(record.id, {
      channelSubscribers: result.channel?.subscribers ?? null,
      similarVideos: result.similarVideos,
      similarVideosCheckedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (!(error instanceof youtube.YouTubeError)) console.error(error);
    result.youtubeError =
      error instanceof youtube.YouTubeError ? error.message : "Could not reach YouTube. Try again in a moment.";
  }

  res.status(201).json(result);
});

// Listen on all interfaces so a phone on the same Wi-Fi can open the page.
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Idea Check running at http://localhost:${PORT}`);
});
