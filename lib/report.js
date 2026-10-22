const youtube = require("./youtube");
const compare = require("./compare");
const shelflife = require("./shelflife");
const claude = require("./claude");

// How many of the most relevant videos the "Similar videos" section shows.
const SHOWN_SIMILAR = 12;

// Builds the six-section report for one saved idea. Never throws for
// YouTube or Claude problems: the report records what failed instead, so
// the sections that did work are still shown.
async function buildReport(idea) {
  const report = {
    builtAt: new Date().toISOString(),
    channel: null,
    similarVideos: [],
    yourSize: null,
    ownership: null,
    shelfLife: null,
    analysis: null,
    cost: null,
  };
  let allSimilar = [];

  try {
    report.channel = await youtube.lookupChannel(idea.channelUrl);
    const subscribers = report.channel?.subscribers;
    const ownChannel = report.channel?.id;
    // The size filter uses every relevant video found, not only the ones
    // shown, so there is more chance of enough comparable videos.
    allSimilar = await youtube.findSimilarVideos(idea);
    report.yourSize = compare.channelsYourSize(allSimilar, subscribers, ownChannel);
    // Too few from channels this size: search one page deeper (about 200
    // more units) before falling back to the per-subscriber estimate.
    if (report.yourSize.status === "thin") {
      allSimilar = await youtube.findSimilarVideos(idea, { pages: 2 });
      report.yourSize = compare.channelsYourSize(allSimilar, subscribers, ownChannel);
      report.yourSize.searchedDeeper = true;
    }
    report.similarVideos = allSimilar.slice(0, SHOWN_SIMILAR);
    // The tester's own videos say nothing about who else owns the subject.
    const others = allSimilar.filter((v) => !ownChannel || v.channelId !== ownChannel);
    report.ownership = compare.subjectOwnership(others);
    allSimilar = others;
  } catch (error) {
    if (!(error instanceof youtube.YouTubeError)) console.error(error);
    report.youtubeError =
      error instanceof youtube.YouTubeError ? error.message : "Could not reach YouTube. Try again in a moment.";
  }

  // Cost versus range: real range from channels this size when there is
  // one, otherwise the labelled estimate.
  const range = report.yourSize?.range || report.yourSize?.estimate?.range;
  if (idea.costUsd && range) {
    report.cost = {
      costUsd: idea.costUsd,
      basis: report.yourSize.range ? "your_size" : "estimate",
      views: { low: range.low, middle: range.middle, high: range.high },
      perThousandViews: compare.costPerThousand(idea.costUsd, range),
    };
  }

  // Claude gives the shelf life, reframes, packaging and fact checks when a
  // key is set. Without it, the free rule-based shelf-life check is used.
  if (claude.isConfigured()) {
    try {
      report.analysis = await claude.analyzeIdea(
        { ...idea, channelSubscribers: report.channel?.subscribers ?? null },
        report.similarVideos,
        report.yourSize,
      );
      report.shelfLife = { ...report.analysis.shelfLife, source: "claude" };
    } catch (error) {
      if (!(error instanceof claude.ClaudeError)) console.error(error);
      report.claudeError =
        error instanceof claude.ClaudeError ? error.message : "Could not reach Claude. Try again in a moment.";
    }
  }
  report.shelfLife ??= shelflife.assessShelfLife(idea, allSimilar);

  return report;
}

module.exports = { buildReport };
