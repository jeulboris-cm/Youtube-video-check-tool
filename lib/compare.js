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

// Older videos have had longer to collect views, so comparing total views
// would favour them. Every range is in estimated views after 12 months (the
// spec judges ideas over 12 months). Working assumption, to be checked
// against testers' real results: views keep growing after publishing, more
// and more slowly, like (days since publishing) ^ GROWTH. With 0.3, a video
// has about 30% of its first-year views after 7 days, 47% after 30 days and
// 66% after 90 days.
const GROWTH = 0.3;
const YEAR_DAYS = 365;
// Videos older than this come from a different YouTube; they are left out.
const MAX_AGE_DAYS = 5 * 365;
const DAY = 86400000;

// Estimated views 12 months after publishing, or null when unknown.
function twelveMonthViews(video, now = Date.now()) {
  if (video.views == null || !video.publishedAt) return null;
  const ageDays = (now - Date.parse(video.publishedAt)) / DAY;
  if (ageDays <= 0 || ageDays > MAX_AGE_DAYS) return null;
  return Math.round(video.views * (YEAR_DAYS / ageDays) ** GROWTH);
}

// What a 12-month range means at an earlier point, for comparing a tester's
// views after 7, 30 or 90 days fairly.
function scaleRange(range, days) {
  const factor = (days / YEAR_DAYS) ** GROWTH;
  return { low: Math.round(range.low * factor), middle: Math.round(range.middle * factor), high: Math.round(range.high * factor) };
}

const withTwelveMonths = (videos) => videos.filter((v) => twelveMonthViews(v) !== null);

// The typical range is the middle half of the videos (25th to 75th
// percentile), so one viral hit or one flop does not stretch it. The lowest
// and highest are reported separately. All in estimated 12-month views.
function viewRange(videos) {
  const views = videos.map((v) => twelveMonthViews(v)).sort((a, b) => a - b);
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
  const videos = withTwelveMonths(similarVideos).filter(
    (v) => v.channelSubscribers !== null && v.channelSubscribers >= band.min && v.channelSubscribers <= band.max,
  );
  if (videos.length < MIN_VIDEOS_FOR_RANGE) return null;
  const ratios = videos.map((v) => twelveMonthViews(v) / v.channelSubscribers).sort((a, b) => a - b);
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
  const videos = withTwelveMonths(similarVideos).filter(
    (v) => v.channelSubscribers !== null && v.channelSubscribers >= band.min && v.channelSubscribers <= band.max,
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

// The tester's own recent videos: the most direct evidence of what their
// audience does. Needs at least 3 videos to give a range.
const MIN_OWN_VIDEOS = 3;

function trackRecord(ownVideos) {
  const videos = withTwelveMonths(ownVideos);
  if (videos.length < MIN_OWN_VIDEOS) return { status: "thin", videos, minimum: MIN_OWN_VIDEOS };
  return { status: "ok", videos, range: viewRange(videos) };
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

// ---- Outliers: videos that did far better than their own channel usually does.
//
// A big channel always gets big views, so raw views say little about whether
// people *chose the subject*. A video that beat its own channel's average
// shows demand for the subject itself. The yardstick is the channel's
// average views per video (all its views / its videos). It includes Shorts
// and the video itself, so it is rough, and it is an average (higher than
// the typical video), which makes "3x" a fairly strict bar.
const OUTLIER_RATIO = 3;
const UNDER_RATIO = 0.5;
// Tiny channels have tiny averages: a 12-view video would look like "12x".
const OUTLIER_MIN_VIEWS = 1000;

function outlierInfo(video) {
  if (video.views == null || !video.channelAvgViews) return { outlierRatio: null, outlier: false };
  const ratio = video.views / video.channelAvgViews;
  return { outlierRatio: Math.round(ratio * 10) / 10, outlier: ratio >= OUTLIER_RATIO && video.views >= OUTLIER_MIN_VIEWS };
}

const isOutlier = (video) => outlierInfo(video).outlier;

// Is there demand for this subject on YouTube? Counts the similar videos that
// beat their channel's average (outliers) and the ones that fell below half
// of it, so failures count as much as hits.
function demandCheck(videos) {
  const known = videos.map((v) => ({ v, ...outlierInfo(v) })).filter((x) => x.outlierRatio !== null);
  if (known.length < MIN_VIDEOS_FOR_RANGE) return { status: "thin", videoCount: known.length, minimum: MIN_VIDEOS_FOR_RANGE };
  const outliers = known.filter((x) => x.outlier);
  const under = known.filter((x) => x.outlierRatio < UNDER_RATIO);
  const share = outliers.length / known.length;
  return {
    status: "ok",
    verdict: outliers.length >= 3 && share >= 0.25 ? "strong" : share >= 0.1 && outliers.length >= 1 ? "moderate" : "weak",
    videoCount: known.length,
    outliers: outliers.length,
    under: under.length,
    median: Math.round(interpolate(known.map((x) => x.outlierRatio).sort((a, b) => a - b), 0.5) * 10) / 10,
    thresholds: { outlier: OUTLIER_RATIO, under: UNDER_RATIO, minViews: OUTLIER_MIN_VIEWS },
    top: outliers.sort((a, b) => b.outlierRatio - a.outlierRatio).slice(0, 3).map((x) => x.v.videoId),
  };
}

// Real views after `days` as a multiple of the tester's usual: the middle of
// their own recent videos' estimated 12-month views, scaled to that day.
// Null when the report has no track record.
function usualMultiple(report, views, days) {
  const middle = report?.trackRecord?.range?.middle;
  if (views == null || !middle || report?.model?.unit !== "views_12_months") return null;
  const usual = scaleRange({ low: middle, middle, high: middle }, days).middle;
  return usual > 0 ? Math.round((views / usual) * 10) / 10 : null;
}

// Cost per 1,000 views at the low, middle and high end of a view range.
function costPerThousand(costUsd, range) {
  if (!costUsd || !range) return null;
  const per = (views) => (views > 0 ? Math.round((costUsd / views) * 1000 * 100) / 100 : null);
  // The low end of views is the most expensive per 1,000 views.
  return { atLowViews: per(range.low), atMiddleViews: per(range.middle), atHighViews: per(range.high) };
}

module.exports = {
  outlierInfo,
  isOutlier,
  demandCheck,
  usualMultiple,
  GROWTH,
  twelveMonthViews,
  scaleRange,
  trackRecord,
  channelsYourSize,
  perSubscriberEstimate,
  subjectOwnership,
  costPerThousand,
  viewRange,
  percentile,
};
