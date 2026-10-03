// Fetches stats for every player in players.json and writes data/stats.json
// and data/history.json. Run by .github/workflows/update-stats.yml.
import { readFile, writeFile } from 'node:fs/promises';

const KEY = process.env.FORTNITE_API_KEY;
if (!KEY) {
  console.error('FORTNITE_API_KEY is not set');
  process.exit(1);
}

const API = 'https://fortnite-api.com/v2/stats/br/v2';
const STATS_PATH = 'data/stats.json';
const HISTORY_PATH = 'data/history.json';

const readJson = async (path, fallback) => {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return fallback;
  }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWindow(player, timeWindow) {
  const url = new URL(API);
  url.searchParams.set('name', player.name);
  url.searchParams.set('accountType', player.accountType ?? 'epic');
  url.searchParams.set('timeWindow', timeWindow);
  const res = await fetch(url, { headers: { Authorization: KEY } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${body.error ?? res.statusText}`);
  return body.data;
}

// Keep only the fields the site uses, so diffs stay small.
const pick = (m) =>
  m && {
    wins: m.wins,
    kills: m.kills,
    deaths: m.deaths,
    matches: m.matches,
    kd: m.kd,
    winRate: m.winRate,
    minutesPlayed: m.minutesPlayed,
    score: m.score,
  };

const modes = (d) => ({
  overall: pick(d?.stats?.all?.overall),
  solo: pick(d?.stats?.all?.solo),
  duo: pick(d?.stats?.all?.duo),
  squad: pick(d?.stats?.all?.squad),
});

const players = await readJson('players.json', []);
const previous = await readJson(STATS_PATH, { players: [] });
const history = await readJson(HISTORY_PATH, {});
const prevByName = new Map(previous.players.map((p) => [p.name.toLowerCase(), p]));

const out = [];
for (const player of players) {
  const old = prevByName.get(player.name.toLowerCase());
  try {
    const lifetime = await fetchWindow(player, 'lifetime');
    await sleep(500);
    const season = await fetchWindow(player, 'season');
    await sleep(500);
    const entry = {
      name: lifetime.account.name,
      accountType: player.accountType ?? 'epic',
      level: lifetime.battlePass?.level ?? null,
      lifetime: modes(lifetime),
      season: modes(season),
    };
    out.push(entry);

    // History: append a snapshot only when the player has played new matches.
    const o = entry.lifetime.overall;
    const snaps = (history[entry.name] ??= []);
    const last = snaps.at(-1);
    if (o && (!last || last.matches !== o.matches)) {
      snaps.push({
        t: new Date().toISOString(),
        matches: o.matches,
        wins: o.wins,
        kills: o.kills,
        deaths: o.deaths,
        minutesPlayed: o.minutesPlayed,
      });
    }
  } catch (err) {
    console.warn(`${player.name}: ${err.message}`);
    // Keep last known good data and flag the error.
    out.push({
      ...(old ?? { name: player.name, accountType: player.accountType ?? 'epic' }),
      error: err.message,
    });
  }
}

// Only touch stats.json when something changed, so cron runs don't create empty commits.
const strip = (s) => JSON.stringify(s.players);
if (strip(previous) !== JSON.stringify(out)) {
  await writeFile(
    STATS_PATH,
    JSON.stringify({ updatedAt: new Date().toISOString(), players: out }, null, 2) + '\n',
  );
}
await writeFile(HISTORY_PATH, JSON.stringify(history, null, 1) + '\n');
