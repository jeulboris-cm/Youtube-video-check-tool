const $ = (id) => document.getElementById(id);
const t = (key, params) => I18N.t(key, params);
const query = new URLSearchParams(window.location.search);
const id = query.get("id") || "";
const token = query.get("t") || "";
let state = "loading"; // loading | ask | done | bad
let title = "";

function draw() {
  $("error").textContent = state === "bad" ? t("unsub.bad") : "";
  $("title").hidden = state === "bad";
  $("body").textContent = state === "ask" ? t("unsub.body", { title }) : state === "done" ? t("unsub.done") : "";
  $("confirm").hidden = state !== "ask";
}

async function start() {
  try {
    const response = await fetch(`/api/watch/${encodeURIComponent(id)}?t=${encodeURIComponent(token)}&lang=${I18N.lang}`);
    if (!response.ok) throw new Error("bad");
    const body = await response.json();
    title = body.title;
    state = body.on ? "ask" : "done";
  } catch {
    state = "bad";
  }
  draw();
}

$("confirm").addEventListener("click", async () => {
  $("confirm").disabled = true;
  try {
    const response = await fetch(`/api/watch/${encodeURIComponent(id)}/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ t: token }),
    });
    state = response.ok ? "done" : "bad";
  } catch {
    state = "bad";
  }
  $("confirm").disabled = false;
  draw();
});

I18N.onChange(draw);
start();
