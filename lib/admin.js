const crypto = require("crypto");
const tracking = require("./tracking");
const compareLib = require("./compare");

// The owner's private overview of every check, behind ADMIN_PASSWORD.
// Without that setting the overview is switched off completely.

const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;
const failures = new Map();

function isEnabled() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

// Compares in constant time, so the answer time gives nothing away.
function passwordMatches(given) {
  const expected = crypto.createHash("sha256").update(process.env.ADMIN_PASSWORD || "").digest();
  const actual = crypto.createHash("sha256").update(String(given || "")).digest();
  return isEnabled() && crypto.timingSafeEqual(expected, actual);
}

// Checks the password sent as "Authorization: Bearer <password>", locking a
// visitor out for 15 minutes after 5 wrong tries. Returns null when allowed,
// otherwise [status, message].
function checkAccess(req) {
  if (!isEnabled()) return [404, "Not found."];
  const now = Date.now();
  const record = failures.get(req.ip);
  if (record && record.lockedUntil > now) return [429, "Too many wrong passwords. Try again in 15 minutes."];

  const given = (req.get("authorization") || "").replace(/^Bearer /, "");
  if (passwordMatches(given)) {
    failures.delete(req.ip);
    return null;
  }
  // A lock that has run out starts the count again.
  const previous = record && !record.lockedUntil ? record.count : 0;
  const count = previous + 1;
  failures.set(req.ip, { count, lockedUntil: count >= MAX_FAILURES ? now + LOCK_MS : 0 });
  return [401, "Wrong password."];
}

// The report's predicted range, from the best evidence it had.
function rangeOf(report) {
  if (report?.trackRecord?.range) return { ...report.trackRecord.range, basis: "track_record" };
  if (report?.yourSize?.range) return { ...report.yourSize.range, basis: "your_size" };
  if (report?.yourSize?.estimate) return { ...report.yourSize.estimate.range, basis: "estimate" };
  return null;
}

// Real views after `days` against the range. Newer reports give 12-month
// ranges, so they are scaled to what is expected after that many days;
// older reports gave total views and are compared as they are.
function compare(views, range, days, report) {
  if (views == null || !range) return null;
  const target = report?.model?.unit === "views_12_months" ? compareLib.scaleRange(range, days) : range;
  return views < target.low ? "below" : views > target.high ? "above" : "inside";
}

// One row per check, newest first, with what the owner needs to follow up.
function rows(ideas) {
  return ideas
    .map((idea) => {
      const report = idea.report || {};
      const range = rangeOf(report);
      const results = idea.results || {};
      return {
        id: idea.id,
        createdAt: idea.createdAt,
        workingTitle: idea.workingTitle,
        idea: idea.idea,
        channelUrl: idea.channelUrl,
        channelTitle: report.channel?.title || null,
        channelSubscribers: report.channel?.subscribers ?? idea.channelSubscribers ?? null,
        email: idea.email || null,
        costUsd: idea.costUsd,
        newsTied: idea.newsTied,
        shelfLife: report.shelfLife?.label || null,
        range,
        problems: [report.youtubeError, report.claudeError].filter(Boolean),
        feedback: idea.feedback || null,
        // The tester's own numbers, or else the automatic readings.
        views7: tracking.viewsAt(results, 7),
        views30: tracking.viewsAt(results, 30),
        views90: tracking.viewsAt(results, 90),
        autoTracked: Boolean(results.videoId && results.video?.publishedAt),
        notMade: Boolean(results.notMade),
        videoUrl: results.videoUrl || null,
        compare30: compare(tracking.viewsAt(results, 30), range, 30, report),
        compare90: compare(tracking.viewsAt(results, 90), range, 90, report),
        reportEmailSentAt: idea.reportEmailSentAt || null,
        reminderSentAt: idea.reminderSentAt || null,
      };
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function count(list, test) {
  return list.filter(test).length;
}

// The headline numbers: how many checks, what testers said, and how real
// views compared with the predicted ranges.
function summary(list) {
  const withFeedback = list.filter((r) => r.feedback);
  const tally = (field) => ({
    inside: count(list, (r) => r[field] === "inside"),
    below: count(list, (r) => r[field] === "below"),
    above: count(list, (r) => r[field] === "above"),
  });
  return {
    checks: list.length,
    withEmail: count(list, (r) => r.email),
    feedback: withFeedback.length,
    useful: count(withFeedback, (r) => r.feedback.useful === "yes"),
    decision: {
      changed: count(withFeedback, (r) => r.feedback.decision === "changed"),
      confirmed: count(withFeedback, (r) => r.feedback.decision === "confirmed"),
      noEffect: count(withFeedback, (r) => r.feedback.decision === "no_effect"),
    },
    withResults: count(list, (r) => r.views7 != null || r.views30 != null || r.views90 != null),
    tracked: count(list, (r) => r.autoTracked),
    notMade: count(list, (r) => r.notMade),
    at30: tally("compare30"),
    at90: tally("compare90"),
  };
}

function overview(ideas) {
  const list = rows(ideas);
  return { summary: summary(list), ideas: list };
}

module.exports = { checkAccess, isEnabled, overview };
