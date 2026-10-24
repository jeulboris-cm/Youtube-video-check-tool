const $ = (id) => document.getElementById(id);
const t = (key, params) => I18N.t(key, params);

// Number and date formats follow the page's language.
const n = (value) => new Intl.NumberFormat(I18N.locale, { notation: "compact", maximumFractionDigits: 1 }).format(value);
const money = (value) => new Intl.NumberFormat(I18N.locale, { style: "currency", currency: "USD" }).format(value);
const decimal = (value) => new Intl.NumberFormat(I18N.locale, { maximumFractionDigits: 2 }).format(value);
const date = (iso) => new Date(iso).toLocaleDateString(I18N.locale);

function formatAge(isoDate) {
  const days = Math.floor((Date.now() - Date.parse(isoDate)) / 86400000);
  const pick = (count, one, many) => (count === 1 ? t(one) : t(many, { count }));
  if (days < 1) return t("age.today");
  if (days < 30) return pick(days, "age.day", "age.days");
  if (days < 365) return pick(Math.floor(days / 30), "age.month", "age.months");
  return pick(Math.floor(days / 365), "age.year", "age.years");
}

const subscribers = (count) => (count == null ? t("meta.subscribers_hidden") : t("meta.subscribers", { count: n(count) }));
const views = (count) => (count == null ? t("video.views_hidden") : t("video.views", { count: n(count) }));

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

// 9 -> "9×", 2.34 -> "2.3×", 140 -> "140×", in the page's number format.
const num = (x) => new Intl.NumberFormat(I18N.locale, { maximumFractionDigits: x < 10 ? 1 : 0 }).format(x);
const times = (x) => `${num(x)}×`;

function renderVideos(list, videos) {
  fillList(list, videos, (video) => {
    const link = el("a", video.title);
    link.href = video.url;
    link.target = "_blank";
    link.rel = "noopener";
    const parts = [views(video.views), formatAge(video.publishedAt), `${video.channelTitle} (${subscribers(video.channelSubscribers)})`];
    const meta = el("span", parts.join(" · "), "meta");
    // How the video did against its own channel's average (reports built
    // since outliers were added carry this).
    if (video.outlierRatio != null) {
      meta.append(" · ", el("span", t("video.times", { x: num(video.outlierRatio) }), video.outlier ? "ratio" : ""));
    }
    return [link, meta];
  });
}

// A highlighted range box: "<lead> <strong>X to Y views</strong> (middle: Z)."
function rangeBox(box, lead, range, details) {
  const main = el("p");
  main.append(lead, el("strong", t("range.views", { low: n(range.low), high: n(range.high) })), t("range.middle", { middle: n(range.middle) }));
  box.replaceChildren(main, ...details.map((text) => el("p", text, "meta")));
  box.hidden = false;
}

function showIdea(idea, report) {
  $("idea-title").textContent = idea.workingTitle;
  $("idea-text").textContent = idea.idea;
  const parts = [t("meta.checked", { date: date(idea.createdAt) })];
  if (report.channel) parts.push(`${report.channel.title}, ${subscribers(report.channel.subscribers)}`);
  if (idea.lengthMinutes) parts.push(t("meta.minutes", { count: idea.lengthMinutes }));
  if (idea.costUsd) parts.push(money(idea.costUsd));
  if (idea.productionDays) parts.push(t("meta.days_work", { count: idea.productionDays }));
  if (idea.newsTied) parts.push(t(`meta.news.${idea.newsTied}`));
  $("idea-meta").textContent = parts.join(" · ");
  $("link-note").textContent = t(idea.reminder.hasEmail && idea.reminder.emailOn ? "meta.link_emailed" : "meta.bookmark");

  const code = report.youtubeErrorCode;
  $("youtube-error").textContent = !report.youtubeError ? "" : code === "quota" || code === "no_key" ? t(`error.youtube.${code}`) : t("error.youtube.other");
  $("claude-error").textContent = report.claudeError || "";
}

