const youtube = require("./youtube");
const compare = require("./compare");
const shelflife = require("./shelflife");
const claude = require("./claude");

// How many of the most relevant videos the "Similar videos" section shows.
const SHOWN_SIMILAR = 12;

// Builds the six-section report for one saved idea. Never throws for
// YouTube or Claude problems: the report records what failed instead, so
// the sections that did work are still shown. onStep(name) is called as
// each stage starts, so the page can show progress while the tester waits.
async function buildReport(idea, onStep = async () => {}) {
  const report = {
    builtAt: new Date().toISOString(),
    // How ranges are expressed, so pages can compare later results fairly.
    model: { unit: "views_12_months", growth: compare.GROWTH },
    channel: null,
    trackRecord: null,
    similarVideos: [],
    yourSize: null,
    ownership: null,
    shelfLife: null,
    analysis: null,
    cost: null,
  };
  let allSimilar = [];

  try {
    await onStep("channel");
    report.channel = await youtube.lookupChannel(idea.channelUrl);
    const subscribers = report.channel?.subscribers;
    const ownChannel = report.channel?.id;
    // The tester's own recent videos (2 units): their own audience is the
    // most direct evidence there is.
    report.trackRecord = compare.trackRecord(await youtube.channelRecentVideos(report.channel));

    await onStep("search");
    // The size filter uses every relevant video found, not only the ones
    // shown, so there is more chance of enough comparable videos.
    allSimilar = await youtube.findSimilarVideos(idea);
    report.yourSize = compare.channelsYourSize(allSimilar, subscribers, ownChannel);
    // Too few from channels this size: search one page deeper (about 200
    // more units) before falling back to the per-subscriber estimate.
    if (report.yourSize.status === "thin") {
      await onStep("search_deeper");
      allSimilar = await youtube.findSimilarVideos(idea, { pages: 2 });
      report.yourSize = compare.channelsYourSize(allSimilar, subscribers, ownChannel);
      report.yourSize.searchedDeeper = true;
    }
    await onStep("compare");
    report.similarVideos = allSimilar.slice(0, SHOWN_SIMILAR);
    // The tester's own videos say nothing about who else owns the subject.
    const others = allSimilar.filter((v) => !ownChannel || v.channelId !== ownChannel);
    report.ownership = compare.subjectOwnership(others);
    allSimilar = others;
  } catch (error) {
    if (!(error instanceof youtube.YouTubeError)) console.error(error);
    report.youtubeError =
      error instanceof youtube.YouTubeError ? error.message : "Could not reach YouTube. Try again in a moment.";
    report.youtubeErrorCode = error instanceof youtube.YouTubeError ? error.code : "unreachable";
  }

  // Cost versus range, from the best evidence available: the tester's own
  // recent videos, then similar videos from channels their size, then the
  // labelled estimate. All in estimated 12-month views.
  const [basis, range] =
    report.trackRecord?.range ? ["track_record", report.trackRecord.range]
    : report.yourSize?.range ? ["your_size", report.yourSize.range]
    : report.yourSize?.estimate?.range ? ["estimate", report.yourSize.estimate.range]
    : [null, null];
  if (idea.costUsd && range) {
    report.cost = {
      costUsd: idea.costUsd,
      basis,
      views: { low: range.low, middle: range.middle, high: range.high },
      perThousandViews: compare.costPerThousand(idea.costUsd, range),
    };
  }

  // Claude gives the shelf life, reframes, packaging and fact checks when a
  // key is set. Without it, the free rule-based shelf-life check is used.
  if (claude.isConfigured()) {
    await onStep("analysis");
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
