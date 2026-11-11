# Topic Radar

A research agent for a faceless documentary channel (geopolitics, business
scandals, espionage, current affairs). Once a week it looks for the stories
your audience actually wants, checks they are not already covered to death,
keeps the good ones in an **idea bank** and sends you a **weekly recap**.

It is separate from Idea Check: its own folder, its own dependencies, its own
schedule. It needs no server; GitHub runs it for free every Monday.

## What it does each week

1. **Reads the week's news** on each of your beats (Google News, free).
2. **Checks demand on YouTube:** the most-watched recent videos on each beat,
   and which ones beat their own channel's usual views (3× or more = an
   outlier: people clicked for the subject, not the channel).
3. **Shortlists stories** from the news, the outliers and your idea bank.
4. **Checks competition** for each story: how many videos exist, how many came
   out in the last 14 and 90 days, how they did, and whether big channels
   already own it.
5. **Digs deeper** with web search: are the facts solid, and is there enough
   material (archives, documents, maps, reporting) for a 20 to 40 minute
   faceless video?
6. **Hands in a ranked recap**. Each idea comes with a verdict (strong,
   promising, risky), why now, the demand numbers, the competition, shelf life
   (evergreen, months, weeks), your angle, title ideas, faceless material,
   starting sources and claims to check before publishing. The recap also has
   a watchlist (developing stories) and a "popular, but skip" list.

The agent is Claude (`claude-opus-5-5` by default) working in a loop with
these tools until it calls `submit_recap`. The code is in `src/agent.js`.

## Where you find the results

- **A GitHub issue every Monday** titled "Topic Radar: week of …". GitHub
  emails you about new issues in your own repository (check Settings >
  Notifications on github.com if not).
- `recaps/<date>.md`: every weekly recap, kept.
- `IDEA-BANK.md`: all ideas so far, grouped by status, with how many weeks
  each story has kept coming back (a sign of staying power).
- Optional: an email with the recap (set the SMTP secrets below; your Brevo
  details from Idea Check work).

## Your idea bank

Every idea has a `status` in `idea-bank.json`. Change it yourself, on
github.com (pencil icon) or on your computer:

| status        | meaning                                                |
|---------------|--------------------------------------------------------|
| `new`         | suggested, not reviewed yet                            |
| `shortlisted` | you like it                                            |
| `made`        | you made the video; the agent stops suggesting it      |
| `dismissed`   | not for you; the agent stops suggesting it             |

The agent never overwrites a status you set.

## Set it up (about 10 minutes)

1. **Keys.** You need a Claude API key (console.anthropic.com) and, strongly
   recommended, a YouTube Data API key (the same one as Idea Check is fine;
   see below about quota). Without YouTube, the agent can still read news and
   search the web, but it cannot measure demand or competition, and the recap
   says so.
2. **Repository secrets.** On github.com: Settings > Secrets and variables >
   Actions > New repository secret. Add `ANTHROPIC_API_KEY` and
   `YOUTUBE_API_KEY`. To also get the recap by email, add `SMTP_HOST`,
   `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` and `RADAR_EMAIL_TO`
   (your address).
3. **Default branch.** GitHub only runs scheduled jobs from the repository's
   default branch, so `.github/workflows/topic-radar.yml` and this folder must
   be merged there.
4. **Run it once now:** Actions tab > "Topic Radar (weekly)" > Run workflow.
   A run takes about 5 to 15 minutes. After that it runs every Monday at
   06:23 UTC.

## Make it yours: `config.json`

- `channelDescription`: what your channel makes and for whom. The agent judges
  fit against it.
- `channelUrl`: your channel's link (for example
  `https://www.youtube.com/@yourchannel`). Optional; with it the agent also
  sees your recent videos and their views (3 YouTube units).
- `language`: `en` or `fr` (news searches and the recap's language).
- `ideasPerWeek`: how many ideas you want (default 10).
- `beats`: your subjects. Each has a name, `news` searches (short phrases,
  run every week for free) and `youtube` searches the agent may start from.
  Add, remove or rename beats freely, for example a "Cartels" or "Cults" beat.

## Cost

- **Claude:** roughly $1 to $3 a week with `claude-opus-5-5` (the recap
  prints the estimate for each run). For less, set the repository variable
  `CLAUDE_MODEL` to `claude-sonnet-5-5` (about half) and/or `CLAUDE_EFFORT` to
  `low`. Web search adds $0.01 per search, at most 15 a run.
- **YouTube:** each run may spend up to 2,500 of the free 10,000 daily units
  (about 20 searches). If Idea Check shares the same key, Monday leaves it
  about 7,500 units, still plenty. Change it with the repository variable
  `RADAR_YOUTUBE_UNITS`.
- **GitHub Actions and Google News:** free.

## Run it on your computer

You need Node.js 22 or newer.

```sh
cd topic-radar
npm install
cp .env.example .env   # then fill in your keys
npm start              # or: npm run dry-run   (no email)
```

The recap is written to `recaps/<today>.md` and the idea bank is updated.

## Good to know

- Demand and competition come from YouTube search samples (the 50 most
  relevant or most-viewed videos), so they are strong clues, not a census.
- Allegations in scandal and espionage stories are listed under "check before
  publishing", never stated as fact. Check them before you script.
- Google News feeds are allowed for personal, non-commercial use; this agent
  only uses them to research your own ideas.
- If this repository is public, the idea bank and recaps are public too. Make
  the repository private, or move `topic-radar/` and the workflow file to a
  private repository of their own (nothing in it depends on Idea Check).