// Is there demand? Videos that beat their own channel's average, hits and misses.
function showDemand(report) {
  const data = report.demand;
  $("demand").hidden = !data;
  if (!data) return;
  const box = $("demand-box");
  if (data.status === "thin") {
    box.replaceChildren(el("p", t("demand.thin", { count: data.videoCount })));
    return;
  }
  const head = el("p");
  head.append(el("span", t(`demand.${data.verdict}`), `verdict ${data.verdict}`));
  box.replaceChildren(head, el("p", t("demand.counts", { outliers: data.outliers, total: data.videoCount, under: data.under, median: num(data.median) }), "meta"));
}

function showSimilar(report) {
  renderVideos($("similar"), report.similarVideos);
  let none = $("similar-none");
  if (!none) {
    none = el("p");
    none.id = "similar-none";
    $("similar").after(none);
  }
  none.textContent = !report.youtubeError && report.similarVideos.length === 0 ? t("s1.none") : "";
}

// The tester's own recent videos (reports from before this existed have none).
function showTrackRecord(report) {
  const record = report.trackRecord;
  const title = document.querySelector('[data-i18n="s2.own_title"]');
  const known = record !== undefined;
  title.hidden = !known;
  $("own-range").hidden = true;
  $("own-details").hidden = true;
  $("own-note").textContent = "";
  if (!known) return;
  if (!record) {
    $("own-note").textContent = report.youtubeError ? t("s2.not_available") : t("s2.own_none");
    return;
  }
  if (record.status === "thin") {
    $("own-note").textContent = t("s2.own_thin", { minimum: record.minimum });
  } else {
    rangeBox($("own-range"), t("s2.own_lead"), record.range, [t("s2.own_details", { count: record.videos.length })]);
  }
  if (record.videos.length) {
    $("own-summary").textContent = t("s2.own_show", { count: record.videos.length });
    renderVideos($("own-videos"), record.videos);
    $("own-details").hidden = false;
  }
}

// Does the idea fit the tester's own channel?
function showFit(report) {
  const fit = report.fit;
  $("fit").hidden = !fit;
  if (!fit) return;
  if (fit.source === "claude") {
    $("fit-text").replaceChildren(el("strong", t(`fit.claude_${fit.level}`)), ` ${fit.reason}`);
    $("fit-note").textContent = t("fit.claude_note");
  } else {
    $("fit-text").textContent = t(`fit.${fit.level}`, { matches: fit.matches, total: fit.total });
    $("fit-note").textContent = t("fit.keywords_note");
  }
}

function showYourSize(data) {
  $("size-range").hidden = true;
  $("estimate").hidden = true;
  $("size-band").textContent = "";
  if (!data) {
    $("size-note").textContent = t("s2.not_available");
    return;
  }
  if (data.band) $("size-band").textContent = t("s2.band", { min: n(data.band.min), max: n(data.band.max) });
  renderVideos($("size-videos"), data.videos);

  if (data.status === "unknown_size") {
    $("size-note").textContent = t("s2.unknown_size");
  } else if (data.status === "thin") {
    const found = data.videos.length;
    $("size-note").textContent =
      t(found === 0 ? "s2.thin_none" : "s2.thin_some", { count: found, minimum: data.minimum }) +
      t(data.searchedDeeper ? "s2.thin_deeper" : "s2.thin_end") +
      t("s2.thin_tip");
    if (data.estimate) showEstimate(data.estimate);
  } else {
    $("size-note").textContent = "";
    const r = data.range;
    rangeBox($("size-range"), t("s2.lead"), r, [t("s2.details", { lowest: n(r.lowest), highest: n(r.highest), count: data.videos.length })]);
  }
}

function showEstimate(data) {
  const per = data.viewsPerSubscriber;
  rangeBox($("estimate-range"), t("s2.estimate_lead"), data.range, [
    t("s2.estimate_details", {
      count: data.videos.length,
      min: n(data.band.min),
      max: n(data.band.max),
      low: decimal(per.low),
      high: decimal(per.high),
    }),
  ]);
  $("estimate-summary").textContent = t("s2.estimate_show", { count: data.videos.length });
  renderVideos($("estimate-videos"), data.videos);
  $("estimate").hidden = false;
}

