const $ = (id) => document.getElementById(id);

const numberFormat = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const money = new Intl.NumberFormat("en", { style: "currency", currency: "USD" });
const ratio = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });
const n = (value) => numberFormat.format(value);

function formatCount(value, noun) {
  if (value === null || value === undefined) return `${noun} hidden`;
  return `${n(value)} ${noun}`;
}

function formatAge(isoDate) {
  const days = Math.floor((Date.now() - Date.parse(isoDate)) / 86400000);
  const plural = (count, unit) => `${count} ${unit}${count === 1 ? "" : "s"} ago`;
  if (days < 1) return "today";
  if (days < 30) return plural(days, "day");
  if (days < 365) return plural(Math.floor(days / 30), "month");
  return plural(Math.floor(days / 365), "year");
}

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

// Fills a list with one item per entry; build(entry) returns the item's nodes.
function fillList(list, entries, build) {
  list.replaceChildren(
    ...entries.map((entry) => {
      const item = el("li");
      item.append(...build(entry));
      return item;
    }),
  );
}

function renderVideos(list, videos) {
  fillList(list, videos, (video) => {
    const link = el("a", video.title);
    link.href = video.url;
    link.target = "_blank";
    link.rel = "noopener";
    const meta = el(
      "span",
      [
        formatCount(video.views, "views"),
        formatAge(video.publishedAt),
        `${video.channelTitle} (${formatCount(video.channelSubscribers, "subscribers")})`,
      ].join(" · "),
      "meta",
    );
    return [link, meta];
  });
}

// A highlighted range box: "<lead> <strong>X to Y views</strong> (middle: Z)."
function rangeBox(box, lead, range, details) {
  const main = el("p");
  main.append(lead, el("strong", `${n(range.low)} to ${n(range.high)} views`), ` (middle: ${n(range.middle)}).`);
  box.replaceChildren(main, ...details.map((text) => el("p", text, "meta")));
}

const NEWS_TIED = { yes: "Tied to news: yes", no: "Tied to news: no", not_sure: "Tied to news: not sure" };

function showIdea(idea, report) {
  $("idea-title").textContent = idea.workingTitle;
  $("idea-text").textContent = idea.idea;
  const parts = [`Checked ${new Date(idea.createdAt).toLocaleDateString()}`];
  if (report.channel) parts.push(`${report.channel.title}, ${formatCount(report.channel.subscribers, "subscribers")}`);
  if (idea.lengthMinutes) parts.push(`${idea.lengthMinutes} min`);
  if (idea.costUsd) parts.push(money.format(idea.costUsd));
  if (idea.productionDays) parts.push(`${idea.productionDays} days of work`);
  if (idea.newsTied) parts.push(NEWS_TIED[idea.newsTied]);
  $("idea-meta").textContent = parts.join(" · ");
  $("youtube-error").textContent = report.youtubeError || "";
  $("claude-error").textContent = report.claudeError || "";
}

function showSimilar(report) {
  renderVideos($("similar"), report.similarVideos);
  if (!report.youtubeError && report.similarVideos.length === 0) {
    $("similar").replaceWith(el("p", "No similar videos found on YouTube for this idea."));
  }
}

function showYourSize(data) {
  if (!data) {
    $("size-note").textContent = "Not available, because the YouTube search did not complete.";
    return;
  }
  if (data.band) {
    $("size-band").textContent = `Similar videos from channels with ${n(data.band.min)} to ${n(data.band.max)} subscribers (half to double your size).`;
  }
  renderVideos($("size-videos"), data.videos);

  if (data.status === "unknown_size") {
    $("size-note").textContent =
      "We need your subscriber count to compare with channels your size. Use a channel link like youtube.com/@name, and make sure your subscriber count is public.";
  } else if (data.status === "thin") {
    const found = data.videos.length;
    $("size-note").textContent =
      `Not enough data: we found ${found === 0 ? "no" : `only ${found}`} similar video${found === 1 ? "" : "s"} from channels your size, ` +
      `and need at least ${data.minimum} to give a range from channels your size` +
      (data.searchedDeeper ? ", even after searching deeper." : ".") +
      " Naming the specific people, companies or places in your idea can help.";
    if (data.estimate) showEstimate(data.estimate);
  } else {
    const r = data.range;
    rangeBox($("size-range"), "Most of these videos got ", r, [
      `Lowest: ${n(r.lowest)} · Highest: ${n(r.highest)} · Based on the ${data.videos.length} videos below.`,
    ]);
    $("size-range").hidden = false;
  }
}

