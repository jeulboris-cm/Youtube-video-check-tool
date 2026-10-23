// The server's own words (form errors, messages and emails) in English and
// French. The pages translate everything else themselves (public/i18n.js).

const LANGUAGES = ["en", "fr"];

const MESSAGES = {
  en: {
    "err.number": "Enter a number of 0 or more.",
    "err.whole_number": "Enter a whole number of 0 or more.",
    "err.idea_required": "Describe the idea in one or two sentences.",
    "err.idea_long": "Keep the idea under 1,000 characters.",
    "err.title_required": "Enter a working title.",
    "err.title_long": "Keep the title under 200 characters.",
    "err.channel_required": "Enter your YouTube channel link.",
    "err.channel_invalid": "Enter a YouTube channel link, like https://www.youtube.com/@yourchannel.",
    "err.email_invalid": "Enter a valid email address, or leave it empty.",
    "err.news_tied": "Choose yes, no or not sure.",
    "err.video_invalid": "Enter a YouTube video link, like https://www.youtube.com/watch?v=…",
    "err.video_not_found": "No public YouTube video found at that link.",
    "err.useful": "Choose yes or no.",
    "err.decision": "Choose one answer.",
    "err.comment_long": "Keep the comment under 2,000 characters.",
    "err.find_email": "Enter the email address you gave on the form.",
    "msg.not_found": "Report not found.",
    "msg.already_building": "This report is already built or still building.",
    "msg.email_off": "Email is not set up yet. Please contact the person who invited you to Idea Check.",
    "msg.too_many": "Too many requests. Please try again in an hour.",
    "msg.find_sent": "If we have reports for that address, we have just emailed the links to it. Check your spam folder too.",
    "msg.bad_request": "The request could not be read.",
    "msg.server_error": "Something went wrong on the server. Try again.",
    "msg.video_read_failed": "Could not read the current views from YouTube. Your numbers were still saved.",

    "mail.report.subject": 'Your Idea Check report: "{title}"',
    "mail.report.body":
      'Hi,\n\nHere is the link to your Idea Check report for:\n"{title}"\n\n{link}\n\n' +
      "Keep this email: the link is the only way back to your report, and it is where you add your " +
      "video's link once it is out. Anyone with the link can open the report, so share it with care.\n\n" +
      "In {days} days we will send you one reminder.\n\nIdea Check",
    "mail.reminder.subject": 'How did "{title}" do?',
    "mail.reminder.body":
      'Hi,\n\n{days} days ago you checked this idea on Idea Check:\n"{title}"\n\n' +
      "If you made the video, could you paste its YouTube link on your report? It takes a minute. " +
      "We then read its views by ourselves at 7, 30 and 90 days after publishing, which tells us " +
      "whether the predicted range was right: the only way to make the tool better.\n\n" +
      "Your report: {link}\n\n" +
      "If you decided not to make the video, you can tick that on the same page. It helps us too.\n\n" +
      "This is the only reminder we will send for this idea.\n\nIdea Check",
    "mail.links.subject.one": "Your Idea Check report link",
    "mail.links.subject.many": "Your Idea Check report links",
    "mail.links.item": '- "{title}" (checked {date})\n  {link}',
    "mail.links.body":
      "Hi,\n\nSomeone (hopefully you) asked for the Idea Check reports checked with this email address. " +
      "Here they are:\n\n{list}\n\nIf you did not ask for this, you can ignore this email.\n\nIdea Check",
  },
  fr: {
    "err.number": "Entrez un nombre égal ou supérieur à 0.",
    "err.whole_number": "Entrez un nombre entier égal ou supérieur à 0.",
    "err.idea_required": "Décrivez l'idée en une ou deux phrases.",
    "err.idea_long": "L'idée doit faire moins de 1 000 caractères.",
    "err.title_required": "Entrez un titre provisoire.",
    "err.title_long": "Le titre doit faire moins de 200 caractères.",
    "err.channel_required": "Entrez le lien de votre chaîne YouTube.",
    "err.channel_invalid": "Entrez un lien de chaîne YouTube, par exemple https://www.youtube.com/@votrechaine.",
    "err.email_invalid": "Entrez une adresse e-mail valide, ou laissez le champ vide.",
    "err.news_tied": "Choisissez oui, non ou je ne sais pas.",
    "err.video_invalid": "Entrez un lien de vidéo YouTube, par exemple https://www.youtube.com/watch?v=…",
    "err.video_not_found": "Aucune vidéo YouTube publique trouvée à ce lien.",
    "err.useful": "Choisissez oui ou non.",
    "err.decision": "Choisissez une réponse.",
    "err.comment_long": "Le commentaire doit faire moins de 2 000 caractères.",
    "err.find_email": "Entrez l'adresse e-mail donnée dans le formulaire.",
    "msg.not_found": "Rapport introuvable.",
    "msg.already_building": "Ce rapport est déjà prêt ou en cours de préparation.",
    "msg.email_off": "L'envoi d'e-mails n'est pas encore configuré. Contactez la personne qui vous a invité sur Idea Check.",
    "msg.too_many": "Trop de demandes. Réessayez dans une heure.",
    "msg.find_sent": "Si nous avons des rapports pour cette adresse, nous venons d'y envoyer les liens. Vérifiez aussi vos spams.",
    "msg.bad_request": "La demande n'a pas pu être lue.",
    "msg.server_error": "Un problème est survenu sur le serveur. Réessayez.",
    "msg.video_read_failed": "Impossible de lire les vues actuelles sur YouTube. Vos chiffres ont quand même été enregistrés.",

    "mail.report.subject": "Votre rapport Idea Check : « {title} »",
    "mail.report.body":
      "Bonjour,\n\nVoici le lien vers votre rapport Idea Check pour :\n« {title} »\n\n{link}\n\n" +
      "Gardez cet e-mail : ce lien est le seul moyen de retrouver votre rapport, et c'est là que vous " +
      "ajouterez le lien de votre vidéo une fois publiée. Toute personne qui a le lien peut ouvrir le " +
      "rapport, partagez-le donc avec prudence.\n\nDans {days} jours, nous vous enverrons un seul rappel.\n\nIdea Check",
    "mail.reminder.subject": "Comment s'en sort « {title} » ?",
    "mail.reminder.body":
      "Bonjour,\n\nIl y a {days} jours, vous avez testé cette idée sur Idea Check :\n« {title} »\n\n" +
      "Si vous avez fait la vidéo, pouvez-vous coller son lien YouTube sur votre rapport ? Cela prend une " +
      "minute. Nous lirons ensuite ses vues nous-mêmes à 7, 30 et 90 jours après la publication, ce qui " +
      "nous dira si la fourchette prévue était juste : c'est le seul moyen d'améliorer l'outil.\n\n" +
      "Votre rapport : {link}\n\n" +
      "Si vous avez décidé de ne pas faire la vidéo, vous pouvez le cocher sur la même page. Cela nous aide aussi.\n\n" +
      "C'est le seul rappel que nous enverrons pour cette idée.\n\nIdea Check",
    "mail.links.subject.one": "Le lien de votre rapport Idea Check",
    "mail.links.subject.many": "Les liens de vos rapports Idea Check",
    "mail.links.item": "- « {title} » (testée le {date})\n  {link}",
    "mail.links.body":
      "Bonjour,\n\nQuelqu'un (vous, normalement) a demandé les rapports Idea Check liés à cette adresse e-mail. " +
      "Les voici :\n\n{list}\n\nSi vous n'avez rien demandé, vous pouvez ignorer cet e-mail.\n\nIdea Check",
  },
};

function normalize(lang) {
  return LANGUAGES.includes(lang) ? lang : "en";
}

// The language of a request: the page's choice, else the browser's.
function fromRequest(req) {
  const chosen = req.body?.language || req.query?.lang;
  if (LANGUAGES.includes(chosen)) return chosen;
  return /^fr\b/i.test(req.get("accept-language") || "") ? "fr" : "en";
}

function t(lang, key, params = {}) {
  const text = MESSAGES[normalize(lang)][key] ?? MESSAGES.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, name) => (params[name] ?? `{${name}}`));
}

// Turns { field: "err.key" } into { field: "message in lang" }.
function errors(lang, keys) {
  return Object.fromEntries(Object.entries(keys).map(([field, key]) => [field, t(lang, key)]));
}

module.exports = { LANGUAGES, normalize, fromRequest, t, errors };