function showOwnership(data) {
  $("breakthrough-note").textContent = "";
  $("breakthroughs").replaceChildren();
  if (!data) {
    $("ownership").textContent = t("s2.not_available");
    return;
  }
  if (data.status === "thin") {
    $("ownership").textContent = t("s3.thin", { count: data.videoCount });
    return;
  }
  const params = {
    big: t("s3.big", { count: n(data.thresholds.large) }),
    names: data.largeChannels.length ? ` (${data.largeChannels.join(", ")})` : "",
    share: Math.round(data.largeViewShare * 100),
    count: data.videoCount,
  };
  $("ownership").textContent = t(data.dominated ? "s3.dominated" : data.largeChannelCount === 0 ? "s3.none" : "s3.present", params);
  $("breakthrough-note").textContent = data.breakthroughs.length
    ? t("s3.breakthroughs", { count: data.breakthroughs.length, small: n(data.thresholds.small), views: n(data.thresholds.breakthroughViews) })
    : t("s3.no_breakthrough", { small: n(data.thresholds.small) });
  renderVideos($("breakthroughs"), data.breakthroughs);
}

// Related ideas with proven demand: Claude's named ideas when connected,
// otherwise the plain list of videos.
function showRelated(report) {
  const data = report.related;
  $("related").hidden = !data;
  if (!data) return;
  $("related-ideas").replaceChildren();
  $("related-videos").replaceChildren();
  if (data.videos.length === 0) {
    $("related-note").textContent = t("related.none");
    return;
  }
  if (data.ideas && data.ideas.length) {
    $("related-note").textContent = t("related.ai_note");
    fillList($("related-ideas"), data.ideas, (idea) => {
      const list = el("ol", undefined, "videos");
      renderVideos(list, idea.videoNumbers.map((n) => data.videos[n - 1]).filter(Boolean));
      return [
        el("strong", idea.name),
        el("br"),
        el("strong", t("related.why")),
        idea.whyDemand,
        el("br"),
        el("strong", t("related.angle")),
        idea.angle,
        list,
      ];
    });
  } else {
    $("related-note").textContent = t("related.plain");
    renderVideos($("related-videos"), data.videos);
  }
}

function showShelfLife(data, analysis) {
  // The free check gives codes the page can translate; Claude writes text.
  // "1 signal points" / "1 signal indique": singular when exactly one.
  const count = { reason_long: data.reasonParams?.toLong, reason_short: data.reasonParams?.toShort }[data.reasonCode];
  const reasonKey = count === 1 ? `code.${data.reasonCode}_one` : `code.${data.reasonCode}`;
  const reason = data.reasonCode ? t(reasonKey, data.reasonParams) : data.reason;
  $("shelf-life").replaceChildren(el("span", t(`shelf.${data.label}`), "label-tag"), ` ${reason}`);
  fillList($("shelf-signals"), data.signals, (s) => [
    el("strong", `${t(`signal.${s.signal}`)} (${t(`points.${s.pointsTo}`)}): `),
    s.code ? t(`code.${s.code}`, s.params) : s.detail,
  ]);

  const reframes = analysis?.reframes || [];
  $("reframes-block").hidden = reframes.length === 0;
  fillList($("reframes"), reframes, (r) => [r]);

  $("shelf-source").textContent =
    data.source === "rules" ? t("s4.source_rules") + (data.label === "long" ? "" : t("s4.tip")) : t("s4.source_claude");
}

