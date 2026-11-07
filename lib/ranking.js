// "Compare my ideas": puts a tester's checked ideas side by side and orders
// them. No new YouTube calls: it only reads the reports already built.
// The order is plain and explainable:
//   1. If every idea has a range and a cost, the lowest cost per 1,000 views
//      (at the middle of the range) comes first.
//   2. Otherwise the highest middle of the range comes first.
//   3. Ideas without a range go last.
// Demand, crowding and shelf life are shown as signs next to each idea; they
// do not change the order, so the order never hides behind a secret formula.

const MAX_IDEAS = 6;

function rangeOf(report) {
  if (report?.trackRecord?.range) return { ...report.trackRecord.range, basis: "track_record" };
  if (report?.yourSize?.range) return { ...report.yourSize.range, basis: "your_size" };
  if (report?.yourSize?.estimate) return { ...report.yourSize.estimate.range, basis: "estimate" };
  return null;
}

// One row for the comparison page. No email or anything private.
function summarize(idea) {
  const report = idea.report || {};
  const range = rangeOf(report);
  const perThousand = range && idea.costUsd ? Math.round((idea.costUsd / range.middle) * 1000 * 100) / 100 : null;
  return {
    id: idea.id,
    workingTitle: idea.workingTitle,
    language: idea.language,
    createdAt: idea.createdAt,
    costUsd: idea.costUsd || null,
    range,
    perThousand: Number.isFinite(perThousand) ? perThousand : null,
    demand: report.demand?.status === "ok" ? report.demand.verdict : null,
    saturation: report.saturation?.status === "ok" ? report.saturation.verdict : null,
    shelfLife: report.shelfLife?.label || null,
    ready: Boolean(idea.report),
  };
}

function rank(ideas) {
  const rows = ideas.slice(0, MAX_IDEAS).map(summarize);
  const withRange = rows.filter((r) => r.range && r.range.middle > 0);
  const byCost = withRange.length > 1 && withRange.every((r) => r.perThousand != null);
  const sorted = [...withRange].sort((a, b) => (byCost ? a.perThousand - b.perThousand : b.range.middle - a.range.middle));
  const without = rows.filter((r) => !withRange.includes(r));
  return { basis: withRange.length < 2 ? "none" : byCost ? "cost" : "views", rows: [...sorted, ...without] };
}

module.exports = { rank, summarize, rangeOf, MAX_IDEAS };
