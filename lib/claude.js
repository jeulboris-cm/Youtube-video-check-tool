const Anthropic = require("@anthropic-ai/sdk");

// Asks Claude for the judgement parts of the report: the shelf-life label,
// a reframe when the idea is news-tied, packaging suggestions, and claims
// to verify. Each call costs a few cents, billed to the API key's account.

// Which Claude model writes the advice. Set CLAUDE_MODEL to change it:
// claude-opus-5-5 (best, about $4 / $20 per million tokens in / out),
// claude-sonnet-5-5 ($2 / $10) or claude-haiku-5-5 (cheapest, $0.10 / $0.50).
const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";
// Haiku has no server-side fallback; the others retry a wrongly declined
// request on another model instead of failing.
const FALLBACK = !MODEL.startsWith("claude-haiku");
// "medium" keeps the cost per report low; "high" thinks longer and costs more.
const EFFORT = process.env.CLAUDE_EFFORT || "medium";

class ClaudeError extends Error {}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["shelfLife", "reframes", "packaging", "factChecks", "relatedIdeas", "channelFit"],
  properties: {
    shelfLife: {
      type: "object",
      additionalProperties: false,
      required: ["label", "reason", "signals"],
      properties: {
        label: { type: "string", enum: ["short", "medium", "long"] },
        reason: { type: "string" },
        signals: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["signal", "pointsTo", "detail"],
            properties: {
              signal: { type: "string", enum: ["wording", "older_competitors", "tester_answer", "search_interest"] },
              pointsTo: { type: "string", enum: ["short", "long", "unclear"] },
              detail: { type: "string" },
            },
          },
        },
      },
    },
    reframes: { type: "array", items: { type: "string" } },
    packaging: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["angle", "exampleTitle", "reason"],
        properties: {
          angle: { type: "string" },
          exampleTitle: { type: "string" },
          reason: { type: "string" },
        },
      },
    },
    factChecks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["claim", "why"],
        properties: {
          claim: { type: "string" },
          why: { type: "string" },
        },
      },
    },
    relatedIdeas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "whyDemand", "angle", "videoNumbers"],
        properties: {
          name: { type: "string" },
          whyDemand: { type: "string" },
          angle: { type: "string" },
          videoNumbers: { type: "array", items: { type: "integer" } },
        },
      },
    },
    channelFit: {
      type: "object",
      additionalProperties: false,
      required: ["level", "reason"],
      properties: {
        level: { type: "string", enum: ["close", "partial", "far", "unknown"] },
        reason: { type: "string" },
      },
    },
  },
};

const SYSTEM = `You help YouTube creators of high-effort videos (documentaries, investigations, animated explainers) decide whether a video idea is worth weeks of work and several hundred dollars. You receive one idea and data on similar YouTube videos. You return a shelf-life judgement, reframes, packaging suggestions and claims to verify.

Shelf life asks one question: will people still search for and click this video in a year? An idea tied to a mechanism (how something works, why something keeps happening) lasts. An idea tied to a news event fades in weeks.
- label "short" means weeks, "medium" months, "long" years.
- Judge from these signals and report each one you can assess:
  - wording: dates, "new report", "just", "breaking", a person's latest move point to short; a system, a process, a recurring question point to long.
  - older_competitors: similar videos older than 6 months with almost no views point to short; videos older than a year that still collected many views point to long. Use the ages and views given.
  - tester_answer: whether the creator said the idea is tied to a recent news event.
  - search_interest: no search-trend data is available yet. Do not guess it; leave it out.
- The reason is one plain sentence that names the signals that decided it. The label is a judgement, so say what it rests on.

Reframes: when the label is short or medium, give one or two versions of the same story framed around the mechanism, so it lasts longer. Example: "How AI turns phone data into a file on every citizen" instead of "Claude used to monitor 25M SIM cards". When the label is long, return an empty list.

Packaging: give two or three angle or title directions, each with an example title and the reason it could work. Base reasons on what the similar videos show (which framings and channels got views) where you can, and say so when you do. Do not score or rate titles.

Fact checks: list the factual claims in the idea or working title, about a person, company, event or number, that the creator should verify before publishing. Never state such a claim as confirmed. Facts that only appear in the similar videos' titles are not confirmed either. Return an empty list if there are none.

Demand evidence: each similar video comes with timesChannelAverage, how many times its views beat that channel's average views per video (null when unknown). A video well above 1 shows people chose the subject itself, not just that a big channel posted it; a video below 0.5 is a miss. When you give packaging reasons, use these hits AND misses, and never claim a pattern from one or two videos. If a title framing worked, say that the framing is only part of why (thumbnail, structure and delivery matter too).

Related ideas: relatedVideos lists numbered videos that beat their own channel's average on channels that did well on this subject. Group them into two to four related ideas the creator could make next, each with a short name, why there is proven demand (cite the numbers shown, never invent any), and one concrete angle for this creator. List the numbers of the videos behind each idea in videoNumbers, and only use numbers that exist. If relatedVideos is empty, return an empty list.

Channel fit: creatorRecentTitles are the titles of the creator's recent videos. Judge whether this idea fits what their audience already watches: "close", "partial" or "far", with a one-sentence reason. A far idea is not bad, but it can bring the wrong viewers, so say what to check. Use "unknown" if there are no recent titles.

Write in plain English for a non-technical creator. Keep each text short.`;

