const path = require("path");
const express = require("express");
const ideas = require("./lib/ideas");
const youtube = require("./lib/youtube");
const compare = require("./lib/compare");

// How many of the most relevant videos the "Similar videos" list shows.
const SHOWN_SIMILAR = 12;

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
  const result = { id: record.id, createdAt: record.createdAt, channel: null, similarVideos: null, yourSize: null };

  try {
    result.channel = await youtube.lookupChannel(record.channelUrl);
    const subscribers = result.channel?.subscribers;
    // The size filter uses every relevant video found, not only the ones
    // shown, so there is more chance of enough comparable videos.
    let allSimilar = await youtube.findSimilarVideos(record);
    result.yourSize = compare.channelsYourSize(allSimilar, subscribers, result.channel?.id);
    // Too few from channels this size: search one page deeper (about 200
    // more units) before falling back to the per-subscriber estimate.
    if (result.yourSize.status === "thin") {
      allSimilar = await youtube.findSimilarVideos(record, { pages: 2 });
      result.yourSize = compare.channelsYourSize(allSimilar, subscribers, result.channel?.id);
      result.yourSize.searchedDeeper = true;
    }
    result.similarVideos = allSimilar.slice(0, SHOWN_SIMILAR);
    // Keep a snapshot of what was shown that day, as the spec asks.
    ideas.update(record.id, {
      channelSubscribers: result.channel?.subscribers ?? null,
      similarVideos: result.similarVideos,
      yourSize: result.yourSize,
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
