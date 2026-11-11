const fs = require("fs");
const path = require("path");
const { runAgent, MODEL } = require("./agent");
const { createYouTube } = require("./youtube");
const bank = require("./bank");
const { toMarkdown, toEmailText } = require("./recap");

// One weekly run: research, update the idea bank, write the recap, email it.
//   node src/run.js              normal run
//   node src/run.js --no-email   same, without sending the email
// Writes recaps/<date>.md, idea-bank.json and IDEA-BANK.md, and prints the
// recap's path last (the GitHub workflow posts that file as an issue).

const ROOT = path.join(__dirname, "..");

// Dollars per million tokens: input, cache reads, output. Web search is $10
// per 1,000 searches.
const PRICES = {
  "claude-opus-5-5": [4, 0.2, 20],
  "claude-sonnet-5-5": [2, 0.1, 10],
  "claude-haiku-5-5": [0.1, 0.01, 0.5],
};

function estimateCost(model, usage) {
  const p = PRICES[model];
  if (!p) return null;
  return (usage.inputTokens * p[0] + usage.cachedTokens * p[1] + usage.outputTokens * p[2]) / 1e6 + usage.webSearches * 0.01;
}

async function sendEmail(subject, text) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM, RADAR_EMAIL_TO } = process.env;
  if (!SMTP_HOST || !EMAIL_FROM || !RADAR_EMAIL_TO) return false;
  const nodemailer = require("nodemailer");
  const port = Number(SMTP_PORT) || 587;
  const transport = nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined });
  await transport.sendMail({ from: EMAIL_FROM, to: RADAR_EMAIL_TO, subject, text });
  return true;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set. See topic-radar/README.md.");
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, "config.json"), "utf8"));
  if (!Array.isArray(config.beats) || !config.beats.length) throw new Error("config.json needs at least one beat.");
  const week = new Date().toISOString().slice(0, 10);
  const log = (line) => console.error(line);

  const youtube = createYouTube();
  let ownChannel = null;
  if (config.channelUrl && youtube.available) {
    try {
      ownChannel = await youtube.channelRecent(config.channelUrl);
    } catch (error) {
      log(`Could not read your channel: ${error.message}`);
    }
  }

  const current = bank.load();
  log(`Topic Radar: ${config.beats.length} beats, ${current.ideas.length} ideas in the bank, model ${MODEL}${youtube.available ? "" : ", no YouTube key"}.`);
  const { recap, usage, turns, model } = await runAgent({ config, bankSummary: bank.summary(current), ownChannel, youtube, log });

  bank.merge(current, recap.ideas, week);
  bank.save(current);

  const cost = estimateCost(model, usage);
  const stats = `${turns} steps · ${youtube.unitsUsed()} YouTube units · ${usage.webSearches} web searches · ${usage.inputTokens + usage.cachedTokens} input and ${usage.outputTokens} output tokens on ${model}${cost != null ? ` · about $${cost.toFixed(2)}` : ""}`;
  const markdown = toMarkdown(recap, { week, stats });
  fs.mkdirSync(path.join(ROOT, "recaps"), { recursive: true });
  const file = path.join(ROOT, "recaps", `${week}.md`);
  fs.writeFileSync(file, markdown);
  log(`Done: ${recap.ideas.length} ideas. ${stats}.`);

  if (!process.argv.includes("--no-email")) {
    const link = process.env.RECAP_LINK || "";
    try {
      if (await sendEmail(`Topic Radar: ${recap.ideas.length} ideas for the week of ${week}`, toEmailText(recap, { week, link }))) log("Recap emailed.");
    } catch (error) {
      // The recap is saved either way; a mail problem must not fail the run.
      log(`Email failed: ${error.response || error.message}`);
    }
  }
  console.log(path.relative(process.cwd(), file));
}

main().catch((error) => {
  console.error(`Topic Radar failed: ${error.message}`);
  process.exit(1);
});