function showEstimate(data) {
  const per = data.viewsPerSubscriber;
  rangeBox($("estimate-range"), "If your video does like most similar videos, relative to channel size: ", data.range, [
    `This is an estimate, not direct evidence from channels your size. Most of the ${data.videos.length} similar videos ` +
      `from channels with ${n(data.band.min)} to ${n(data.band.max)} subscribers ` +
      `got ${ratio.format(per.low)} to ${ratio.format(per.high)} views per subscriber of their channel; ` +
      "we applied that to your subscriber count. Bigger and smaller channels can behave differently.",
  ]);
  $("estimate-count").textContent = data.videos.length;
  renderVideos($("estimate-videos"), data.videos);
  $("estimate").hidden = false;
}

function showOwnership(data) {
  if (!data) {
    $("ownership").textContent = "Not available, because the YouTube search did not complete.";
    return;
  }
  if (data.status === "thin") {
    $("ownership").textContent = `Not enough similar videos (${data.videoCount}) to say who owns this subject.`;
    return;
  }
  const share = Math.round(data.largeViewShare * 100);
  const big = `channels with ${n(data.thresholds.large)}+ subscribers`;
  const names = data.largeChannels.length ? ` (${data.largeChannels.join(", ")})` : "";
  if (data.dominated) {
    $("ownership").textContent = `Large channels dominate: ${big}${names} got ${share}% of all views on the ${data.videoCount} similar videos.`;
  } else if (data.largeChannelCount === 0) {
    $("ownership").textContent = `No large channels: none of the ${data.videoCount} similar videos comes from ${big}.`;
  } else {
    $("ownership").textContent = `Large channels are present but do not dominate: ${big}${names} got ${share}% of all views on the ${data.videoCount} similar videos.`;
  }

  const count = data.breakthroughs.length;
  $("breakthrough-note").textContent = count
    ? `${count} video${count === 1 ? "" : "s"} from small channels (under ${n(data.thresholds.small)} subscribers) broke through, with ${n(data.thresholds.breakthroughViews)}+ views and more views than subscribers:`
    : `No small channel (under ${n(data.thresholds.small)} subscribers) has broken through on this subject among the videos found.`;
  renderVideos($("breakthroughs"), data.breakthroughs);
}

const SHELF_LIFE = { short: "Short (weeks)", medium: "Medium (months)", long: "Long (years)" };
const SIGNAL_NAMES = {
  wording: "Wording",
  older_competitors: "Older similar videos",
  tester_answer: "Your answer about news",
  search_interest: "Search interest",
};
const POINTS_TO = { short: "points to short", long: "points to long", unclear: "unclear" };

function showShelfLife(data, analysis) {
  $("shelf-life").replaceChildren(el("span", SHELF_LIFE[data.label], "label-tag"), ` ${data.reason}`);
  fillList($("shelf-signals"), data.signals, (s) => [
    el("strong", `${SIGNAL_NAMES[s.signal] || s.signal} (${POINTS_TO[s.pointsTo]}): `),
    s.detail,
  ]);

  const reframes = analysis?.reframes || [];
  $("reframes-block").hidden = reframes.length === 0;
  fillList($("reframes"), reframes, (r) => [r]);

  if (data.source === "rules") {
    $("shelf-source").textContent =
      "From a simple rule-based check of the signals above. Search-trend data is not included yet." +
      (data.label === "long"
        ? ""
        : " Tip: the same story framed around how or why something works usually lasts longer than one framed around a news event.");
  } else {
    $("shelf-source").textContent = "Judged by Claude (AI) from the signals above. Search-trend data is not included yet.";
  }
}

