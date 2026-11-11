const Anthropic = require("@anthropic-ai/sdk");
const { searchNews } = require("./news");

// The agent itself: Claude with a few research tools, working in a loop
// until it hands in the week's recap with the submit_recap tool.
//
// Tools:
//   news_search         this week's headlines on any subject (free)
//   youtube_recent_hits the most-watched recent videos on a subject, and which
//                       beat their channel's usual views (demand, ~102 units)
//   youtube_coverage    how much already exists on a story (saturation, ~102 units)
//   web_search          Anthropic's web search, to dig into a story and check
//                       there is enough material for a full documentary
//   submit_recap        hands in the finished recap (ends the run)

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";
const EFFORT = process.env.CLAUDE_EFFORT || "medium";
// Haiku has no server-side fallback; the other models retry a wrongly
// declined request on another model instead of failing.
const FALLBACK = !MODEL.startsWith("claude-haiku");
const MAX_TURNS = 40;
const MAX_WEB_SEARCHES = 15;

const SYSTEM = `You are Topic Radar, the research agent of a faceless YouTube documentary channel. Once a week you find the stories the channel should consider making next, and you hand in a ranked recap with the submit_recap tool.

What makes a good idea for this channel:
- Real audience demand, shown on YouTube: recent videos on the subject that beat their own channel's usual views (timesChannelAverage of 3 or more is an outlier; it means people chose the subject, not just the channel). Hits and misses both count. Never claim demand from one or two videos.
- Room left: the story is not already covered to death, or the channel can take a clearly different angle. Many videos in the last 90 days with weak results, or big channels taking most of the views, means crowded.
- Staying power: a story built on a mechanism (how a fraud worked, why a country keeps doing something, how a spy network operated) keeps getting views for years. Pure breaking news fades in weeks; only recommend it when the channel can publish while it is hot, and say so.
- Works as a faceless documentary: enough material (archive footage, maps, documents, court filings, reporting from several outlets) for 20 to 40 minutes. A story with one thin source is not ready.
- Fits the channel's description and, if given, its recent videos.

How to work:
1. Read the headlines you are given for each beat. Use news_search for more, for example to follow a story or check whether it is still developing.
2. Use youtube_recent_hits on each beat (short search terms work best, for example "espionage" or "corporate fraud") to see what audiences are watching now. Spend roughly half the YouTube budget here, half on step 4.
3. Shortlist candidate stories: from the news, from the outliers, and from ideas in the idea bank that are still relevant. A story that keeps coming back week after week (weeksSeen) is a good sign.
4. For each serious candidate, run youtube_coverage with 2 to 5 key words for the story itself (for example "Wirecard fraud", not a full sentence) to measure competition. Use web_search to check the facts and the depth of material on your best candidates.
5. Call submit_recap with the ideas ranked best first.

Rules:
- Every number you cite must come from a tool result. If YouTube data is unavailable, say demand is unknown; do not guess.
- When a story matches an idea in the idea bank, put that idea's bankId on it. Do not recommend ideas whose status is "made" or "dismissed" unless something major changed, and then say what.
- Verdicts: "strong" = clear demand and room left; "promising" = good signs but one open question; "risky" = interesting but crowded, thin or likely to fade. Prefer fewer, better ideas over filler.
- Sources must be links you actually saw in tool results.
- Write plainly for a busy creator: short sentences, no hype. Allegations stay allegations: list claims to verify, never state them as proven.
- Call submit_recap exactly once, at the end. It is the only way your work is saved.`;

