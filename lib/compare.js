// Compares the similar videos with the tester's own channel size.

// Channels from about half to double the tester's subscriber count.
const BAND_LOW = 0.5;
const BAND_HIGH = 2;
// Below this many comparable videos the report gives no range (spec:
// "Say when data is thin").
const MIN_VIDEOS_FOR_RANGE = 5;

// Value at fraction p (0 to 1) of a sorted list, blending neighbours.
function interpolate(sorted, p) {
  const position = (sorted.length - 1) * p;
  const below = Math.floor(position);
  const above = Math.ceil(position);
  return sorted[below] + (sorted[above] - sorted[below]) * (position - below);
}

function percentile(sorted, p) {
  return Math.round(interpolate(sorted, p));
}

// The typical range is the middle half of the videos (25th to 75th
// percentile), so one viral hit or one flop does not stretch it. The lowest
// and highest are reported separately.
function viewRange(videos) {
  const views = videos.map((v) => v.views).sort((a, b) => a - b);
  return {
    low: percentile(views, 0.25),
    middle: percentile(views, 0.5),
    high: percentile(views, 0.75),
    lowest: views[0],
    highest: views[views.length - 1],
  };
}

// The estimate uses channels from a tenth of the tester's size up to 50
// times it. Very large media channels get a much smaller share of their
// audience per video, so they would drag the estimate down.
const ESTIMATE_LOW = 0.1;
const ESTIMATE_HIGH = 50;
// Channels this small give unstable views-per-subscriber numbers (a channel
// with 3 subscribers and 400 views would count as 133 views per subscriber).
const MIN_SUBSCRIBERS_FOR_ESTIMATE = 100;

// Fallback when too few videos come from channels the tester's size: works
// out views per subscriber for each similar video in the estimate band, takes the middle half of
// those numbers and scales them to the tester's subscriber count. This is an
// estimate, not direct evidence, and the page says so.
function perSubscriberEstimate(similarVideos, testerSubscribers) {
  const band = {
    min: Math.max(MIN_SUBSCRIBERS_FOR_ESTIMATE, Math.floor(testerSubscribers * ESTIMATE_LOW)),
    max: Math.ceil(testerSubscribers * ESTIMATE_HIGH),
  };
  const videos = similarVideos.filter(
    (v) => v.views !== null && v.channelSubscribers !== null &&
      v.channelSubscribers >= band.min && v.channelSubscribers <= band.max,
  );
  if (videos.length < MIN_VIDEOS_FOR_RANGE) return null;
  const ratios = videos.map((v) => v.views / v.channelSubscribers).sort((a, b) => a - b);
  const ratio = { low: interpolate(ratios, 0.25), middle: interpolate(ratios, 0.5), high: interpolate(ratios, 0.75) };
  return {
    band,
    viewsPerSubscriber: ratio,
    range: {
      low: Math.round(ratio.low * testerSubscribers),
      middle: Math.round(ratio.middle * testerSubscribers),
      high: Math.round(ratio.high * testerSubscribers),
    },
    videos,
  };
}

// Returns the videos from channels the tester's size and, when there are
// enough of them, the range of views they got. The tester's own videos are
// left out: the comparison is with other channels.
function channelsYourSize(allVideos, testerSubscribers, testerChannelId = null) {
  const similarVideos = allVideos.filter((v) => !testerChannelId || v.channelId !== testerChannelId);
  if (!testerSubscribers) {
    return { status: "unknown_size", videos: [], range: null };
  }
  const band = {
    min: Math.floor(testerSubscribers * BAND_LOW),
    max: Math.ceil(testerSubscribers * BAND_HIGH),
  };
  const videos = similarVideos.filter(
    (v) => v.views !== null && v.channelSubscribers !== null &&
      v.channelSubscribers >= band.min && v.channelSubscribers <= band.max,
  );
  if (videos.length < MIN_VIDEOS_FOR_RANGE) {
    return {
      status: "thin",
      band,
      videos,
      range: null,
      minimum: MIN_VIDEOS_FOR_RANGE,
      estimate: perSubscriberEstimate(similarVideos, testerSubscribers),
    };
  }
  return { status: "ok", band, videos, range: viewRange(videos) };
}

// Who owns the subject: do large channels take most of the views, and have
// small channels broken through? Uses every relevant similar video.
const LARGE_CHANNEL = 1000000;
const SMALL_CHANNEL = 100000;
// A small channel "broke through" when a video got at least 10,000 views and
// more views than the channel has subscribers.
const BREAKTHROUGH_VIEWS = 10000;

function subjectOwnership(similarVideos) {
  const videos = similarVideos.filter((v) => v.views !== null && v.channelSubscribers !== null);
  if (videos.length < MIN_VIDEOS_FOR_RANGE) return { status: "thin", videoCount: videos.length };

  const totalViews = videos.reduce((sum, v) => sum + v.views, 0);
  const large = videos.filter((v) => v.channelSubscribers >= LARGE_CHANNEL);
  const largeViews = large.reduce((sum, v) => sum + v.views, 0);
  const breakthroughs = videos.filter(
    (v) => v.channelSubscribers < SMALL_CHANNEL && v.views >= BREAKTHROUGH_VIEWS && v.views > v.channelSubscribers,
  );
  const largeShare = totalViews ? largeViews / totalViews : 0;

  return {
    status: "ok",
    videoCount: videos.length,
    totalViews,
    largeChannelCount: new Set(large.map((v) => v.channelId)).size,
    largeViewShare: largeShare,
    dominated: largeShare >= 0.6,
    largeChannels: [...new Set(large.sort((a, b) => b.views - a.views).map((v) => v.channelTitle))].slice(0, 5),
    breakthroughs: breakthroughs.sort((a, b) => b.views - a.views),
    thresholds: { large: LARGE_CHANNEL, small: SMALL_CHANNEL, breakthroughViews: BREAKTHROUGH_VIEWS },
  };
}

// Cost per 1,000 views at the low, middle and high end of a view range.
function costPerThousand(costUsd, range) {
  if (!costUsd || !range) return null;
  const per = (views) => (views > 0 ? Math.round((costUsd / views) * 1000 * 100) / 100 : null);
  // The low end of views is the most expensive per 1,000 views.
  return { atLowViews: per(range.low), atMiddleViews: per(range.middle), atHighViews: per(range.high) };
}

module.exports = {
  channelsYourSize,
  perSubscriberEstimate,
  subjectOwnership,
  costPerThousand,
  viewRange,
  percentile,
};
