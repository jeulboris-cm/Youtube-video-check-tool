const $ = (id) => document.getElementById(id);
const n = (value) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
const money = new Intl.NumberFormat("en", { style: "currency", currency: "USD" });

// The password is kept for this browser tab only, never in long-term storage.
const KEY = "idea-check-admin";
function savedPassword() {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}
function remember(password) {
  try {
    if (password) sessionStorage.setItem(KEY, password);
    else sessionStorage.removeItem(KEY);
  } catch {
    // Private mode: the password is simply asked again next time.
  }
}

let data = null;

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function tile(value, label) {
  const box = el("div", undefined, "tile");
  box.append(el("strong", String(value)), el("span", label));
  return box;
}

const pct = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : "–");

function showSummary(s) {
  $("tiles").replaceChildren(
    tile(s.checks, "checks"),
    tile(s.feedback, "gave feedback"),
    tile(pct(s.useful, s.feedback), "found it useful"),
    tile(pct(s.decision.changed + s.decision.confirmed, s.feedback), "changed or confirmed a decision"),
    tile(s.withResults, "have real views"),
    tile(s.tracked, "videos followed automatically"),
    tile(s.notMade, "decided not to make it"),
    tile(s.withEmail, "left an email"),
    tile(s.claude.reports ? money.format(s.claude.dollars) : "$0", s.claude.reports
      ? `Claude spend (estimate, ${s.claude.reports} reports, about ${money.format(s.claude.perReport)} each)`
      : "Claude spend (none yet)"),
  );
  const line = (label, t) => {
    const total = t.inside + t.below + t.above;
    return total ? `${label}: ${t.inside} of ${total} inside the range, ${t.below} below, ${t.above} above.` : "";
  };
  $("accuracy").textContent =
    [line("At 30 days", s.at30), line("At 90 days", s.at90)].filter(Boolean).join(" ") ||
    "No real views entered yet, so no accuracy numbers.";
}

const DECISIONS = { changed: "changed the decision", confirmed: "confirmed the decision", no_effect: "no effect on the decision" };
const SHELF = { short: "Short", medium: "Medium", long: "Long" };

function reportUrl(id) {
  return `${location.origin}/report.html?id=${id}`;
}

function checkItem(r) {
  const item = el("li", undefined, "check card");
  const title = el("a", r.workingTitle);
  title.href = reportUrl(r.id);
  title.target = "_blank";
  title.rel = "noopener noreferrer";
  item.append(title, el("p", r.idea, "idea"));

  const facts = [
    new Date(r.createdAt).toLocaleString(),
    r.channelTitle ? `${r.channelTitle} (${r.channelSubscribers == null ? "subscribers hidden" : `${n(r.channelSubscribers)} subscribers`})` : r.channelUrl,
    r.costUsd ? money.format(r.costUsd) : null,
    r.shelfLife ? `Shelf life: ${SHELF[r.shelfLife]}` : null,
    r.range ? `Range: ${n(r.range.low)}–${n(r.range.high)}${r.range.basis === "estimate" ? " (estimate)" : ""}` : "No range",
  ].filter(Boolean);
  item.append(el("p", facts.join(" · "), "meta"));

  if (r.email) {
    const mail = el("a", r.email);
    mail.href = `mailto:${r.email}`;
    const line = el("p", undefined, "meta");
    const status = [r.reportEmailSentAt ? "report link emailed" : "report link not emailed", r.reminderSentAt ? "reminder sent" : null];
    line.append("Email: ", mail, ` (${status.filter(Boolean).join(", ")})`);
    item.append(line);
  }

  item.append(
    el(
      "p",
      r.feedback
        ? `Feedback: ${r.feedback.useful === "yes" ? "useful" : "not useful"}, ${DECISIONS[r.feedback.decision]}.` +
            (r.feedback.comment ? ` "${r.feedback.comment}"` : "")
        : "No feedback yet.",
      r.feedback ? "" : "meta",
    ),
  );

  const views = [["7 days", r.views7, null], ["30 days", r.views30, r.compare30], ["90 days", r.views90, r.compare90]]
    .filter(([, v]) => v != null)
    .map(([label, v, c]) => `${label}: ${n(v)}${c ? ` (${c} range)` : ""}`);
  const status = r.notMade ? " Decided not to make this video." : r.autoTracked ? " Video followed automatically." : "";
  item.append(el("p", (views.length ? `Real views: ${views.join(" · ")}.` : "No real views yet.") + status, views.length || status ? "" : "meta"));

  for (const problem of r.problems) item.append(el("p", problem, "error"));
  return item;
}

function showChecks() {
  const query = $("search").value.trim().toLowerCase();
  const list = data.ideas.filter((r) =>
    !query ||
    [r.workingTitle, r.idea, r.channelTitle, r.channelUrl, r.email].some((v) => (v || "").toLowerCase().includes(query)),
  );
  $("count").textContent = query ? `${list.length} of ${data.ideas.length} checks match.` : `${list.length} checks, newest first.`;
  $("checks").replaceChildren(...list.map(checkItem));
}

// Spreadsheet cells starting with = + - @ could run as formulas; a leading
// apostrophe keeps them as plain text.
function csvCell(value) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv() {
  const header = [
    "Date", "Working title", "Idea", "Channel", "Channel link", "Subscribers", "Email", "Cost (USD)", "Tied to news",
    "Shelf life", "Range basis", "Range low", "Range high", "Useful", "Decision", "Comment",
    "Views 7 days", "Views 30 days", "Views 90 days", "30 days vs range", "90 days vs range", "Not made", "Followed automatically", "Video link", "Report link",
  ];
  const rows = data.ideas.map((r) => [
    r.createdAt, r.workingTitle, r.idea, r.channelTitle, r.channelUrl, r.channelSubscribers, r.email, r.costUsd, r.newsTied,
    r.shelfLife, r.range?.basis, r.range?.low, r.range?.high, r.feedback?.useful, r.feedback?.decision, r.feedback?.comment,
    r.views7, r.views30, r.views90, r.compare30, r.compare90, r.notMade ? "yes" : "", r.autoTracked ? "yes" : "", r.videoUrl, reportUrl(r.id),
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const link = el("a");
  link.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  link.download = `idea-check-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function openDashboard(password) {
  $("login-submit").disabled = true;
  $("login-error").textContent = "";
  try {
    const response = await fetch("/api/admin/ideas", { headers: { Authorization: `Bearer ${password}` } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      remember(null);
      $("login-error").textContent =
        response.status === 404 ? "The owner page is switched off. Set ADMIN_PASSWORD on the server to turn it on." : body.error || "Could not open.";
      $("login").hidden = false;
      $("password").focus();
      return;
    }
    remember(password);
    data = body;
    $("login").hidden = true;
    $("dashboard").hidden = false;
    $("logout").hidden = false;
    showSummary(data.summary);
    showChecks();
  } catch {
    $("login-error").textContent = "Could not reach the server. Check your connection and try again.";
  } finally {
    $("login-submit").disabled = false;
  }
}

$("login").addEventListener("submit", (event) => {
  event.preventDefault();
  openDashboard($("password").value);
});
$("search").addEventListener("input", showChecks);
$("download").addEventListener("click", downloadCsv);
$("logout").addEventListener("click", () => {
  remember(null);
  location.reload();
});

const saved = savedPassword();
if (saved) openDashboard(saved);
else $("password").focus();