const IDEA = {
  type: "object",
  additionalProperties: false,
  required: ["bankId", "title", "beat", "story", "verdict", "whyNow", "demandEvidence", "competition", "competitionDetail", "shelfLife", "angle", "titleIdeas", "facelessMaterial", "sources", "checkBeforePublishing"],
  properties: {
    bankId: { type: ["string", "null"], description: "bankId of the matching idea-bank entry, or null for a new idea" },
    title: { type: "string", description: "Short working name of the idea" },
    beat: { type: "string" },
    story: { type: "string", description: "What the story is, in 2 or 3 sentences" },
    verdict: { type: "string", enum: ["strong", "promising", "risky"] },
    whyNow: { type: "string", description: "Why this week: news hook, anniversary, trend" },
    demandEvidence: { type: "string", description: "Numbers from youtube_recent_hits / youtube_coverage, or 'unknown'" },
    competition: { type: "string", enum: ["open", "busy", "crowded", "unknown"] },
    competitionDetail: { type: "string" },
    shelfLife: { type: "string", enum: ["evergreen", "months", "weeks"] },
    angle: { type: "string", description: "The angle that sets this channel's video apart" },
    titleIdeas: { type: "array", items: { type: "string" } },
    facelessMaterial: { type: "string", description: "What visuals and sources a faceless video could use" },
    sources: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["title", "url"], properties: { title: { type: "string" }, url: { type: "string" } } },
    },
    checkBeforePublishing: { type: "array", items: { type: "string" }, description: "Claims and legal risks to verify" },
  },
};

const TOOLS = [
  {
    name: "news_search",
    description: "Recent news headlines (title, outlet, date, link) matching a search, newest first. Free. Use short searches, for example 'Wirecard' or 'spy arrested Germany'.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["query"],
      properties: { query: { type: "string" }, days: { type: "integer", description: "1 to 30, default 7" } },
    },
  },
  {
    name: "youtube_recent_hits",
    description: "The most-watched long YouTube videos on a subject published in the last N days, with views, channel size and timesChannelAverage (views divided by the channel's average views per video). Shows what audiences watch right now. Costs about 102 of the run's YouTube units.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["query"],
      properties: { query: { type: "string" }, days: { type: "integer", description: "7 to 90, default 30" } },
    },
  },
  {
    name: "youtube_coverage",
    description: "How much YouTube already has on one story: the 50 most relevant long videos of any age, how many came out in the last 14 and 90 days, median views, outliers, the share of views going to channels over 1M subscribers, the top and newest videos. Costs about 102 of the run's YouTube units. Use 2 to 5 key words.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["query"],
      properties: { query: { type: "string" } },
    },
  },
  {
    name: "submit_recap",
    description: "Hand in the finished weekly recap. Call once, at the end. Ideas ranked best first.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["weekSummary", "ideas", "watchlist", "skipped"],
      properties: {
        weekSummary: { type: "string", description: "3 to 5 sentences: what moved this week across the beats, and what audiences are watching" },
        ideas: { type: "array", items: IDEA },
        watchlist: {
          type: "array",
          description: "Developing stories not ready yet: what to wait for",
          items: { type: "object", additionalProperties: false, required: ["story", "why"], properties: { story: { type: "string" }, why: { type: "string" } } },
        },
        skipped: {
          type: "array",
          description: "Popular stories you advise against, and why (crowded, fading, thin)",
          items: { type: "object", additionalProperties: false, required: ["story", "reason"], properties: { story: { type: "string" }, reason: { type: "string" } } },
        },
      },
    },
  },
  { type: "web_search_20260209", name: "web_search", max_uses: MAX_WEB_SEARCHES },
];

const clampInt = (value, low, high, fallback) => (Number.isInteger(value) ? Math.max(low, Math.min(high, value)) : fallback);
const text = (value) => (typeof value === "string" ? value.trim().slice(0, 200) : "");

async function runTool(name, input, { youtube, language, log }) {
  const query = text(input?.query);
  if (!query) return { error: "query is required." };
  if (name === "news_search") {
    const days = clampInt(input.days, 1, 30, 7);
    log(`  news: "${query}" (${days} days)`);
    const items = await searchNews(query, { days, language, max: 20 });
    return { query, days, headlines: items };
  }
  if (name === "youtube_recent_hits") {
    const days = clampInt(input.days, 7, 90, 30);
    log(`  YouTube hits: "${query}" (${days} days)`);
    return youtube.recentHits(query, { days, language });
  }
  if (name === "youtube_coverage") {
    log(`  YouTube coverage: "${query}"`);
    return youtube.coverage(query, { language });
  }
  return { error: `Unknown tool ${name}.` };
}