function showCost(idea, report) {
  const box = $("cost");
  if (!idea.costUsd) {
    box.replaceChildren(el("p", t("s5.no_cost")));
    return;
  }
  if (!report.cost) {
    box.replaceChildren(el("p", t("s5.no_range", { cost: money(idea.costUsd) })));
    return;
  }
  const { views: v, perThousandViews: per, basis } = report.cost;
  const fmt = (value) => (value === null ? t("s5.na") : money(value));
  const table = el("table", undefined, "cost-table");
  [
    ["", t("s5.col_views"), t("s5.col_cost")],
    [t("s5.low"), n(v.low), fmt(per.atLowViews)],
    [t("s5.middle"), n(v.middle), fmt(per.atMiddleViews)],
    [t("s5.high"), n(v.high), fmt(per.atHighViews)],
  ].forEach((cells, i) => {
    const tr = el("tr");
    cells.forEach((cell) => tr.append(el(i === 0 ? "th" : "td", cell)));
    table.append(tr);
  });
  box.replaceChildren(el("p", t("s5.your_cost", { cost: money(idea.costUsd) })), table, el("p", t(`s5.basis.${basis}`), "hint"));
}

// Title formats seen among the similar videos, with hits and misses.
function showFormats(report) {
  const data = report.formats;
  $("formats-block").hidden = !data;
  if (!data) return;
  $("formats-intro").textContent = t("formats.intro");
  $("formats-none").textContent = data.status === "thin" ? t("formats.thin") : data.formats.length ? "" : t("formats.none");
  fillList($("formats"), data.status === "thin" ? [] : data.formats, (f) => {
    const link = el("a", `“${f.example.title}”`);
    link.href = f.example.url;
    link.target = "_blank";
    link.rel = "noopener";
    return [
      el("strong", t(`fmt.${f.id}`)),
      el("br"),
      t("formats.row", { count: f.count, outliers: f.outliers, under: f.under }),
      el("br"),
      el("span", t("formats.best"), "meta"),
      link,
      el("span", ` (${t("video.times", { x: num(f.example.outlierRatio) })})`, "meta"),
    ];
  });
}

function showPackaging(analysis) {
  $("packaging-missing").hidden = Boolean(analysis);
  $("packaging-block").hidden = !analysis;
  if (!analysis) return;
  fillList($("packaging"), analysis.packaging, (p) => [el("strong", p.angle), el("br"), t("s6.example", { title: p.exampleTitle }), el("br"), p.reason]);
  const checks = analysis.factChecks.length ? analysis.factChecks : [{ claim: t("s6.no_checks"), why: "" }];
  fillList($("fact-checks"), checks, (f) => [el("strong", f.claim), f.why ? ` ${f.why}` : ""]);
}

// Shows field errors under a small form and focuses the first one.
function showFormErrors(form, fields, errors) {
  for (const field of fields) $(`${field}-error`).textContent = errors[field] || "";
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
  status.textContent = t("common.saving");
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...Object.fromEntries(new FormData(form)), language: I18N.lang }),
    });
    const body = await response.json();
    if (!response.ok) {
      showFormErrors(form, fields, body.errors || {});
      status.textContent = body.error || t("common.fix_fields");
      return null;
    }
    showFormErrors(form, fields, {});
    status.textContent = "";
    return body;
  } catch {
    status.textContent = t("common.no_connection");
    return null;
  } finally {
    button.disabled = false;
  }
}

function showFeedback(idea) {
  const form = $("feedback-form");
  const feedback = idea.feedback;
  if (!feedback) return;
  form.elements.useful.value = feedback.useful;
  form.elements.decision.value = feedback.decision;
  form.elements.comment.value = feedback.comment || "";
  $("feedback-status").textContent = t("s7.thanks", {
    useful: t(feedback.useful === "yes" ? "s7.useful_yes" : "s7.useful_no"),
    decision: t(`s7.decision.${feedback.decision}`),
  });
}

// The range the report gave, from the best evidence it had.
function predictedRange(report) {
  if (report.trackRecord?.range) return { ...report.trackRecord.range, basis: "track_record" };
  if (report.yourSize?.range) return { ...report.yourSize.range, basis: "your_size" };
  if (report.yourSize?.estimate) return { ...report.yourSize.estimate.range, basis: "estimate" };
  return null;
}