function showCost(idea, report) {
  const box = $("cost");
  if (!idea.costUsd) {
    box.replaceChildren(el("p", "Add your production cost on the form to see cost per 1,000 views."));
    return;
  }
  if (!report.cost) {
    box.replaceChildren(el("p", `Your cost: ${money.format(idea.costUsd)}. There is no view range for channels your size yet, so no cost comparison.`));
    return;
  }
  const { views, perThousandViews: per } = report.cost;
  const fmt = (value) => (value === null ? "not available" : money.format(value));
  const table = el("table", undefined, "cost-table");
  const rows = [
    ["", "Views", "Cost per 1,000 views"],
    ["Low end", n(views.low), fmt(per.atLowViews)],
    ["Middle", n(views.middle), fmt(per.atMiddleViews)],
    ["High end", n(views.high), fmt(per.atHighViews)],
  ];
  rows.forEach((cells, i) => {
    const tr = el("tr");
    cells.forEach((cell) => tr.append(el(i === 0 ? "th" : "td", cell)));
    table.append(tr);
  });
  const basis =
    report.cost.basis === "your_size"
      ? "Views come from the range for channels your size (section 2)."
      : "Views come from the estimate in section 2, not from channels your size, so treat these numbers with extra care.";
  box.replaceChildren(
    el("p", `Your cost: ${money.format(idea.costUsd)}.`),
    table,
    el("p", `${basis} They are the views similar videos have collected so far, and most of them are over a year old.`, "hint"),
  );
}

function showPackaging(analysis) {
  if (!analysis) {
    $("packaging-missing").hidden = false;
    return;
  }
  fillList($("packaging"), analysis.packaging, (p) => [
    el("strong", p.angle),
    el("br"),
    `Example title: "${p.exampleTitle}"`,
    el("br"),
    p.reason,
  ]);
  const checks = analysis.factChecks.length ? analysis.factChecks : [{ claim: "No specific claims to check were found.", why: "" }];
  fillList($("fact-checks"), checks, (f) => [el("strong", f.claim), f.why ? ` ${f.why}` : ""]);
  $("packaging-block").hidden = false;
}

// Shows field errors under a small form and focuses the first one.
function showFormErrors(form, fields, errors) {
  for (const field of fields) {
    $(`${field}-error`).textContent = errors[field] || "";
  }
  const first = fields.find((f) => errors[f]);
  if (first) {
    const input = form.elements[first];
    (input.focus ? input : input[0]).focus();
  }
}

// Sends a small form as JSON and returns the updated idea, or null when
// the server rejected it (errors are then shown under the fields).
async function postForm(form, url, fields, status, button) {
  button.disabled = true;
  status.textContent = "Saving…";
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    const body = await response.json();
    if (!response.ok) {
      showFormErrors(form, fields, body.errors || {});
      status.textContent = body.error || "Please fix the highlighted fields.";
      return null;
    }
    showFormErrors(form, fields, {});
    return body;
  } catch {
    status.textContent = "Could not save. Check your connection and try again.";
    return null;
  } finally {
    button.disabled = false;
  }
}

const DECISIONS = { changed: "changed your decision", confirmed: "confirmed your decision", no_effect: "had no effect on your decision" };

function showFeedback(idea) {
  const form = $("feedback-form");
  const feedback = idea.feedback;
  if (feedback) {
    form.elements.useful.value = feedback.useful;
    form.elements.decision.value = feedback.decision;
    form.elements.comment.value = feedback.comment || "";
    $("feedback-status").textContent =
      `Thanks! You said the report was ${feedback.useful === "yes" ? "useful" : "not useful"} and ${DECISIONS[feedback.decision]}. You can change your answers any time.`;
  }
}