// The first message: the date, the channel, the idea bank and this week's
// headlines for every beat (fetched up front, as they are free).
async function briefing({ config, bankSummary, ownChannel, youtube, log }) {
  const language = config.language || "en";
  const beats = [];
  for (const beat of config.beats) {
    const headlines = [];
    for (const q of beat.news || []) {
      try {
        headlines.push(...(await searchNews(q, { days: 7, language, max: 12 })));
      } catch (error) {
        log(`  news for "${q}" failed: ${error.message}`);
      }
    }
    const seen = new Set();
    beats.push({
      beat: beat.name,
      suggestedYouTubeSearches: beat.youtube || [],
      headlines: headlines.filter((h) => !seen.has(h.title) && seen.add(h.title)).slice(0, 30),
    });
  }
  const input = {
    today: new Date().toISOString().slice(0, 10),
    channel: { description: config.channelDescription, ...(ownChannel ? { name: ownChannel.title, subscribers: ownChannel.subscribers, recentVideos: ownChannel.recentVideos } : {}) },
    ideasWanted: config.ideasPerWeek || 10,
    youtube: youtube.available ? { budgetUnits: youtube.budget, note: "Each YouTube tool call costs about 102 units." } : { available: false, note: "No YouTube key: demand and competition are unknown this week. Rely on news and web search, and say so." },
    ideaBank: bankSummary,
    beats,
  };
  return `Here is this week's briefing as JSON. Research, then call submit_recap.${language === "fr" ? " Write every text in French." : ""}\n\n${JSON.stringify(input, null, 1)}`;
}

function checkResponse(response) {
  if (response.stop_reason === "refusal") throw new Error("Claude declined to continue this run.");
  if (response.stop_reason === "max_tokens") throw new Error("Claude's answer was cut off (max_tokens).");
}

async function runAgent({ config, bankSummary, ownChannel, youtube, log = console.log }) {
  const client = new Anthropic();
  const language = config.language || "en";
  const messages = [{ role: "user", content: await briefing({ config, bankSummary, ownChannel, youtube, log }) }];
  const usage = { inputTokens: 0, cachedTokens: 0, outputTokens: 0, webSearches: 0 };
  let nudges = 0;

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    const response = await client.beta.messages
      .stream({
        model: MODEL,
        max_tokens: 64000,
        ...(FALLBACK ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {}),
        // Caches the conversation so far, so each turn only pays full price
        // for what is new.
        cache_control: { type: "ephemeral" },
        system: SYSTEM,
        tools: TOOLS,
        output_config: { effort: EFFORT },
        messages,
      })
      .finalMessage();
    usage.inputTokens += response.usage.input_tokens + (response.usage.cache_creation_input_tokens || 0);
    usage.cachedTokens += response.usage.cache_read_input_tokens || 0;
    usage.outputTokens += response.usage.output_tokens;
    usage.webSearches += response.usage.server_tool_use?.web_search_requests || 0;
    checkResponse(response);
    messages.push({ role: "assistant", content: response.content });

    // Web search hit its server-side step limit: send it back to continue.
    if (response.stop_reason === "pause_turn") continue;

    const calls = response.content.filter((b) => b.type === "tool_use");
    const submit = calls.find((c) => c.name === "submit_recap");
    if (submit) return { recap: submit.input, usage, turns: turn, model: response.model };

    if (!calls.length) {
      if (++nudges > 2) throw new Error("The agent stopped without handing in a recap.");
      messages.push({ role: "user", content: "Please finish now: call submit_recap with your ranked ideas." });
      continue;
    }

    const results = await Promise.all(
      calls.map(async (call) => {
        try {
          const result = await runTool(call.name, call.input, { youtube, language, log });
          return { type: "tool_result", tool_use_id: call.id, content: JSON.stringify(result) };
        } catch (error) {
          return { type: "tool_result", tool_use_id: call.id, content: error.message, is_error: true };
        }
      }),
    );
    // Near the end, ask it to wrap up so the run never ends empty-handed.
    const content = turn >= MAX_TURNS - 3 ? [...results, { type: "text", text: "You are almost out of steps: call submit_recap now." }] : results;
    messages.push({ role: "user", content });
  }
  throw new Error(`The agent did not finish within ${MAX_TURNS} steps.`);
}

module.exports = { runAgent, MODEL, TOOLS, SYSTEM };