function formatVideo(v, now) {
  const ageDays = Math.floor((now - Date.parse(v.publishedAt)) / 86400000);
  return {
    title: v.title,
    channel: v.channelTitle,
    channelSubscribers: v.channelSubscribers,
    views: v.views,
    ageDays,
    lengthMinutes: v.durationSeconds ? Math.round(v.durationSeconds / 60) : null,
    timesChannelAverage: v.outlierRatio ?? null,
  };
}

const NEWS_TIED = { yes: "yes", no: "no", not_sure: "not sure" };

function buildPrompt(idea, similarVideos, yourSize, extra = {}) {
  const now = Date.now();
  const input = {
    idea: idea.idea,
    workingTitle: idea.workingTitle,
    plannedLengthMinutes: idea.lengthMinutes,
    tiedToRecentNews: idea.newsTied ? NEWS_TIED[idea.newsTied] : "not answered",
    creatorSubscribers: idea.channelSubscribers,
    similarVideos: similarVideos.map((v) => formatVideo(v, now)),
    relatedVideos: (extra.related || []).map((v, i) => ({ number: i + 1, ...formatVideo(v, now) })),
    creatorRecentTitles: extra.recentTitles || [],
    channelsCreatorSize:
      yourSize?.status === "ok"
        ? { videoCount: yourSize.videos.length, typicalViews: yourSize.range }
        : yourSize?.estimate
          ? { estimateOnly: true, typicalViews: yourSize.estimate.range }
          : null,
  };
  return `Here is the idea and the YouTube data, as JSON. Similar videos are most relevant first; ageDays is days since publishing.\n\n${JSON.stringify(input, null, 2)}`;
}

let client;

function isConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// `extra` is { related: videos that beat their channel's average, recentTitles }.
async function analyzeIdea(idea, similarVideos, yourSize, extra = {}) {
  if (!isConfigured()) throw new ClaudeError("The Claude API key is not set on the server yet.");
  client ??= new Anthropic();

  let response;
  try {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // If Claude's safety checks decline the request, retry it on the
      // model Anthropic recommends instead of failing.
      ...(FALLBACK ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {}),
      system: SYSTEM,
      output_config: { effort: EFFORT, format: { type: "json_schema", schema: SCHEMA } },
      messages: [
        {
          role: "user",
          content:
            buildPrompt(idea, similarVideos, yourSize, extra) +
            (idea.language === "fr" ? "\n\nThe creator reads French: write every text value in French." : ""),
        },
      ],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) throw new ClaudeError("The Claude API key was not accepted.");
    if (error instanceof Anthropic.RateLimitError) throw new ClaudeError("Claude is busy right now. Try again in a minute.");
    if (error instanceof Anthropic.APIError) throw new ClaudeError(`Claude returned an error (${error.status}).`);
    throw error;
  }

  if (response.stop_reason === "refusal") throw new ClaudeError("Claude declined to analyse this idea.");
  if (response.stop_reason === "max_tokens") throw new ClaudeError("Claude's answer was cut off. Try again.");
  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw new ClaudeError("Claude returned an empty answer.");

  const result = JSON.parse(text);
  // Only keep related ideas that point at videos we really showed Claude.
  const count = (extra.related || []).length;
  result.relatedIdeas = (result.relatedIdeas || [])
    .map((idea) => ({ ...idea, videoNumbers: [...new Set(idea.videoNumbers)].filter((n) => Number.isInteger(n) && n >= 1 && n <= count) }))
    .filter((idea) => idea.videoNumbers.length > 0);

  return {
    ...result,
    model: response.model,
    usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
  };
}

module.exports = { analyzeIdea, isConfigured, buildPrompt, ClaudeError, MODEL };