// The range the report gave: from channels this size, or the estimate.
function predictedRange(report) {
  if (report.yourSize?.range) return { ...report.yourSize.range, basis: "channels your size" };
  if (report.yourSize?.estimate) return { ...report.yourSize.estimate.range, basis: "the estimate" };
  return null;
}

function compareToRange(views, range) {
  if (views < range.low) return "below the range";
  if (views > range.high) return "above the range";
  return "inside the range";
}

function showResults(idea, report) {
  const form = $("results-form");
  const results = idea.results || {};
  const reminder = idea.reminder;
  const due = new Date(reminder.dueAt).toLocaleDateString();
  $("results-intro").textContent = reminder.hasEmail && reminder.emailOn
    ? reminder.sentAt
      ? "Once the video is out, add its views here. We sent you the 30-day reminder."
      : `Once the video is out, add its views here. We will email you a reminder on ${due}.`
    : `Once the video is out, come back to this page (bookmark it) and add its views, ideally around ${due}. This is how we learn whether the ranges are right.`;

  form.elements.videoUrl.value = results.videoUrl || "";
  for (const field of ["views7", "views30", "views90"]) form.elements[field].value = results[field] ?? "";

  const summary = $("results-summary");
  const range = predictedRange(report);
  const lines = [];
  if (results.video) {
    const v = results.video;
    lines.push(el("p", `"${v.title}" had ${v.views === null ? "hidden" : n(v.views)} views when we read it on ${new Date(v.readAt).toLocaleDateString()} (published ${formatAge(v.publishedAt)}).`));
  }
  if (results.videoError) lines.push(el("p", results.videoError, "error"));
  const entered = [["views7", "7 days"], ["views30", "30 days"], ["views90", "90 days"]].filter(([f]) => results[f] != null);
  if (entered.length && range) {
    const list = el("ul");
    for (const [field, label] of entered) {
      list.append(el("li", `After ${label}: ${n(results[field])} views, ${compareToRange(results[field], range)} (${n(range.low)} to ${n(range.high)}, from ${range.basis}).`));
    }
    lines.push(list, el("p", "The range is what similar videos have collected so far, mostly over more than a year, so early numbers often sit below it. The 90-day number is the fairest comparison.", "hint"));
  } else if (entered.length) {
    lines.push(el("p", "Saved. The report had no view range to compare these numbers with.", "hint"));
  }
  summary.replaceChildren(...lines);
  summary.hidden = lines.length === 0;
}

function setUpForms(idea) {
  const id = idea.id;
  $("feedback-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const updated = await postForm(event.target, `/api/ideas/${id}/feedback`, ["useful", "decision", "comment"], $("feedback-status"), $("feedback-submit"));
    if (updated) showFeedback(updated);
  });
  $("results-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const updated = await postForm(event.target, `/api/ideas/${id}/results`, ["videoUrl", "views7", "views30", "views90"], $("results-status"), $("results-submit"));
    if (updated) {
      showResults(updated, updated.report);
      $("results-status").textContent = "Results saved. Thank you!";
    }
  });
}

async function load() {
  const id = new URLSearchParams(window.location.search).get("id");
  try {
    const response = await fetch(`/api/ideas/${encodeURIComponent(id || "")}`);
    if (!response.ok) throw new Error((await response.json()).error || "Report not found.");
    const idea = await response.json();
    const report = idea.report;
    if (!report) throw new Error("This idea has no report yet.");

    showIdea(idea, report);
    showSimilar(report);
    showYourSize(report.yourSize);
    showOwnership(report.ownership);
    showShelfLife(report.shelfLife, report.analysis);
    showCost(idea, report);
    showPackaging(report.analysis);
    showFeedback(idea);
    showResults(idea, report);
    setUpForms(idea);
    $("report").hidden = false;
    if (window.location.hash) $(window.location.hash.slice(1))?.scrollIntoView();
  } catch (error) {
    $("load-error").textContent = error.message || "Could not load the report.";
  } finally {
    $("loading").hidden = true;
  }
}

load();
