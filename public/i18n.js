// Page texts in English and French, and the EN | FR switch in the header.
// Static texts are marked in the HTML with data-i18n="key" (also
// data-i18n-placeholder and data-i18n-suffix); scripts use I18N.t(key).
(function () {
  const DICT = {
    en: {
      // Shared
      "nav.check": "Check an idea",
      "nav.check_another": "Check another idea",
      "common.optional": "Optional",
      "common.yes": "Yes",
      "common.no": "No",
      "common.not_sure": "Not sure",
      "common.saving": "Saving…",
      "common.fix_fields": "Please fix the highlighted fields.",
      "common.no_connection": "Could not save. Check your connection and try again.",

      // Form page
      "home.title": "Idea Check",
      "home.eyebrow": "For creators of high-effort videos",
      "home.h1": "Is this video worth making?",
      "home.tagline": "Before you spend a month on it, see what similar videos from channels your size actually got, how long the idea will stay relevant, and how to package it.",
      "home.promise1": "Real views from similar videos",
      "home.promise2": "Your own track record",
      "home.promise3": "Shelf life",
      "home.promise4": "Cost per 1,000 views",
      "form.group_idea": "The idea",
      "form.idea": "Your idea in one or two sentences",
      "form.idea_ph": "How MTN ran its mobile network across Africa",
      "form.idea_hint": "Name the specific people, companies or places involved (for example \"MTN\", not \"a telecom company\"). This helps find videos that are truly similar.",
      "form.title": "Working title",
      "form.title_ph": "The most hated telecom company in Africa",
      "form.channel": "Your channel link",
      "form.channel_hint": "Used to read your subscriber count and your recent videos' views. Links like youtube.com/@name work best.",
      "form.group_details": "Production details",
      "form.details_hint": "These make the report more useful, especially the cost.",
      "form.cost": "Production cost",
      "form.length": "Planned length",
      "form.days": "Production time",
      "form.suffix_min": "min",
      "form.suffix_days": "days",
      "form.news": "Is the idea tied to a recent news event?",
      "form.group_reminder": "Reminder",
      "form.email": "Email for your report link and a 30-day reminder",
      "form.email_hint": "We email you the link to your report right away, and once, 30 days later, ask for your video's link. That is how we learn whether the tool works. Nothing else.",
      "form.submit": "Check this idea",
      "form.wake_note": "The first check after a quiet spell can take an extra minute while the tool wakes up.",
      "form.privacy": "Your idea is private. It is never shown to other users.",
      "form.lost_link": "Lost your report link?",

      // Report page: progress
      "report.page_title": "Idea Check report",
      "report.loading": "Loading your report…",
      "report.eyebrow": "Idea Check report",
      "progress.title": "Building your report",
      "progress.intro": "This usually takes under a minute. You can keep this page open; it updates by itself.",
      "progress.start": "Starting (the tool may be waking up)",
      "progress.channel": "Reading your channel and your recent videos",
      "progress.search": "Searching YouTube for similar videos",
      "progress.search_deeper": "Searching deeper for channels your size",
      "progress.compare": "Comparing views and channel sizes",
      "progress.analysis": "Writing the shelf-life and packaging advice",
      "progress.failed": "Something went wrong while building this report. Your idea is saved.",
      "progress.retry": "Try again",
      "progress.lost_link": "Lost your report link? Get it by email.",
      "progress.not_found": "Report not found. Check that the link is complete.",
      "progress.load_failed": "Could not load the report. Check your connection and refresh the page.",

      // Report page: header
      "meta.checked": "Checked {date}",
      "meta.subscribers": "{count} subscribers",
      "meta.subscribers_hidden": "subscribers hidden",
      "meta.minutes": "{count} min",
      "meta.days_work": "{count} days of work",
      "meta.news.yes": "Tied to news: yes",
      "meta.news.no": "Tied to news: no",
      "meta.news.not_sure": "Tied to news: not sure",
      "meta.link_emailed": "We have emailed you the link to this report, so you can come back to it any time.",
      "meta.bookmark": "Bookmark this page: its address is your private link to this report.",
      "error.youtube.quota": "YouTube's daily limit for this tool is used up, so parts of this report are missing. Try again tomorrow.",
      "error.youtube.no_key": "The tool's YouTube connection is not set up, so parts of this report are missing.",
      "error.youtube.other": "YouTube could not be reached, so parts of this report are missing. Try again later.",

      // Videos
      "video.views": "{count} views",
      "video.views_hidden": "views hidden",
      "age.today": "today",
      "age.days": "{count} days ago",
      "age.day": "1 day ago",
      "age.months": "{count} months ago",
      "age.month": "1 month ago",
      "age.years": "{count} years ago",
      "age.year": "1 year ago",
      "range.views": "{low} to {high} views",
      "range.middle": " (middle: {middle}).",
      "range.twelve_months": "Views are estimated for 12 months after publishing: older videos have had longer to collect views, so each video's views are adjusted for its age.",

      // Section 1
      "s1.title": "Similar videos",
      "s1.hint": "Found by searching YouTube for your idea and your working title, most relevant first. Shorts, clips under 3 minutes and videos less than 2 weeks old are left out.",
      "s1.none": "No similar videos found on YouTube for this idea.",

      // Section 2
      "s2.title": "Channels your size",
      "s2.own_title": "Your own recent videos",
      "s2.own_lead": "Your recent videos would get ",
      "s2.own_details": "Based on your {count} most recent long videos. Your own audience is the most direct evidence of what this video could get.",
      "s2.own_thin": "Not enough of your own videos to give a range (we need at least {minimum} long videos older than 2 weeks).",
      "s2.own_none": "We could not read your channel's recent videos.",
      "s2.own_show": "Show these {count} videos",
      "s2.others_title": "Similar videos from channels your size",
      "s2.band": "Channels with {min} to {max} subscribers (half to double your size).",
      "s2.lead": "Most of these videos would get ",
      "s2.details": "Lowest: {lowest} · Highest: {highest} · Based on the {count} videos below.",
      "s2.unknown_size": "We need your subscriber count to compare with channels your size. Use a channel link like youtube.com/@name, and make sure your subscriber count is public.",
      "s2.thin_none": "Not enough data: we found no similar videos from channels your size, and need at least {minimum} to give a range",
      "s2.thin_some": "Not enough data: we found only {count} similar video(s) from channels your size, and need at least {minimum} to give a range",
      "s2.thin_deeper": ", even after searching deeper.",
      "s2.thin_end": ".",
      "s2.thin_tip": " Naming the specific people, companies or places in your idea can help.",
      "s2.estimate_title": "Estimate from similar videos",
      "s2.estimate_lead": "If your video does like most similar videos, relative to channel size: ",
      "s2.estimate_details": "This is an estimate, not direct evidence from channels your size. Most of the {count} similar videos from channels with {min} to {max} subscribers would get {low} to {high} views per subscriber of their channel in 12 months; we applied that to your subscriber count. Bigger and smaller channels can behave differently.",
      "s2.estimate_show": "Show the {count} videos this estimate uses",
      "s2.not_available": "Not available, because the YouTube search did not complete.",

      // Section 3
      "s3.title": "Who owns the subject",
      "s3.thin": "Not enough similar videos ({count}) to say who owns this subject.",
      "s3.big": "channels with {count}+ subscribers",
      "s3.dominated": "Large channels dominate: {big}{names} got {share}% of all views on the {count} similar videos.",
      "s3.none": "No large channels: none of the {count} similar videos comes from {big}.",
      "s3.present": "Large channels are present but do not dominate: {big}{names} got {share}% of all views on the {count} similar videos.",
      "s3.breakthroughs": "{count} video(s) from small channels (under {small} subscribers) broke through, with {views}+ views and more views than subscribers:",
      "s3.no_breakthrough": "No small channel (under {small} subscribers) has broken through on this subject among the videos found.",

      // Section 4
      "s4.title": "Shelf life",
      "shelf.short": "Short (weeks)",
      "shelf.medium": "Medium (months)",
      "shelf.long": "Long (years)",
      "signal.wording": "Wording",
      "signal.older_competitors": "Older similar videos",
      "signal.tester_answer": "Your answer about news",
      "signal.search_interest": "Search interest",
      "points.short": "points to short",
      "points.long": "points to long",
      "points.unclear": "unclear",
      "code.wording_news": "The wording (\"{word}\") ties the idea to a recent moment.",
      "code.wording_mechanism": "The wording (\"{word}\") frames it around how or why something happens.",
      "code.wording_mixed": "The wording mixes a news hook (\"{news}\") with a how/why framing (\"{mechanism}\").",
      "code.wording_none": "The wording has no clear news or how/why markers.",
      "code.older_strong": "{count} of {total} similar videos older than a year have strong view counts, so people keep watching this topic.",
      "code.older_weak": "{count} of {total} similar videos older than six months have almost no views.",
      "code.older_recent": "Most similar videos are less than six months old, so the topic looks recent.",
      "code.older_unclear": "Older similar videos give no clear picture either way.",
      "code.tester_yes": "You said the idea is tied to a recent news event.",
      "code.tester_no": "You said the idea is not tied to a news event.",
      "code.tester_none": "You did not say whether the idea is tied to news.",
      "code.reason_none": "None of the signals is clear, so this is a cautious middle guess.",
      "code.reason_long": "{toLong} of 3 signals point to a long shelf life and none to a short one.",
      "code.reason_short": "{toShort} of 3 signals point to a short shelf life and none to a long one.",
      "code.reason_long_one": "1 of 3 signals points to a long shelf life and none to a short one.",
      "code.reason_short_one": "1 of 3 signals points to a short shelf life and none to a long one.",
      "code.reason_mixed": "The signals disagree: {toLong} for long, {toShort} for short.",
      "s4.reframes": "Same story, longer shelf life",
      "s4.source_rules": "From a simple rule-based check of the signals above. Search-trend data is not included yet.",
      "s4.tip": " Tip: the same story framed around how or why something works usually lasts longer than one framed around a news event.",
      "s4.source_claude": "Judged by Claude (AI) from the signals above. Search-trend data is not included yet.",

      // Section 5
      "s5.title": "Cost versus range",
      "s5.no_cost": "Add your production cost on the form to see cost per 1,000 views.",
      "s5.no_range": "Your cost: {cost}. There is no view range yet, so no cost comparison.",
      "s5.your_cost": "Your cost: {cost}.",
      "s5.col_views": "Views in 12 months",
      "s5.col_cost": "Cost per 1,000 views",
      "s5.low": "Low end",
      "s5.middle": "Middle",
      "s5.high": "High end",
      "s5.na": "not available",
      "s5.basis.track_record": "Views come from your own recent videos (section 2), the most direct evidence there is.",
      "s5.basis.your_size": "Views come from similar videos on channels your size (section 2).",
      "s5.basis.estimate": "Views come from the estimate in section 2, not from channels your size, so treat these numbers with extra care.",

      // Section 6
      "s6.title": "Packaging suggestions",
      "s6.example": "Example title: \"{title}\"",
      "s6.checks": "Check before publishing",
      "s6.no_checks": "No specific claims to check were found.",
      "s6.ai_note": "Written by Claude (AI) from your idea and the videos above. Treat it as a second opinion, not a fact.",
      "s6.missing": "Packaging suggestions and fact-check flags need Claude (AI), which is not connected yet. Until then, use the title formats above and the titles in section 1 that beat their channel's average.",

      // Known limits
      "limits.title": "Known limits",
      "limits.text": "These are ranges seen on similar videos, never a promise of views. Views also depend on how much YouTube shows a video to people, which small channels do not control: in our own tests, videos with similar click rates got anywhere from 281 to 53,600 impressions.",

      // Section 7
      "s7.title": "Was this useful?",
      "s7.useful": "Was this report useful?",
      "s7.decision": "Would it have changed your decision?",
      "s7.changed": "Changed",
      "s7.confirmed": "Confirmed",
      "s7.no_effect": "No effect",
      "s7.comment": "Anything else?",
      "s7.comment_ph": "What was missing, wrong or most helpful?",
      "s7.send": "Send feedback",
      "s7.thanks": "Thanks! You said the report was {useful} and {decision}. You can change your answers any time.",
      "s7.useful_yes": "useful",
      "s7.useful_no": "not useful",
      "s7.decision.changed": "changed your decision",
      "s7.decision.confirmed": "confirmed your decision",
      "s7.decision.no_effect": "had no effect on your decision",

      // Section 8
      "s8.title": "Your real results",
      "s8.video": "Link to the published video",
      "s8.video_hint": "Paste it as soon as the video is out. We then read its views from YouTube automatically.",
      "s8.views_after": "Views after…",
      "s8.d7": "7 days",
      "s8.d30": "30 days",
      "s8.d90": "90 days",
      "s8.views_hint": "With the video's link, you can leave these empty: we read the views at 7, 30 and 90 days after publishing by ourselves. If you type numbers from YouTube Studio, yours are used instead.",
      "s8.not_made": "I decided not to make this video",
      "s8.save": "Save results",
      "s8.saved": "Results saved. Thank you!",
      "s8.intro_not_made": "You said you decided not to make this video. Thank you for telling us: that counts as a result too.",
      "s8.intro_tracking": "We are following your video: its views are read from YouTube automatically at 7, 30 and 90 days after publishing. Nothing else to do.",
      "s8.intro_reminder_sent": "Once the video is out, paste its link here. We sent you the 30-day reminder.",
      "s8.intro_reminder": "Once the video is out, paste its link here and we will follow its views automatically. If we have no link by {date}, we will email you a reminder.",
      "s8.intro_bookmark": "Once the video is out, come back to this page (bookmark it) and paste the video's link. We then follow its views automatically.",
      "s8.video_line": "\"{title}\" was published {age} and had {views} views when we read it on {date}.",
      "s8.auto_title": "Automatic readings:",
      "s8.auto_done": "Day {day}: {views} views (read on {date})",
      "s8.auto_planned": "Day {day}: will be read on {date}",
      "s8.auto_typed": "Day {day}: you typed this one yourself",
      "s8.auto_soon": "Day {day}: being read in the next day",
      "s8.auto_missed": "Day {day}: the link came after this date, so type it from YouTube Studio if you can",
      "s8.compare_title": "Compared with the report's range:",
      "s8.compare_line": "After {day} days: {views} views ({source}), {verdict} (expected by then: {low} to {high}, from {basis}).{usual}",
      "s8.source_typed": "your number",
      "s8.source_auto": "read from YouTube",
      "s8.verdict.below": "below the range",
      "s8.verdict.inside": "inside the range",
      "s8.verdict.above": "above the range",
      "s8.basis.track_record": "your own recent videos",
      "s8.basis.your_size": "channels your size",
      "s8.basis.estimate": "the estimate",
      "s8.compare_note": "The report's 12-month range is scaled down to what a video usually has after that many days, so early numbers are compared fairly.",
      "s8.compare_note_old": "This report gave total views of older videos, so early numbers often sit below its range. The 90-day number is the fairest comparison.",
      "s8.no_range": "Saved. The report had no view range to compare these numbers with.",
      "msg.video_read_failed": "Could not read the current views from YouTube. Your numbers were still saved.",

      // Find page
      "find.page_title": "Find your report · Idea Check",
      "find.h1": "Lost your report link?",
      "find.intro": "Enter the email address you gave on the form. We will email you the links to all your reports.",
      "find.email": "Your email",
      "find.submit": "Email me my links",
      "find.sending": "Sending…",
      "find.no_email": "Didn't give an email on the form? Then we can't send the link. Contact the person who invited you to Idea Check and they can find your report for you.",
      "find.failed": "Could not send. Check your connection and try again.",
      // Demand, fit, formats, related ideas, "x your usual"
      "progress.related": "Looking for related ideas with proven demand",
      "demand.title": "Is there demand?",
      "demand.strong": "Strong demand",
      "demand.moderate": "Some demand",
      "demand.weak": "Weak demand",
      "demand.thin": "Not enough similar videos with a known channel average ({count}) to judge demand.",
      "demand.counts": "{outliers} of {total} similar videos beat their own channel's average by 3× or more (with 1,000+ views); {under} got less than half of it. The middle video got {median}× its channel's average.",
      "demand.note": "A video that beats its own channel's average shows people chose the subject itself, not just that a big channel posted it. The misses count too: they show where the subject did not pull. The channel average is rough (it includes Shorts), so treat this as a clue, not proof.",
      "video.times": "{x}× its channel's average",
      "fit.title": "Does it fit your channel?",
      "fit.close": "Close: {matches} of your {total} recent videos share key words with this idea.",
      "fit.partial": "Partly: {matches} of your {total} recent videos share key words with this idea.",
      "fit.far": "Far: only {matches} of your {total} recent videos share key words with this idea. That does not make it a bad idea, but a video far from what your audience usually watches can bring the wrong viewers, and YouTube judges how satisfied the viewers are. Check it fits the people who follow you.",
      "fit.keywords_note": "A rough check from words in titles only.",
      "fit.claude_close": "Close to what your audience watches.",
      "fit.claude_partial": "Partly close to what your audience watches.",
      "fit.claude_far": "Far from what your audience usually watches.",
      "fit.claude_note": "Judged by Claude (AI) from your recent video titles.",
      "formats.title": "Title formats in this niche",
      "formats.intro": "How often each way of framing a title appeared among the similar videos, and how those videos did against their own channel's average. Hits and misses both count.",
      "formats.row": "{count} videos: {outliers} beat their channel's average by 3× or more, {under} got less than half of it.",
      "formats.best": "Best one: ",
      "formats.none": "No title format appeared in three or more of the similar videos, so there is nothing reliable to say.",
      "formats.thin": "Too few similar videos with a known channel average to compare formats.",
      "formats.caution": "A title format is only part of why a video works: the thumbnail, the structure and the delivery matter too. Treat this as a clue, and watch a few of the winners before copying an approach.",
      "fmt.how_to": "How to…",
      "fmt.why": "Why…",
      "fmt.how_story": "How X became / built / lost Y",
      "fmt.number_list": "Numbered list (7 things…)",
      "fmt.rise_fall": "Rise and fall",
      "fmt.untold_truth": "Untold truth / hidden story",
      "fmt.most_biggest": "The most / biggest / worst…",
      "fmt.i_did": "I did X and learned…",
      "fmt.versus": "X vs Y",
      "fmt.new_era": "New rules / new era",
      "fmt.cheating": "So fast it feels like cheating / in N days",
      "fmt.question": "A question",
      "related.title": "Related ideas with proven demand",
      "related.intro": "Other videos from the strongest channels above that also beat their own channel's average: ideas your audience may want next.",
      "related.ai_note": "Named and explained by Claude (AI) from the videos shown. They are clues, not a guarantee.",
      "related.plain": "Claude (AI) is not connected, so these videos are listed without explanation.",
      "related.none": "No related videos that beat their channel's average were found.",
      "related.why": "Why there is demand: ",
      "related.angle": "An angle for you: ",
      "s8.usual": "That is {x}× your usual.",
      "s8.usual_note": "“Your usual” is the middle of your own recent videos' estimated views, scaled to the same number of days.",

    },

    fr: {
      "nav.check": "Tester une idée",
      "nav.check_another": "Tester une autre idée",
      "common.optional": "Facultatif",
      "common.yes": "Oui",
      "common.no": "Non",
      "common.not_sure": "Je ne sais pas",
      "common.saving": "Enregistrement…",
      "common.fix_fields": "Corrigez les champs signalés.",
      "common.no_connection": "Enregistrement impossible. Vérifiez votre connexion et réessayez.",

      "home.title": "Idea Check",
      "home.eyebrow": "Pour les créateurs de vidéos ambitieuses",
      "home.h1": "Cette vidéo vaut-elle la peine d'être faite ?",
      "home.tagline": "Avant d'y passer un mois, voyez ce qu'ont vraiment obtenu des vidéos similaires sur des chaînes de votre taille, combien de temps l'idée restera d'actualité, et comment la présenter.",
      "home.promise1": "Les vraies vues de vidéos similaires",
      "home.promise2": "Les résultats de votre chaîne",
      "home.promise3": "Durée de vie de l'idée",
      "home.promise4": "Coût pour 1 000 vues",
      "form.group_idea": "L'idée",
      "form.idea": "Votre idée en une ou deux phrases",
      "form.idea_ph": "Comment MTN a déployé son réseau mobile en Afrique",
      "form.idea_hint": "Nommez les personnes, entreprises ou lieux précis (par exemple « MTN », pas « un opérateur télécom »). Cela aide à trouver des vidéos vraiment similaires.",
      "form.title": "Titre provisoire",
      "form.title_ph": "L'opérateur télécom le plus détesté d'Afrique",
      "form.channel": "Le lien de votre chaîne",
      "form.channel_hint": "Sert à lire votre nombre d'abonnés et les vues de vos vidéos récentes. Les liens comme youtube.com/@nom fonctionnent le mieux.",
      "form.group_details": "Production",
      "form.details_hint": "Ces informations rendent le rapport plus utile, surtout le coût.",
      "form.cost": "Coût de production",
      "form.length": "Durée prévue",
      "form.days": "Temps de production",
      "form.suffix_min": "min",
      "form.suffix_days": "jours",
      "form.news": "L'idée est-elle liée à une actualité récente ?",
      "form.group_reminder": "Rappel",
      "form.email": "E-mail pour le lien de votre rapport et un rappel à 30 jours",
      "form.email_hint": "Nous vous envoyons tout de suite le lien de votre rapport, puis une seule fois, 30 jours plus tard, nous vous demandons le lien de votre vidéo. C'est ainsi que nous savons si l'outil fonctionne. Rien d'autre.",
      "form.submit": "Tester cette idée",
      "form.wake_note": "Le premier test après un moment sans visite peut prendre une minute de plus, le temps que l'outil se réveille.",
      "form.privacy": "Votre idée est privée. Elle n'est jamais montrée aux autres utilisateurs.",
      "form.lost_link": "Vous avez perdu le lien de votre rapport ?",

      "report.page_title": "Rapport Idea Check",
      "report.loading": "Chargement de votre rapport…",
      "report.eyebrow": "Rapport Idea Check",
      "progress.title": "Préparation de votre rapport",
      "progress.intro": "Cela prend en général moins d'une minute. Gardez cette page ouverte, elle se met à jour toute seule.",
      "progress.start": "Démarrage (l'outil est peut-être en train de se réveiller)",
      "progress.channel": "Lecture de votre chaîne et de vos vidéos récentes",
      "progress.search": "Recherche de vidéos similaires sur YouTube",
      "progress.search_deeper": "Recherche plus poussée de chaînes de votre taille",
      "progress.compare": "Comparaison des vues et des tailles de chaînes",
      "progress.analysis": "Rédaction des conseils sur la durée de vie et la présentation",
      "progress.failed": "Un problème est survenu pendant la préparation du rapport. Votre idée est enregistrée.",
      "progress.retry": "Réessayer",
      "progress.lost_link": "Vous avez perdu le lien de votre rapport ? Recevez-le par e-mail.",
      "progress.not_found": "Rapport introuvable. Vérifiez que le lien est complet.",
      "progress.load_failed": "Impossible de charger le rapport. Vérifiez votre connexion et rechargez la page.",

      "meta.checked": "Testée le {date}",
      "meta.subscribers": "{count} abonnés",
      "meta.subscribers_hidden": "abonnés masqués",
      "meta.minutes": "{count} min",
      "meta.days_work": "{count} jours de travail",
      "meta.news.yes": "Liée à l'actualité : oui",
      "meta.news.no": "Liée à l'actualité : non",
      "meta.news.not_sure": "Liée à l'actualité : je ne sais pas",
      "meta.link_emailed": "Nous vous avons envoyé le lien de ce rapport par e-mail : vous pouvez y revenir quand vous voulez.",
      "meta.bookmark": "Ajoutez cette page à vos favoris : son adresse est votre lien privé vers ce rapport.",
      "error.youtube.quota": "La limite quotidienne YouTube de l'outil est atteinte, une partie du rapport manque. Réessayez demain.",
      "error.youtube.no_key": "La connexion de l'outil à YouTube n'est pas configurée, une partie du rapport manque.",
      "error.youtube.other": "YouTube n'a pas pu être joint, une partie du rapport manque. Réessayez plus tard.",

      "video.views": "{count} vues",
      "video.views_hidden": "vues masquées",
      "age.today": "aujourd'hui",
      "age.days": "il y a {count} jours",
      "age.day": "il y a 1 jour",
      "age.months": "il y a {count} mois",
      "age.month": "il y a 1 mois",
      "age.years": "il y a {count} ans",
      "age.year": "il y a 1 an",
      "range.views": "{low} à {high} vues",
      "range.middle": " (milieu : {middle}).",
      "range.twelve_months": "Les vues sont estimées sur 12 mois après la publication : les vidéos plus anciennes ont eu plus de temps pour cumuler des vues, donc les vues de chaque vidéo sont ajustées selon son âge.",

      "s1.title": "Vidéos similaires",
      "s1.hint": "Trouvées en cherchant votre idée et votre titre provisoire sur YouTube, les plus proches d'abord. Les Shorts, les vidéos de moins de 3 minutes et celles de moins de 2 semaines sont écartés.",
      "s1.none": "Aucune vidéo similaire trouvée sur YouTube pour cette idée.",

      "s2.title": "Chaînes de votre taille",
      "s2.own_title": "Vos propres vidéos récentes",
      "s2.own_lead": "Vos vidéos récentes obtiendraient ",
      "s2.own_details": "D'après vos {count} vidéos longues les plus récentes. Votre propre public est la preuve la plus directe de ce que cette vidéo pourrait obtenir.",
      "s2.own_thin": "Pas assez de vidéos sur votre chaîne pour donner une fourchette (il faut au moins {minimum} vidéos longues de plus de 2 semaines).",
      "s2.own_none": "Nous n'avons pas pu lire les vidéos récentes de votre chaîne.",
      "s2.own_show": "Voir ces {count} vidéos",
      "s2.others_title": "Vidéos similaires de chaînes de votre taille",
      "s2.band": "Chaînes de {min} à {max} abonnés (de la moitié au double de votre taille).",
      "s2.lead": "La plupart de ces vidéos obtiendraient ",
      "s2.details": "Minimum : {lowest} · Maximum : {highest} · D'après les {count} vidéos ci-dessous.",
      "s2.unknown_size": "Il nous faut votre nombre d'abonnés pour comparer avec des chaînes de votre taille. Utilisez un lien de chaîne comme youtube.com/@nom, et vérifiez que votre nombre d'abonnés est public.",
      "s2.thin_none": "Pas assez de données : aucune vidéo similaire trouvée sur des chaînes de votre taille, et il en faut au moins {minimum} pour donner une fourchette",
      "s2.thin_some": "Pas assez de données : seulement {count} vidéo(s) similaire(s) trouvée(s) sur des chaînes de votre taille, et il en faut au moins {minimum} pour donner une fourchette",
      "s2.thin_deeper": ", même après une recherche plus poussée.",
      "s2.thin_end": ".",
      "s2.thin_tip": " Nommer les personnes, entreprises ou lieux précis dans votre idée peut aider.",
      "s2.estimate_title": "Estimation à partir de vidéos similaires",
      "s2.estimate_lead": "Si votre vidéo fait comme la plupart des vidéos similaires, selon la taille de la chaîne : ",
      "s2.estimate_details": "C'est une estimation, pas une preuve directe venant de chaînes de votre taille. La plupart des {count} vidéos similaires de chaînes de {min} à {max} abonnés obtiendraient {low} à {high} vues par abonné de leur chaîne en 12 mois ; nous l'avons appliqué à votre nombre d'abonnés. Les chaînes plus grandes ou plus petites peuvent se comporter différemment.",
      "s2.estimate_show": "Voir les {count} vidéos utilisées pour cette estimation",
      "s2.not_available": "Indisponible, car la recherche YouTube n'a pas abouti.",

      "s3.title": "Qui domine le sujet",
      "s3.thin": "Pas assez de vidéos similaires ({count}) pour dire qui domine ce sujet.",
      "s3.big": "les chaînes de {count} abonnés et plus",
      "s3.dominated": "Les grandes chaînes dominent : {big}{names} ont obtenu {share} % de toutes les vues des {count} vidéos similaires.",
      "s3.none": "Pas de grande chaîne : aucune des {count} vidéos similaires ne vient de {big}.",
      "s3.present": "Des grandes chaînes sont présentes sans dominer : {big}{names} ont obtenu {share} % de toutes les vues des {count} vidéos similaires.",
      "s3.breakthroughs": "{count} vidéo(s) de petites chaînes (moins de {small} abonnés) ont percé, avec {views} vues ou plus et plus de vues que d'abonnés :",
      "s3.no_breakthrough": "Aucune petite chaîne (moins de {small} abonnés) n'a percé sur ce sujet parmi les vidéos trouvées.",

      "s4.title": "Durée de vie",
      "shelf.short": "Courte (semaines)",
      "shelf.medium": "Moyenne (mois)",
      "shelf.long": "Longue (années)",
      "signal.wording": "Formulation",
      "signal.older_competitors": "Vidéos similaires plus anciennes",
      "signal.tester_answer": "Votre réponse sur l'actualité",
      "signal.search_interest": "Intérêt de recherche",
      "points.short": "plutôt courte",
      "points.long": "plutôt longue",
      "points.unclear": "pas clair",
      "code.wording_news": "La formulation (« {word} ») lie l'idée à un moment d'actualité.",
      "code.wording_mechanism": "La formulation (« {word} ») présente l'idée autour du comment ou du pourquoi.",
      "code.wording_mixed": "La formulation mêle une accroche d'actualité (« {news} ») et un angle comment/pourquoi (« {mechanism} »).",
      "code.wording_none": "La formulation ne contient pas de signe clair d'actualité ou de comment/pourquoi.",
      "code.older_strong": "{count} des {total} vidéos similaires de plus d'un an ont beaucoup de vues : le sujet continue d'être regardé.",
      "code.older_weak": "{count} des {total} vidéos similaires de plus de six mois n'ont presque pas de vues.",
      "code.older_recent": "La plupart des vidéos similaires ont moins de six mois : le sujet semble récent.",
      "code.older_unclear": "Les vidéos similaires plus anciennes ne donnent pas d'indication claire.",
      "code.tester_yes": "Vous avez dit que l'idée est liée à une actualité récente.",
      "code.tester_no": "Vous avez dit que l'idée n'est pas liée à l'actualité.",
      "code.tester_none": "Vous n'avez pas dit si l'idée est liée à l'actualité.",
      "code.reason_none": "Aucun signal n'est clair, c'est donc une estimation prudente au milieu.",
      "code.reason_long": "{toLong} signaux sur 3 indiquent une longue durée de vie et aucun une courte.",
      "code.reason_short": "{toShort} signaux sur 3 indiquent une courte durée de vie et aucun une longue.",
      "code.reason_long_one": "1 signal sur 3 indique une longue durée de vie et aucun une courte.",
      "code.reason_short_one": "1 signal sur 3 indique une courte durée de vie et aucun une longue.",
      "code.reason_mixed": "Les signaux ne sont pas d'accord : {toLong} pour longue, {toShort} pour courte.",
      "s4.reframes": "La même histoire, une plus longue durée de vie",
      "s4.source_rules": "D'après une vérification simple, par règles, des signaux ci-dessus. Les données de tendances de recherche ne sont pas encore incluses.",
      "s4.tip": " Conseil : la même histoire racontée autour du comment ou du pourquoi dure en général plus longtemps qu'une histoire liée à une actualité.",
      "s4.source_claude": "Jugé par Claude (IA) d'après les signaux ci-dessus. Les données de tendances de recherche ne sont pas encore incluses.",

      "s5.title": "Coût et fourchette de vues",
      "s5.no_cost": "Indiquez votre coût de production dans le formulaire pour voir le coût pour 1 000 vues.",
      "s5.no_range": "Votre coût : {cost}. Il n'y a pas encore de fourchette de vues, donc pas de comparaison de coût.",
      "s5.your_cost": "Votre coût : {cost}.",
      "s5.col_views": "Vues en 12 mois",
      "s5.col_cost": "Coût pour 1 000 vues",
      "s5.low": "Bas",
      "s5.middle": "Milieu",
      "s5.high": "Haut",
      "s5.na": "indisponible",
      "s5.basis.track_record": "Les vues viennent de vos propres vidéos récentes (section 2), la preuve la plus directe qui soit.",
      "s5.basis.your_size": "Les vues viennent de vidéos similaires sur des chaînes de votre taille (section 2).",
      "s5.basis.estimate": "Les vues viennent de l'estimation de la section 2, pas de chaînes de votre taille : prenez ces chiffres avec encore plus de prudence.",

      "s6.title": "Idées de présentation",
      "s6.example": "Exemple de titre : « {title} »",
      "s6.checks": "À vérifier avant de publier",
      "s6.no_checks": "Aucune affirmation précise à vérifier n'a été trouvée.",
      "s6.ai_note": "Rédigé par Claude (IA) à partir de votre idée et des vidéos ci-dessus. C'est un deuxième avis, pas un fait.",
      "s6.missing": "Les idées de présentation et les points à vérifier nécessitent Claude (IA), qui n'est pas encore connecté. En attendant, servez-vous des formats de titre ci-dessus et des titres de la section 1 qui ont dépassé la moyenne de leur chaîne.",

      "limits.title": "Limites connues",
      "limits.text": "Ce sont des fourchettes observées sur des vidéos similaires, jamais une promesse de vues. Les vues dépendent aussi de la fréquence à laquelle YouTube montre une vidéo, ce que les petites chaînes ne contrôlent pas : dans nos propres tests, des vidéos aux taux de clic similaires ont eu entre 281 et 53 600 impressions.",

      "s7.title": "Ce rapport vous a-t-il été utile ?",
      "s7.useful": "Ce rapport vous a-t-il été utile ?",
      "s7.decision": "Aurait-il changé votre décision ?",
      "s7.changed": "Changée",
      "s7.confirmed": "Confirmée",
      "s7.no_effect": "Aucun effet",
      "s7.comment": "Autre chose ?",
      "s7.comment_ph": "Qu'est-ce qui manquait, était faux ou vous a le plus aidé ?",
      "s7.send": "Envoyer",
      "s7.thanks": "Merci ! Vous avez dit que le rapport était {useful} et qu'il {decision}. Vous pouvez changer vos réponses à tout moment.",
      "s7.useful_yes": "utile",
      "s7.useful_no": "pas utile",
      "s7.decision.changed": "a changé votre décision",
      "s7.decision.confirmed": "a confirmé votre décision",
      "s7.decision.no_effect": "n'a pas eu d'effet sur votre décision",

      "s8.title": "Vos vrais résultats",
      "s8.video": "Lien de la vidéo publiée",
      "s8.video_hint": "Collez-le dès que la vidéo est en ligne. Nous lisons ensuite ses vues sur YouTube automatiquement.",
      "s8.views_after": "Vues après…",
      "s8.d7": "7 jours",
      "s8.d30": "30 jours",
      "s8.d90": "90 jours",
      "s8.views_hint": "Avec le lien de la vidéo, vous pouvez laisser ces cases vides : nous lisons les vues nous-mêmes à 7, 30 et 90 jours après la publication. Si vous saisissez des chiffres de YouTube Studio, ce sont les vôtres qui comptent.",
      "s8.not_made": "J'ai décidé de ne pas faire cette vidéo",
      "s8.save": "Enregistrer",
      "s8.saved": "Résultats enregistrés. Merci !",
      "s8.intro_not_made": "Vous avez dit avoir décidé de ne pas faire cette vidéo. Merci de nous le dire : c'est aussi un résultat.",
      "s8.intro_tracking": "Nous suivons votre vidéo : ses vues sont lues automatiquement sur YouTube à 7, 30 et 90 jours après la publication. Vous n'avez rien d'autre à faire.",
      "s8.intro_reminder_sent": "Une fois la vidéo en ligne, collez son lien ici. Nous vous avons envoyé le rappel à 30 jours.",
      "s8.intro_reminder": "Une fois la vidéo en ligne, collez son lien ici et nous suivrons ses vues automatiquement. Si nous n'avons pas de lien le {date}, nous vous enverrons un rappel par e-mail.",
      "s8.intro_bookmark": "Une fois la vidéo en ligne, revenez sur cette page (ajoutez-la à vos favoris) et collez le lien de la vidéo. Nous suivrons ensuite ses vues automatiquement.",
      "s8.video_line": "« {title} » a été publiée {age} et avait {views} vues quand nous l'avons lue le {date}.",
      "s8.auto_title": "Lectures automatiques :",
      "s8.auto_done": "Jour {day} : {views} vues (lu le {date})",
      "s8.auto_planned": "Jour {day} : sera lu le {date}",
      "s8.auto_typed": "Jour {day} : vous l'avez saisi vous-même",
      "s8.auto_soon": "Jour {day} : lecture dans les prochaines 24 heures",
      "s8.auto_missed": "Jour {day} : le lien est arrivé après cette date, saisissez le chiffre depuis YouTube Studio si possible",
      "s8.compare_title": "Comparaison avec la fourchette du rapport :",
      "s8.compare_line": "Après {day} jours : {views} vues ({source}), {verdict} (attendu à ce stade : {low} à {high}, d'après {basis}).{usual}",
      "s8.source_typed": "votre chiffre",
      "s8.source_auto": "lu sur YouTube",
      "s8.verdict.below": "sous la fourchette",
      "s8.verdict.inside": "dans la fourchette",
      "s8.verdict.above": "au-dessus de la fourchette",
      "s8.basis.track_record": "vos propres vidéos récentes",
      "s8.basis.your_size": "les chaînes de votre taille",
      "s8.basis.estimate": "l'estimation",
      "s8.compare_note": "La fourchette sur 12 mois du rapport est ramenée à ce qu'une vidéo a en général après ce nombre de jours, pour comparer équitablement les premiers chiffres.",
      "s8.compare_note_old": "Ce rapport donnait les vues totales de vidéos plus anciennes, donc les premiers chiffres sont souvent sous la fourchette. Le chiffre à 90 jours est la comparaison la plus juste.",
      "s8.no_range": "Enregistré. Le rapport n'avait pas de fourchette de vues pour comparer ces chiffres.",
      "msg.video_read_failed": "Impossible de lire les vues actuelles sur YouTube. Vos chiffres ont quand même été enregistrés.",

      "find.page_title": "Retrouver votre rapport · Idea Check",
      "find.h1": "Vous avez perdu le lien de votre rapport ?",
      "find.intro": "Entrez l'adresse e-mail donnée dans le formulaire. Nous vous enverrons par e-mail les liens de tous vos rapports.",
      "find.email": "Votre e-mail",
      "find.submit": "M'envoyer mes liens",
      "find.sending": "Envoi…",
      "find.no_email": "Vous n'avez pas donné d'e-mail dans le formulaire ? Nous ne pouvons alors pas envoyer le lien. Contactez la personne qui vous a invité sur Idea Check : elle peut retrouver votre rapport.",
      "find.failed": "Envoi impossible. Vérifiez votre connexion et réessayez.",
      // Demande, adéquation, formats, idées liées, « fois votre habitude »
      "progress.related": "Recherche d'idées liées dont la demande est prouvée",
      "demand.title": "Y a-t-il de la demande ?",
      "demand.strong": "Forte demande",
      "demand.moderate": "Demande présente",
      "demand.weak": "Demande faible",
      "demand.thin": "Pas assez de vidéos similaires avec une moyenne de chaîne connue ({count}) pour juger la demande.",
      "demand.counts": "{outliers} vidéos similaires sur {total} ont dépassé de 3 fois ou plus la moyenne de leur propre chaîne (avec 1 000 vues ou plus) ; {under} ont obtenu moins de la moitié. La vidéo du milieu a obtenu {median}× la moyenne de sa chaîne.",
      "demand.note": "Une vidéo qui dépasse la moyenne de sa propre chaîne montre que les gens ont choisi le sujet lui-même, pas seulement qu'une grande chaîne l'a publié. Les échecs comptent aussi : ils montrent où le sujet n'attire pas. La moyenne de la chaîne est approximative (elle inclut les Shorts) : c'est un indice, pas une preuve.",
      "video.times": "{x}× la moyenne de sa chaîne",
      "fit.title": "Cela correspond-il à votre chaîne ?",
      "fit.close": "Proche : {matches} de vos {total} vidéos récentes partagent des mots-clés avec cette idée.",
      "fit.partial": "En partie : {matches} de vos {total} vidéos récentes partagent des mots-clés avec cette idée.",
      "fit.far": "Éloignée : seulement {matches} de vos {total} vidéos récentes partagent des mots-clés avec cette idée. Cela n'en fait pas une mauvaise idée, mais une vidéo éloignée de ce que regarde habituellement votre public peut attirer les mauvais spectateurs, et YouTube juge la satisfaction des spectateurs. Vérifiez qu'elle correspond à ceux qui vous suivent.",
      "fit.keywords_note": "Une vérification approximative, d'après les mots des titres seulement.",
      "fit.claude_close": "Proche de ce que regarde votre public.",
      "fit.claude_partial": "En partie proche de ce que regarde votre public.",
      "fit.claude_far": "Éloignée de ce que regarde habituellement votre public.",
      "fit.claude_note": "Jugé par Claude (IA) d'après les titres de vos vidéos récentes.",
      "formats.title": "Formats de titre dans cette niche",
      "formats.intro": "À quelle fréquence chaque façon de formuler un titre est apparue parmi les vidéos similaires, et ce que ces vidéos ont obtenu par rapport à la moyenne de leur propre chaîne. Les réussites et les échecs comptent.",
      "formats.row": "{count} vidéos : {outliers} ont dépassé de 3 fois ou plus la moyenne de leur chaîne, {under} ont obtenu moins de la moitié.",
      "formats.best": "La meilleure : ",
      "formats.none": "Aucun format de titre n'apparaît dans trois vidéos similaires ou plus : rien de fiable à en dire.",
      "formats.thin": "Trop peu de vidéos similaires avec une moyenne de chaîne connue pour comparer les formats.",
      "formats.caution": "Le format du titre n'est qu'une partie de ce qui fait marcher une vidéo : la miniature, la structure et la façon de présenter comptent aussi. Prenez cela comme un indice et regardez quelques-unes des gagnantes avant de copier une approche.",
      "fmt.how_to": "Comment faire…",
      "fmt.why": "Pourquoi…",
      "fmt.how_story": "Comment X est devenu / a construit / a perdu Y",
      "fmt.number_list": "Liste numérotée (7 choses…)",
      "fmt.rise_fall": "Ascension et chute",
      "fmt.untold_truth": "Vérité cachée / histoire jamais racontée",
      "fmt.most_biggest": "Le plus / la plus / le pire…",
      "fmt.i_did": "J'ai fait X et voici ce que j'ai appris…",
      "fmt.versus": "X contre Y",
      "fmt.new_era": "Nouvelles règles / nouvelle ère",
      "fmt.cheating": "Si vite que c'est de la triche / en N jours",
      "fmt.question": "Une question",
      "related.title": "Idées liées dont la demande est prouvée",
      "related.intro": "D'autres vidéos des chaînes les plus fortes ci-dessus qui ont aussi dépassé la moyenne de leur propre chaîne : des idées que votre public pourrait vouloir ensuite.",
      "related.ai_note": "Nommées et expliquées par Claude (IA) à partir des vidéos affichées. Ce sont des indices, pas une garantie.",
      "related.plain": "Claude (IA) n'est pas connecté : ces vidéos sont listées sans explication.",
      "related.none": "Aucune vidéo liée dépassant la moyenne de sa chaîne n'a été trouvée.",
      "related.why": "Pourquoi il y a de la demande : ",
      "related.angle": "Un angle pour vous : ",
      "s8.usual": "Soit {x}× votre habitude.",
      "s8.usual_note": "« Votre habitude » est le milieu des vues estimées de vos propres vidéos récentes, ramené au même nombre de jours.",

    },
  };

  const STORAGE_KEY = "idea-check-lang";
  const LANGS = ["en", "fr"];

  function save(lang) {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Private mode: the choice simply lasts for this page.
    }
  }

  // ?lang= in the address (used by email links), then the saved choice,
  // then the browser's language.
  function detect() {
    const asked = new URLSearchParams(location.search).get("lang");
    if (LANGS.includes(asked)) {
      save(asked);
      return asked;
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (LANGS.includes(saved)) return saved;
    } catch {
      // Fall through to the browser's language.
    }
    return /^fr/i.test(navigator.language || "") ? "fr" : "en";
  }

  let lang = detect();
  const listeners = [];

  function t(key, params = {}) {
    const text = DICT[lang][key] ?? DICT.en[key] ?? key;
    return text.replace(/\{(\w+)\}/g, (match, name) => (params[name] ?? match));
  }

  function apply(root = document) {
    document.documentElement.lang = lang;
    const titleKey = document.documentElement.dataset.i18nTitle;
    if (titleKey) document.title = t(titleKey);
    root.querySelectorAll("[data-i18n]").forEach((node) => (node.textContent = t(node.dataset.i18n)));
    root.querySelectorAll("[data-i18n-placeholder]").forEach((node) => (node.placeholder = t(node.dataset.i18nPlaceholder)));
    root.querySelectorAll("[data-i18n-suffix]").forEach((node) => (node.dataset.suffix = t(node.dataset.i18nSuffix)));
    document.querySelectorAll(".lang-switch button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.lang === lang)));
  }

  function setLang(next) {
    if (!LANGS.includes(next) || next === lang) return;
    lang = next;
    save(next);
    apply();
    listeners.forEach((listener) => listener(next));
  }

  // EN | FR buttons in the header.
  function addSwitch() {
    const header = document.querySelector(".site-header");
    if (!header || header.querySelector(".lang-switch")) return;
    const box = document.createElement("div");
    box.className = "lang-switch";
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", "Language / Langue");
    for (const code of LANGS) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.lang = code;
      button.textContent = code.toUpperCase();
      button.addEventListener("click", () => setLang(code));
      box.append(button);
    }
    (header.querySelector(".header-actions") || header).append(box);
  }

  window.I18N = {
    t,
    apply,
    setLang,
    onChange: (listener) => listeners.push(listener),
    get lang() {
      return lang;
    },
    // For number and date formatting.
    get locale() {
      return lang === "fr" ? "fr-FR" : "en-US";
    },
  };

  addSwitch();
  apply();
})();
