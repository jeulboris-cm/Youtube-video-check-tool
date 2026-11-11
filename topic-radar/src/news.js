// This week's news headlines on a subject, from Google News search feeds.
// Free and needs no key. Google allows these feeds for personal,
// non-commercial use, which is what this agent is: a private research tool.

const FEED = "https://news.google.com/rss/search";

const LOCALES = {
  en: { hl: "en-US", gl: "US", ceid: "US:en" },
  fr: { hl: "fr", gl: "FR", ceid: "FR:fr" },
};

function decode(text) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&")
    .trim();
}

const tag = (xml, name) => {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(xml);
  return m ? decode(m[1]) : "";
};

// Turns a feed into [{ title, source, date, link }]. Google puts the outlet
// at the end of the title ("Headline - Reuters"); it is split off.
function parseFeed(xml) {
  const items = [];
  for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const source = tag(item, "source");
    let title = tag(item, "title");
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    const date = Date.parse(tag(item, "pubDate"));
    items.push({
      title,
      source,
      date: Number.isFinite(date) ? new Date(date).toISOString().slice(0, 10) : null,
      link: tag(item, "link"),
    });
  }
  return items;
}

// Headlines matching `query` from the last `days` days, newest first.
async function searchNews(query, { days = 7, language = "en", max = 25 } = {}) {
  const locale = LOCALES[language] || LOCALES.en;
  const url = new URL(FEED);
  url.searchParams.set("q", `${query} when:${Math.max(1, Math.min(30, days))}d`);
  for (const [k, v] of Object.entries(locale)) url.searchParams.set(k, v);
  const response = await fetch(url, { headers: { "User-Agent": "topic-radar/0.1" } });
  if (!response.ok) throw new Error(`Google News answered ${response.status}`);
  const seen = new Set();
  return parseFeed(await response.text())
    .filter((item) => {
      const key = item.title.toLowerCase();
      return item.title && !seen.has(key) && seen.add(key);
    })
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .slice(0, max);
}

module.exports = { searchNews, parseFeed };
