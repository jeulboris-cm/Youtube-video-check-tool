const form = document.getElementById("idea-form");
const submitButton = document.getElementById("submit");
const formStatus = document.getElementById("form-status");
const saved = document.getElementById("saved");
const channelLine = document.getElementById("channel-line");
const youtubeError = document.getElementById("youtube-error");
const videoList = document.getElementById("videos");

const FIELDS = ["idea", "workingTitle", "channelUrl", "lengthMinutes", "costUsd", "productionDays", "newsTied"];

function showErrors(errors) {
  for (const field of FIELDS) {
    const message = errors[field] || "";
    document.getElementById(`${field}-error`).textContent = message;
    const input = form.elements[field];
    if (input && input.setAttribute) input.setAttribute("aria-invalid", message ? "true" : "false");
  }
  const first = FIELDS.find((f) => errors[f]);
  if (first) {
    const input = form.elements[first];
    (input.focus ? input : input[0]).focus();
  }
}

const numberFormat = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function formatCount(n, noun) {
  if (n === null || n === undefined) return `${noun} hidden`;
  return `${numberFormat.format(n)} ${noun}`;
}

function formatAge(isoDate) {
  const days = Math.floor((Date.now() - Date.parse(isoDate)) / 86400000);
  const plural = (n, unit) => `${n} ${unit}${n === 1 ? "" : "s"} ago`;
  if (days < 1) return "today";
  if (days < 30) return plural(days, "day");
  if (days < 365) return plural(Math.floor(days / 30), "month");
  return plural(Math.floor(days / 365), "year");
}

function showResults(result) {
  if (result.channel) {
    channelLine.textContent = `Your channel: ${result.channel.title}, ${formatCount(result.channel.subscribers, "subscribers")}.`;
  } else if (result.youtubeError) {
    channelLine.textContent = "";
  } else {
    channelLine.textContent = "We could not read your channel's subscriber count from that link. Links like youtube.com/@name work best.";
  }

  youtubeError.textContent = result.youtubeError || "";
  videoList.replaceChildren();
  const videos = result.similarVideos || [];
  if (!result.youtubeError && videos.length === 0) {
    youtubeError.textContent = "No similar videos found on YouTube for this idea.";
  }
  for (const video of videos) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = video.url;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = video.title;
    const meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = [
      formatCount(video.views, "views"),
      formatAge(video.publishedAt),
      `${video.channelTitle} (${formatCount(video.channelSubscribers, "subscribers")})`,
    ].join(" · ");
    item.append(link, meta);
    videoList.append(item);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));

  submitButton.disabled = true;
  formStatus.textContent = "Saving and searching YouTube…";
  try {
    const response = await fetch("/api/ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = await response.json();
    if (!response.ok) {
      showErrors(body.errors || {});
      formStatus.textContent = "Please fix the highlighted fields.";
      return;
    }
    showErrors({});
    formStatus.textContent = "";
    showResults(body);
    form.hidden = true;
    saved.hidden = false;
  } catch {
    formStatus.textContent = "Could not save. Check your connection and try again.";
  } finally {
    submitButton.disabled = false;
  }
});

document.getElementById("another").addEventListener("click", () => {
  form.reset();
  saved.hidden = true;
  form.hidden = false;
  form.elements.idea.focus();
});
