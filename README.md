# Idea Check

A web tool that tells a YouTuber, before production starts, whether a video
idea is worth the time and money, using real data from similar videos on
channels of the same size.

## Status

Steps 1 and 2 of the build plan are done: a small Node.js server and an
input form that saves each idea. It works on phone and laptop.

## Run it locally

You need [Node.js](https://nodejs.org) 20 or newer.

```sh
npm install
npm start
```

Then open http://localhost:3000 in your browser.

To open it on your phone, connect the phone to the same Wi-Fi as your
computer and visit `http://<your-computer's-local-IP>:3000`.

## Build plan

1. Project setup ✅
2. Input form ✅
3. YouTube data
4. Channels your size
5. Claude reasoning
6. Report page
7. Results and reminders
8. Put it online

## Where ideas are saved

Each form submission is saved to `data/ideas.json` on the server. That folder
is left out of git so testers' unpublished ideas never reach the repository.
Set `DATA_DIR` to store it somewhere else.
