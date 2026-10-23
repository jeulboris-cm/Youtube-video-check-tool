# Putting Idea Check online for free

This uses four free services. None needs a credit card (as of October 2026;
check each provider's pricing page, as free plans change).

| Service | What it does | Free plan |
|---|---|---|
| **Render** | Runs the app and gives it a web address | 750 hours a month. The app sleeps after 15 minutes without visitors; the next visitor waits about a minute while it wakes up. |
| **Neon** | Database that keeps ideas, reports and results | 0.5–1 GB of storage, far more than testers will use. Render's free plan wipes its own disk when the app sleeps, so this is needed. |
| **Brevo** | Sends the 30-day reminder emails | 300 emails a day, no own domain needed. |
| **GitHub Actions** | Wakes the app once a day so due reminders go out | Free for this use. |

Do the steps in order. Keep each password, key and address you copy in a
safe note: you paste them into Render in step 3. Never put them in the code
or in a chat.

## 1. Neon: the database (about 5 minutes)

1. Go to https://neon.com and sign up (signing in with GitHub or Google works).
2. Create a project. Any name, for example `idea-check`. Pick the region
   closest to your testers.
3. On the project dashboard, click **Connect**. Copy the connection string
   shown in the window. It starts with `postgresql://` and includes
   `sslmode=require`. This is your **DATABASE_URL**.

## 2. Brevo: reminder emails (about 10 minutes)

1. Go to https://www.brevo.com and create a free account.
2. Add your sender address: **Senders, Domains & Dedicated IPs → Senders →
   Add a sender**. Use the email address reminders should come from (your
   own address is fine) and confirm it from the email Brevo sends you.
3. Open the account menu (top right) → **Settings → SMTP & API**, then the
   **SMTP** tab, and click **Generate a new SMTP key**. Copy the key straight
   away: Brevo does not show it in full again. This is **SMTP_PASS**.
4. On the same tab, copy the **Login** shown there. This is **SMTP_USER**.
   (Your Brevo account password does not work here; only the SMTP key does.)
5. Your **EMAIL_FROM** is the sender from step 2, written like
   `Idea Check <you@example.com>`.

Brevo sometimes reviews new accounts before they can send. If reminders do
not arrive at first, check Brevo for a message about account activation.
Reminders sent from a Gmail or Yahoo address through Brevo can land in spam;
ask testers to check their spam folder.

## 3. Render: the app itself (about 10 minutes)

1. Go to https://render.com and sign up **with GitHub**, so Render can see
   this repository.
2. Click **New → Blueprint** and choose the `youtube-video-check-tool`
   repository. Render reads `render.yaml` and sets up a free web service
   called `idea-check`.
3. Render asks for the settings marked as needed. Fill in:
   - **YOUTUBE_API_KEY**: your YouTube Data API key
   - **DATABASE_URL**: from Neon (step 1)
   - **SMTP_USER**, **SMTP_PASS**, **EMAIL_FROM**: from Brevo (step 2)
   - **ANTHROPIC_API_KEY**: leave empty until you have a Claude API key
4. Click **Apply**. The first build takes a few minutes. When it is done,
   the service page shows the app's address, like
   `https://idea-check.onrender.com`. That is the link for testers.
5. On the service's **Environment** page, find **CRON_SECRET** (Render made
   it for you) and copy its value for step 4.

Each time new code is pushed to the `claude/step-one-pq5u7t` branch, Render
updates the app by itself.

## 4. GitHub: the daily reminder run (about 3 minutes)

1. In this repository on GitHub, open **Settings → Secrets and variables →
   Actions → New repository secret**.
2. Add `APP_URL` with the app's address from step 3 (no slash at the end).
3. Add `CRON_SECRET` with the value from step 3.
4. To test it, open **Actions → Daily reminder emails → Run workflow**. A
   green tick means the app answered.

GitHub turns off scheduled runs in repositories with no activity for 60
days; it emails you first, and one click turns them back on.

## 5. Check it works

1. Open the app's address and check one of your own ideas.
2. The first visit after a quiet spell can take about a minute; that is the
   free plan waking the app up, not an error.
3. Open the report link again later, or from another device: the report is
   still there, because it is stored in Neon.

## Limits to keep in mind

- **YouTube quota:** about 25–45 reports a day (see the README).
- **Speed:** the first visitor after 15 quiet minutes waits about a minute.
- **Render hours:** 750 a month is enough for one app that sleeps when idle.

## 6. Your private owner page

1. In Render, open the `idea-check` service → **Environment** → **Edit** →
   **+ Add**. Name: `ADMIN_PASSWORD`. Value: a long password only you know
   (for example four random words and a number). Click **Save**; the app
   restarts in a minute or two.
2. Open `https://idea-check.onrender.com/admin.html` and enter that password.

Nothing on the site links to this page and it needs the password, so testers
never see it. Five wrong passwords lock that visitor out for 15 minutes.

## 7. Turning on Claude (the AI advice)

1. Create a key at https://platform.claude.com (API Keys → Create Key) after
   buying credits under Settings → Billing. Set a monthly limit under
   Settings → Limits.
2. In Render: `idea-check` → Environment → Edit → + Add:
   `ANTHROPIC_API_KEY` = your key. Optionally `CLAUDE_MODEL` =
   `claude-opus-5-5` (best), `claude-sonnet-5-5` or `claude-haiku-5-5`
   (cheapest). Save; the app restarts.
3. New reports then get Claude's shelf life, reframes, packaging and claims
   to check. The owner page shows an estimate of the spend so far.
