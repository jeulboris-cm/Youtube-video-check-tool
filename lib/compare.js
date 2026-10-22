// Compares the similar videos with the tester's own channel size.

// Channels from about half to double the tester's subscriber count.
const BAND_LOW = 0.5;
const BAND_HIGH = 2;
// Below this many comparable videos the report gives no range (spec:
// "Say when data is thin").
const MIN_VIDEOS_FOR_RANGE = 5;

// Value at fraction p (0 to 1) of a sorted list, blending neighbours.
function percentile(sorted, p) {
  const position = (sorted.length - 1) * p;
  const below = Math.floor(position);
  const above = Math.ceil(position);
  return Math.round(sorted[below] + (sorted[above] - sorted[below]) * (position - below));
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

// Returns the videos from channels the tester's size and, when there are
// enough of them, the range of views they got.
function channelsYourSize(similarVideos, testerSubscribers) {
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
    return { status: "thin", band, videos, range: null, minimum: MIN_VIDEOS_FOR_RANGE };
  }
  return { status: "ok", band, videos, range: viewRange(videos) };
}

module.exports = { channelsYourSize, viewRange, percentile };
