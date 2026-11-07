const $ = (id) => document.getElementById(id);
const t = (key, params) => I18N.t(key, params);
const n = (v) => new Intl.NumberFormat(I18N.locale, { notation: "compact", maximumFractionDigits: 1 }).format(v);
const money = (v) => new Intl.NumberFormat(I18N.locale, { style: "currency", currency: "USD" }).format(v);

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

let last = null;

function card(row, index) {
  const item = el("li", undefined, "card compare-item");
  const head = el("h2");
  head.append(el("span", String(index + 1), "num"), " ", row.workingTitle);
  item.append(head);
  item.append(
    el(
      "p",
      row.range ? t("compare.range", { low: n(row.range.low), middle: n(row.range.middle), high: n(row.range.high) }) : t("compare.no_range"),
      row.range ? "" : "meta",
    ),
  );
  if (row.costUsd) item.append(el("p", t("compare.cost", { cost: money(row.costUsd), per: row.perThousand == null ? "–" : money(row.perThousand) }), "meta"));
  const signs = el("p", undefined, "meta");
  signs.append(`${t("compare.signs")}: `);
  const tags = [];
  if (row.demand) tags.push(t(`demand.${row.demand}`));
  if (row.saturation) tags.push(t(`sat.${row.saturation}`));
  if (row.shelfLife) tags.push(t(`shelf.${row.shelfLife}`));
  signs.append(tags.join(" · ") || "–");
  item.append(signs);

  const actions = el("p");
  const open = el("a", t("compare.open"));
  open.href = `/report.html?id=${encodeURIComponent(row.id)}&lang=${I18N.lang}`;
  const remove = el("button", t("compare.remove"), "secondary small");
  remove.type = "button";
  remove.addEventListener("click", () => {
    Mine.remove(row.id);
    load();
  });
  actions.append(open, " ", remove);
  item.append(actions);
  return item;
}

function show(data) {
  last = data;
  $("basis").textContent = t(`compare.basis.${data.basis}`);
  $("rows").replaceChildren(...data.rows.map(card));
}

async function load() {
  const ids = Mine.ids();
  $("error").textContent = "";
  $("rows").replaceChildren();
  $("basis").textContent = "";
  last = null;
  if (ids.length < 2) {
    $("status").hidden = false;
    $("status").textContent = t("compare.none");
    return;
  }
  $("status").hidden = true;
  try {
    const response = await fetch(`/api/compare?lang=${I18N.lang}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    const body = await response.json();
    if (!response.ok) {
      $("status").hidden = false;
      $("status").textContent = body.error || t("compare.none");
      return;
    }
    show(body);
  } catch {
    $("error").textContent = t("watch.error");
  }
}

$("add-form").addEventListener("submit", (event) => {
  event.preventDefault();
  $("add-error").textContent = "";
  let id = "";
  try {
    id = new URL($("add-link").value.trim()).searchParams.get("id") || "";
  } catch {
    id = $("add-link").value.trim();
  }
  if (!Mine.valid(id)) {
    $("add-error").textContent = t("compare.add_bad");
    return;
  }
  Mine.add(id);
  $("add-link").value = "";
  load();
});

I18N.onChange(() => (last ? show(last) : load()));
load();
