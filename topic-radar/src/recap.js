// Turns the agent's recap into the weekly Markdown file (also used for the
// GitHub issue) and a plain-text email.

const VERDICT_LABEL = { strong: "Strong", promising: "Promising", risky: "Risky" };
const SHELF_LABEL = { evergreen: "evergreen (years)", months: "months", weeks: "weeks (news window)" };

function toMarkdown(recap, { week, stats }) {
  const lines = [`# Topic Radar: week of ${week}`, "", recap.weekSummary, ""];
  const counts = ["strong", "promising", "risky"].map((v) => `${recap.ideas.filter((i) => i.verdict === v).length} ${v}`).join(", ");
  lines.push(`**${recap.ideas.length} ${recap.ideas.length === 1 ? "idea" : "ideas"}** (${counts}). Ranked best first.`, "");

  recap.ideas.forEach((idea, n) => {
    const again = idea.weeksSeen > 1 ? ` · seen ${idea.weeksSeen} weeks` : " · new";
    lines.push(`## ${n + 1}. ${idea.title}`, "", `**${VERDICT_LABEL[idea.verdict] || idea.verdict}** · ${idea.beat} · competition: ${idea.competition} · shelf life: ${SHELF_LABEL[idea.shelfLife] || idea.shelfLife}${again}`, "");
    lines.push(idea.story, "");
    lines.push(`- **Why now:** ${idea.whyNow}`);
    lines.push(`- **Demand on YouTube:** ${idea.demandEvidence}`);
    lines.push(`- **Competition:** ${idea.competitionDetail}`);
    lines.push(`- **Your angle:** ${idea.angle}`);
    lines.push(`- **Faceless material:** ${idea.facelessMaterial}`);
    if (idea.titleIdeas.length) lines.push(`- **Title ideas:** ${idea.titleIdeas.map((t) => `"${t}"`).join(" · ")}`);
    if (idea.checkBeforePublishing.length) lines.push(`- **Check before publishing:** ${idea.checkBeforePublishing.join("; ")}`);
    if (idea.sources.length) lines.push(`- **Sources to start with:** ${idea.sources.map((s) => `[${s.title.replace(/[[\]]/g, "")}](${s.url})`).join(" · ")}`);
    lines.push(`- Idea bank id: \`${idea.bankId}\``, "");
  });

  if (recap.watchlist.length) {
    lines.push("## Watchlist: not ready yet", "");
    for (const w of recap.watchlist) lines.push(`- **${w.story}:** ${w.why}`);
    lines.push("");
  }
  if (recap.skipped.length) {
    lines.push("## Popular, but skip", "");
    for (const s of recap.skipped) lines.push(`- **${s.story}:** ${s.reason}`);
    lines.push("");
  }
  lines.push("---", "", `_${stats}_`, "", "To shortlist, mark as made or dismiss an idea, change its `status` in `topic-radar/idea-bank.json`. Demand and competition come from YouTube search samples, so treat them as strong clues, not proof.", "");
  return lines.join("\n");
}

function toEmailText(recap, { week, link }) {
  const lines = [`Topic Radar, week of ${week}`, "", recap.weekSummary, ""];
  recap.ideas.forEach((idea, n) => {
    lines.push(`${n + 1}. ${idea.title} [${VERDICT_LABEL[idea.verdict] || idea.verdict}, competition ${idea.competition}, shelf life ${idea.shelfLife}]`);
    lines.push(`   ${idea.story}`);
    lines.push(`   Demand: ${idea.demandEvidence}`);
    lines.push(`   Angle: ${idea.angle}`);
    if (idea.titleIdeas[0]) lines.push(`   Title idea: "${idea.titleIdeas[0]}"`);
    lines.push("");
  });
  if (recap.watchlist.length) lines.push("Watchlist:", ...recap.watchlist.map((w) => `- ${w.story}: ${w.why}`), "");
  if (recap.skipped.length) lines.push("Popular, but skip:", ...recap.skipped.map((s) => `- ${s.story}: ${s.reason}`), "");
  if (link) lines.push(`Full recap with sources: ${link}`, "");
  return lines.join("\n");
}

module.exports = { toMarkdown, toEmailText };