// Newer reports give 12-month ranges: scale them to what a video usually
// has after `days`, using the same curve the server used.
function rangeAt(report, range, days) {
  if (report.model?.unit !== "views_12_months") return range;
  const factor = (days / 365) ** report.model.growth;
  return { low: Math.round(range.low * factor), high: Math.round(range.high * factor) };
}

const CHECKPOINT_DAYS = [7, 30, 90];

// Real views as a multiple of the tester's usual: the middle of their own
// recent videos' estimated 12-month views, scaled to that day (same curve as
// the server's). Null when the report has no track record.
function usualMultiple(report, viewCount, days) {
  const middle = report.trackRecord?.range?.middle;
  if (!middle || report.model?.unit !== "views_12_months") return null;
  const usual = middle * (days / 365) ** report.model.growth;
  return usual > 0 ? Math.round((viewCount / usual) * 10) / 10 : null;
}

// The tester's own number for a checkpoint, or else the automatic reading.
function viewsAt(results, day) {
  const typed = results[`views${day}`];
  if (typed != null) return { views: typed, source: t("s8.source_typed") };
  const auto = results.auto?.[day];
  return auto ? { views: auto.views, source: t("s8.source_auto") } : null;
}

function showResults(idea, report) {
  const form = $("results-form");
  const results = idea.results || {};
  const reminder = idea.reminder;

  $("results-intro").textContent = results.notMade
    ? t("s8.intro_not_made")
    : idea.tracking
      ? t("s8.intro_tracking")
      : reminder.hasEmail && reminder.emailOn
        ? reminder.sentAt
          ? t("s8.intro_reminder_sent")
          : t("s8.intro_reminder", { date: date(reminder.dueAt) })
        : t("s8.intro_bookmark");

  form.elements.videoUrl.value = results.videoUrl || "";
  for (const day of CHECKPOINT_DAYS) form.elements[`views${day}`].value = results[`views${day}`] ?? "";
  form.elements.notMade.checked = Boolean(results.notMade);

  const lines = [];
  if (results.video) {
    const v = results.video;
    lines.push(el("p", t("s8.video_line", { title: v.title, age: formatAge(v.publishedAt), views: v.views === null ? "–" : n(v.views), date: date(v.readAt) })));
  }
  if (results.videoError) lines.push(el("p", results.videoError.startsWith("msg.") ? t(results.videoError) : results.videoError, "error"));

  // The automatic readings: done, coming, or missed (the link came too late).
  if (idea.tracking) {
    const list = el("ul");
    for (const point of idea.tracking) {
      const day = point.day;
      let text;
      if (point.reading) text = t("s8.auto_done", { day, views: n(point.reading.views), date: date(point.reading.readAt) });
      else if (Date.now() < Date.parse(point.at)) text = t("s8.auto_planned", { day, date: date(point.at) });
      else if (results[`views${day}`] != null) text = t("s8.auto_typed", { day });
      else if (Date.now() - Date.parse(point.at) < 3 * 86400000) text = t("s8.auto_soon", { day });
      else text = t("s8.auto_missed", { day });
      list.append(el("li", text));
    }
    lines.push(el("p", t("s8.auto_title")), list);
  }

  const range = predictedRange(report);
  const known = CHECKPOINT_DAYS.map((day) => [day, viewsAt(results, day)]).filter(([, v]) => v);
  if (known.length && range) {
    const list = el("ul");
    for (const [day, v] of known) {
      const target = rangeAt(report, range, day);
      const verdict = v.views < target.low ? "below" : v.views > target.high ? "above" : "inside";
      const multiple = usualMultiple(report, v.views, day);
      list.append(
        el("li", t("s8.compare_line", {
          day,
          views: n(v.views),
          source: v.source,
          verdict: t(`s8.verdict.${verdict}`),
          low: n(target.low),
          high: n(target.high),
          basis: t(`s8.basis.${range.basis}`),
          usual: multiple === null ? "" : ` ${t("s8.usual", { x: num(multiple) })}`,
        })),
      );
    }
    const note = report.model?.unit === "views_12_months" ? "s8.compare_note" : "s8.compare_note_old";
    lines.push(el("p", t("s8.compare_title")), list, el("p", t(note), "hint"));
    if (report.trackRecord?.range) lines.push(el("p", t("s8.usual_note"), "hint"));
  } else if (known.length) {
    lines.push(el("p", t("s8.no_range"), "hint"));
  }

  const summary = $("results-summary");
  summary.replaceChildren(...lines);
  summary.hidden = lines.length === 0;
}

