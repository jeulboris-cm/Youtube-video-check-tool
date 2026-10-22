const form = document.getElementById("idea-form");
const submitButton = document.getElementById("submit");
const formStatus = document.getElementById("form-status");
const saved = document.getElementById("saved");
const channelLine = document.getElementById("channel-line");
const youtubeError = document.getElementById("youtube-error");
const videoList = document.getElementById("videos");
const yourSize = document.getElementById("your-size");
const yourSizeBand = document.getElementById("your-size-band");
const yourSizeRange = document.getElementById("your-size-range");
const yourSizeNote = document.getElementById("your-size-note");
const yourSizeVideos = document.getElementById("your-size-videos");
const estimate = document.getElementById("estimate");
const estimateRange = document.getElementById("estimate-range");
const estimateCount = document.getElementById("estimate-count");
const estimateVideos = document.getElementById("estimate-videos");

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
  renderVideos(videoList, videos);
  showYourSize(result.yourSize);
}

function renderVideos(list, videos) {
  list.replaceChildren();
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
    list.append(item);
  }
}

function showEstimate(data) {
  const r = data.range;
  const per = data.viewsPerSubscriber;
  const ratio = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });
  estimateRange.replaceChildren();
  const main = document.createElement("p");
  main.append("If your video does like most similar videos, relative to channel size: ");
  const strong = document.createElement("strong");
  strong.textContent = `${numberFormat.format(r.low)} to ${numberFormat.format(r.high)} views`;
  main.append(strong, ` (middle: ${numberFormat.format(r.middle)}).`);
  const how = document.createElement("p");
  how.className = "meta";
  how.textContent =
    `This is an estimate, not direct evidence from channels your size. Most of the ${data.videos.length} similar videos ` +
    `got ${ratio.format(per.low)} to ${ratio.format(per.high)} views per subscriber of their channel; ` +
    "we applied that to your subscriber count. Bigger and smaller channels can behave differently.";
  estimateRange.append(main, how);
  estimateCount.textContent = data.videos.length;
  renderVideos(estimateVideos, data.videos);
  estimate.hidden = false;
}

function showYourSize(data) {
  yourSize.hidden = !data;
  if (!data) return;
  yourSizeRange.hidden = true;
  estimate.hidden = true;
  yourSizeBand.textContent = data.band
    ? `Similar videos from channels with ${numberFormat.format(data.band.min)} to ${numberFormat.format(data.band.max)} subscribers (half to double your size).`
    : "";
  renderVideos(yourSizeVideos, data.videos);

  if (data.status === "unknown_size") {
    yourSizeNote.textContent =
      "We need your subscriber count to compare with channels your size. Use a channel link like youtube.com/@name, and make sure your subscriber count is public.";
  } else if (data.status === "thin") {
    const found = data.videos.length;
    yourSizeNote.textContent =
      `Not enough data: we found ${found === 0 ? "no" : `only ${found}`} similar video${found === 1 ? "" : "s"} from channels your size, ` +
      `and need at least ${data.minimum} to give a range from channels your size` +
      (data.searchedDeeper ? ", even after searching deeper." : ".") +
      " Naming the specific people, companies or places in your idea can help.";
    if (data.estimate) showEstimate(data.estimate);
  } else {
    const r = data.range;
    yourSizeRange.replaceChildren();
    const main = document.createElement("p");
    main.append("Most of these videos got ");
    const strong = document.createElement("strong");
    strong.textContent = `${numberFormat.format(r.low)} to ${numberFormat.format(r.high)} views`;
    main.append(strong, ` (middle: ${numberFormat.format(r.middle)}).`);
    const extremes = document.createElement("p");
    extremes.className = "meta";
    extremes.textContent = `Lowest: ${numberFormat.format(r.lowest)} · Highest: ${numberFormat.format(r.highest)} · Based on the ${data.videos.length} videos below.`;
    yourSizeRange.append(main, extremes);
    yourSizeRange.hidden = false;
    yourSizeNote.textContent = "";
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
