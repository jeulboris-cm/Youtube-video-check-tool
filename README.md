# Idea Check

A web tool that tells a YouTuber, before production starts, whether a video
idea is worth the time and money, using real data from similar videos on
channels of the same size.

## Status

Steps 1 to 7 of the build plan are done: a small Node.js server, an input
form that saves each idea, a plain list of similar YouTube videos with
their views, age and channel size, and a "Channels your size" view range, and Claude's shelf-life label, reframes,
packaging suggestions and claims to verify. It works on phone and laptop.

## Put it online

See [DEPLOY.md](DEPLOY.md): free hosting on Render, a free Neon database,
free Brevo reminder emails and a daily GitHub Actions run.

## Run it locally

You need [Node.js](https://nodejs.org) 20 or newer.

```sh
npm install
npm start
```

Set your YouTube Data API key and Claude API key first (copy `.env.example` to `.env`, or set
`YOUTUBE_API_KEY` and `ANTHROPIC_API_KEY` in your environment). Then open http://localhost:3000 in your browser.

To open it on your phone, connect the phone to the same Wi-Fi as your
computer and visit `http://<your-computer's-local-IP>:3000`.

## Build plan

1. Project setup ✅
2. Input form ✅
3. YouTube data ✅
4. Channels your size ✅
5. Claude reasoning ✅
6. Report page ✅
7. Results and reminders ✅
8. Put it online

## Where ideas are saved

On a laptop, data is saved as JSON files in `data/` (left out of git, so
testers' unpublished ideas never reach the repository; set `DATA_DIR` to
change the folder). When `DATABASE_URL` is set, everything is stored in that
Postgres database instead (see `lib/store.js`).

## YouTube quota

YouTube gives about 10,000 free "units" a day. Each idea check costs about
204 units: two searches at 100 each (one for the idea, one for the working
title), plus a few single units for the channel, the videos and their
channels. That is roughly 45 checks a day. When the first page of results
has fewer than 5 videos from channels the tester's size, the tool fetches a
second page of both searches, so that check costs about 404 units. Expect
roughly 25 to 45 checks a day. To stay safe the tool:

- reuses a search for 24 hours if the same text is searched again (about 4 units),
- counts units used per day in `data/youtube-usage.json`,
- stops searching at 8,000 units a day (change with `YOUTUBE_DAILY_UNIT_CAP`).

## How similar videos are chosen

1. YouTube is searched twice, with the idea and with the working title
   (50 results each).
2. Shorts, clips under 3 minutes and videos under 2 weeks old are removed.
3. Each video is scored on its position in the two searches and on how many
   key words of the idea and title appear in its own title, description and
   tags. Videos sharing fewer than 2 key words are removed.
4. The 12 best are shown.

## Channels your size

Every relevant video found (not only the 12 shown) is filtered to channels
with half to double the tester's subscriber count. If at least 5 remain, the
page shows the range most of them got (25th to 75th percentile), the middle
value, the lowest and highest, and lists every video used. The tester's own
channel is left out.

With fewer than 5, the tool first searches one page deeper. If there are
still fewer than 5, it says so and shows no range from channels that size.
Instead it shows an estimate, clearly labelled as one: the views per
subscriber that most similar videos got (middle half), applied to the
tester's subscriber count, with the list of videos it uses. The estimate
only uses channels from a tenth of the tester's size up to 50 times it, and
never channels under 100 subscribers, whose numbers swing too much. It also
needs at least 5 such videos.

## Claude analysis

After the YouTube lookup, the tool sends the idea and the similar videos to
Claude (`claude-opus-5-5`, in `lib/claude.js`) and gets back:

- a shelf-life label (short, medium or long) with a one-line reason and the
  signals it rests on (wording, older similar videos, the tester's news answer),
- one or two reframes around the mechanism when the label is short or medium,
- two or three packaging directions with an example title and a reason,
- claims in the idea to verify before publishing.

Search-trend data is not connected, so Claude is told not to guess it. Each
report costs a few cents on the Claude API account. `CLAUDE_EFFORT` (low,
medium, high) trades thinking depth against cost; the default is medium.
If no key is set, the rest of the report still works and the page says so.

## The report page

After the form is sent, the tester lands on `/report.html?id=<id>`, which
shows the six sections of the spec on one page, with a link to every source
video:

1. **Similar videos**: the 12 most relevant.
2. **Channels your size**: the view range, or the labelled estimate.
3. **Who owns the subject**: the share of views taken by channels with 1M+
   subscribers (dominant at 60% or more), and small channels (under 100K)
   that broke through (10K+ views and more views than subscribers).
4. **Shelf life**: from Claude when a key is set, otherwise from the free
   rule-based check in `lib/shelflife.js` (wording, older similar videos and
   the tester's news answer, each pointing to short, long or unclear).
5. **Cost versus range**: cost per 1,000 views at the low, middle and high
   end of the range.
6. **Packaging suggestions** and claims to verify: from Claude only.

The report is saved with the idea, so the link shows the report as it was on
the day of the check. Ids are random, so only people with the link can open it.

## Results, feedback and reminders

The end of each report has two forms:

- **Was this useful?** "Was this report useful?" (yes/no), "Would it have
  changed your decision?" (changed / confirmed / no effect) and an optional
  comment.
- **Your real results:** the published video's link, the views after 7, 30
  and 90 days, and "I decided not to make this video". Once the link is in,
  the daily job reads the video's views from YouTube by itself at 7, 30 and
  90 days after publishing (`lib/tracking.js`, 1 quota unit per 50 videos);
  numbers the tester types win over the automatic ones. Each number is shown
  as below, inside or above the report's range.

Testers can leave an email on the form. They get their report's link right
away, and 30 days after the report one reminder asking for their video's
link, unless the link or the 30-day views are already in. "Lost your report
link?" (`/find.html`) emails all of an address's report links to that
address only, answers the same whether or not the address is known, and is
limited to 5 requests an hour per visitor and 3 per address. Reminders need an SMTP email service; set `SMTP_HOST`, `SMTP_PORT`,
`SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` and `PUBLIC_URL` (see `.env.example`).
Without them nothing is sent, and the report page asks testers to bookmark
it and come back. Email addresses are never sent to the report page.

## Owner page

`/admin.html` is a private page for the owner: every check, the testers'
feedback, their real views against the predicted range, headline numbers
and a CSV download. Nothing on the site links to it, search engines are
asked not to list it, and it needs the `ADMIN_PASSWORD` setting; without
that setting it is switched off. Five wrong passwords lock a visitor out for
15 minutes.

Testers who leave an email also get their report's link by email right
after the check, so they never lose it.