let current = null;

function render(idea) {
  current = idea;
  const report = idea.report;
  showIdea(idea, report);
  showDemand(report);
  showSimilar(report);
  showTrackRecord(report);
  showFit(report);
  showYourSize(report.yourSize);
  showOwnership(report.ownership);
  showRelated(report);
  showShelfLife(report.shelfLife, report.analysis);
  showCost(idea, report);
  showFormats(report);
  showPackaging(report.analysis);
  showFeedback(idea);
  showResults(idea, report);
}

function setUpForms(id) {
  $("feedback-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const updated = await postForm(event.target, `/api/ideas/${id}/feedback`, ["useful", "decision", "comment"], $("feedback-status"), $("feedback-submit"));
    if (updated) {
      current = updated;
      showFeedback(updated);
    }
  });
  $("results-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const updated = await postForm(event.target, `/api/ideas/${id}/results`, ["videoUrl", "views7", "views30", "views90", "notMade"], $("results-status"), $("results-submit"));
    if (updated) {
      current = updated;
      showResults(updated, updated.report);
      $("results-status").textContent = t("s8.saved");
    }
  });
}

// ---------- Waiting for a report that is still being built ----------

const STEPS = ["start", "channel", "search", "search_deeper", "compare", "related", "analysis"];

function showProgress(idea) {
  const step = idea.build?.step || "start";
  const reached = STEPS.indexOf(step);
  // Optional steps only show once they happen.
  const shown = STEPS.filter((s, i) => !["search_deeper", "analysis"].includes(s) || i <= reached);
  fillList($("progress-steps"), shown, (s) => {
    const i = STEPS.indexOf(s);
    const state = i < reached ? "done" : i === reached ? "current" : "todo";
    return [el("span", state === "done" ? "✓" : state === "current" ? "…" : "·", `step-mark ${state}`), el("span", t(`progress.${s}`), state)];
  });
  $("progress-failed").hidden = !idea.canRetry;
  $("progress").hidden = false;
}

async function fetchIdea(id) {
  const response = await fetch(`/api/ideas/${encodeURIComponent(id)}?lang=${I18N.lang}`);
  if (response.status === 404) throw new Error(t("progress.not_found"));
  if (!response.ok) throw new Error(t("progress.load_failed"));
  return response.json();
}

async function load() {
  const id = new URLSearchParams(window.location.search).get("id") || "";
  try {
    let idea = await fetchIdea(id);
    $("loading").hidden = true;
    // Still building: show the steps and check again every few seconds.
    while (!idea.report) {
      showProgress(idea);
      if (idea.canRetry) return;
      await new Promise((resolve) => setTimeout(resolve, 2500));
      idea = await fetchIdea(id);
    }
    $("progress").hidden = true;
    render(idea);
    setUpForms(id);
    $("report").hidden = false;
    if (window.location.hash) $(window.location.hash.slice(1))?.scrollIntoView();
  } catch (error) {
    $("loading").hidden = true;
    $("load-error").textContent = error.message || t("progress.load_failed");
    $("lost-link").hidden = false;
  }
}

$("retry").addEventListener("click", async () => {
  $("retry").disabled = true;
  try {
    await fetch(`/api/ideas/${encodeURIComponent(new URLSearchParams(window.location.search).get("id") || "")}/retry`, { method: "POST" });
  } finally {
    $("retry").disabled = false;
    $("progress-failed").hidden = true;
    load();
  }
});

// Switching EN / FR redraws the report in the new language.
I18N.onChange(() => {
  if (current) render(current);
});

load();
