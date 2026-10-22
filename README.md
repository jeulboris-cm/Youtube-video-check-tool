# Idea Check

A web tool that tells a YouTuber, before production starts, whether a video
idea is worth the time and money, using real data from similar videos on
channels of the same size.

## Status

Steps 1 to 3 of the build plan are done: a small Node.js server, an input
form that saves each idea, and a plain list of similar YouTube videos with
their views, age and channel size. It works on phone and laptop.

## Run it locally

You need [Node.js](https://nodejs.org) 20 or newer.

```sh
npm install
npm start
```

Set your YouTube Data API key first (copy `.env.example` to `.env`, or set
`YOUTUBE_API_KEY` in your environment). Then open http://localhost:3000 in your browser.

To open it on your phone, connect the phone to the same Wi-Fi as your
computer and visit `http://<your-computer's-local-IP>:3000`.

## Build plan

1. Project setup ✅
2. Input form ✅
3. YouTube data ✅
4. Channels your size
5. Claude reasoning
6. Report page
7. Results and reminders
8. Put it online

## Where ideas are saved

Each form submission is saved to `data/ideas.json` on the server. That folder
is left out of git so testers' unpublished ideas never reach the repository.
Set `DATA_DIR` to store it somewhere else.

## YouTube quota

YouTube gives about 10,000 free "units" a day. Each idea check costs about
204 units: two searches at 100 each (one for the idea, one for the working
title), plus a few single units for the channel, the videos and their
channels. That is roughly 45 checks a day. To stay safe the tool:

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
