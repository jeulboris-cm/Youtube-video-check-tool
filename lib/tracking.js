const ideas = require("./ideas");
const youtube = require("./youtube");

// Once a tester pastes their published video's link, the daily job reads
// its views from YouTube at 7, 30 and 90 days after publishing, so nobody
// has to remember to come back. Stored in results.auto, next to the numbers
// the tester typed in themselves.

const CHECKPOINTS = [7, 30, 90];
// The daily job runs once a day, so a reading can be up to a day late. A
// checkpoint more than this many days past (for example a link pasted on
// day 40) is skipped: today's views would not be the day-7 or day-30 views.
const GRACE_DAYS = 3;
const DAY = 86400000;

function checkpointTime(publishedAt, day) {
  return Date.parse(publishedAt) + day * DAY;
}

// The checkpoints that should be read now for one idea.
function dueCheckpoints(idea, now = Date.now()) {
  const results = idea.results;
  const publishedAt = results?.video?.publishedAt;
  if (!results?.videoId || !publishedAt || results.video.videoId !== results.videoId) return [];
  return CHECKPOINTS.filter((day) => {
    const at = checkpointTime(publishedAt, day);
    return !results.auto?.[day] && now >= at && now - at <= GRACE_DAYS * DAY;
  });
}

// When each checkpoint will be (or was) read, for the report page.
function schedule(results) {
  const publishedAt = results?.video?.publishedAt;
  if (!results?.videoId || !publishedAt) return null;
  return CHECKPOINTS.map((day) => ({
    day,
    at: new Date(checkpointTime(publishedAt, day)).toISOString(),
    reading: results.auto?.[day] || null,
  }));
}

// The views to use for a checkpoint: the tester's own number if they gave
// one, otherwise the number read automatically.
function viewsAt(results, day) {
  return results?.[`views${day}`] ?? results?.auto?.[day]?.views ?? null;
}

// Reads every due checkpoint in one go (1 quota unit per 50 videos).
async function readDueViews(now = Date.now()) {
  const due = [];
  for (const idea of await ideas.readAll()) {
    const days = dueCheckpoints(idea, now);
    if (days.length) due.push({ id: idea.id, videoId: idea.results.videoId, days });
  }
  if (!due.length) return { read: 0 };

  const views = await youtube.videoViews([...new Set(due.map((d) => d.videoId))]);
  let read = 0;
  for (const { id, videoId, days } of due) {
    if (!views.has(videoId)) continue;
    const reading = { views: views.get(videoId), readAt: new Date(now).toISOString() };
    await ideas.modify(id, (idea) => {
      // Skip if the tester switched to another video meanwhile.
      if (idea.results?.videoId !== videoId) return idea;
      const auto = { ...idea.results.auto };
      for (const day of days) auto[day] = { ...reading, daysAfterPublishing: Math.floor((now - Date.parse(idea.results.video.publishedAt)) / DAY) };
      return { ...idea, results: { ...idea.results, auto } };
    });
    read += days.length;
  }
  return { read };
}

module.exports = { readDueViews, dueCheckpoints, schedule, viewsAt, CHECKPOINTS };
