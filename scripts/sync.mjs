#!/usr/bin/env node
// Pulls 20850C's results from the VEX events API (events.vex.com, formerly
// RobotEvents) and writes the data file the site reads.
//
//   ROBOTEVENTS_TOKEN=... node scripts/sync.mjs     fetch, then build
//   node scripts/sync.mjs --offline                 rebuild from the saved snapshot
//
// Outputs
//   data/snapshot.compact.json   trimmed API response (the build input; committed)
//   data/team.json               what the site renders, as JSON
//   data/team.js                 the same, as `window.LUCKY = …` so the page also works from file://

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data");
const API = "https://events.vex.com/api/v2";
const TEAM_ID = 187139;
const TEAM = "20850C";
const SEASONS = [197, 204]; // Push Back 2025–26, Override 2026–27

// ---------------------------------------------------------------- fetch ----

async function getAll(pathname, token) {
  const out = [];
  for (let page = 1; ; page++) {
    const sep = pathname.includes("?") ? "&" : "?";
    const url = `${API}${pathname}${sep}per_page=250&page=${page}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
    const body = await res.json();
    out.push(...body.data);
    if (!body.meta || body.meta.current_page >= body.meta.last_page) return out;
  }
}

async function getOne(pathname, token) {
  const res = await fetch(`${API}${pathname}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${pathname}`);
  return res.json();
}

// Trim the API's verbose objects down to positional rows. The same shape is
// produced by hand when a snapshot is taken from a logged-in browser session.
function compact(team, raw) {
  const C = {
    fetched_at: new Date().toISOString(),
    team: {
      id: team.id,
      number: team.number,
      team_name: team.team_name,
      organization: (team.organization || "").trim(),
      city: team.location?.city,
      region: team.location?.region,
      grade: team.grade,
      program: team.program?.code,
    },
    events: [], rankings: [], awards: [], skills: [], matches: [],
  };
  for (const s of SEASONS) {
    const r = raw[s];
    for (const e of r.events)
      C.events.push([s, e.id, e.sku, e.name, e.start.slice(0, 10), e.end.slice(0, 10), e.level,
        e.location?.venue, e.location?.city, e.location?.region,
        (e.divisions || []).map((d) => d.name).join("|"), e.awards_finalized ? 1 : 0]);
    for (const k of r.rankings)
      C.rankings.push([s, k.event.id, k.division.name, k.rank, k.wins, k.losses, k.ties, k.wp, k.ap, k.sp,
        k.high_score, k.average_points, k.opr ?? null, k.dpr ?? null, k.ccwm ?? null]);
    for (const a of r.awards) C.awards.push([s, a.event.id, a.title.trim(), a.qualifications || []]);
    for (const k of r.skills) C.skills.push([s, k.event.id, k.type, k.score, k.rank, k.attempts]);
    for (const m of r.matches) {
      const red = m.alliances.find((a) => a.color === "red");
      const blue = m.alliances.find((a) => a.color === "blue");
      const names = (a) => a.teams.map((t) => t.team.name).join(" ");
      C.matches.push([s, m.event.id, m.division.name, m.round, m.instance, m.matchnum,
        (m.started || m.scheduled || "").slice(0, 16), m.field || "",
        red.score, blue.score, names(red), names(blue), m.scored ? 1 : 0]);
    }
  }
  return C;
}

// ---------------------------------------------------------------- build ----

const ROUND = {
  1: { key: "P", name: "Practice", order: 0 },
  2: { key: "Q", name: "Qualification", order: 1 },
  7: { key: "R32", name: "Round of 32", order: 2 },
  6: { key: "R16", name: "Round of 16", order: 3 },
  3: { key: "QF", name: "Quarterfinal", order: 4 },
  4: { key: "SF", name: "Semifinal", order: 5 },
  5: { key: "F", name: "Final", order: 6 },
};

function matchLabel(round, instance, num) {
  const r = ROUND[round] || { key: `R${round}` };
  if (r.key === "Q" || r.key === "P") return `${r.key}${num}`;
  return `${r.key} ${instance}-${num}`;
}

// Where the team's run ended at an event, read off its elimination matches.
function finish(matches, awards) {
  if (awards.some((a) => /Tournament Champions/i.test(a.title))) return "Champions";
  if (awards.some((a) => /Tournament Finalists/i.test(a.title))) return "Finalists";
  const elims = matches.filter((m) => m.played && ROUND[m.round]?.order >= 2);
  if (!elims.length) return matches.some((m) => m.played && m.round === 2) ? "Qualifications" : null;
  const top = elims.reduce((a, b) => (ROUND[b.round].order >= ROUND[a.round].order ? b : a));
  const atTop = elims.filter((m) => m.round === top.round);
  const wins = atTop.filter((m) => m.result === "W").length;
  const losses = atTop.filter((m) => m.result === "L").length;
  if (top.round === 5) return wins > losses ? "Champions" : "Finalists";
  if (wins > losses) return `Won ${ROUND[top.round].name}`; // event data incomplete past this point
  return { 4: "Semifinalists", 3: "Quarterfinalists", 6: "Round of 16", 7: "Round of 32" }[top.round];
}

function build(C, extras) {
  const videoByMatch = new Map(extras.videos.map((v) => [`${v.event}:${v.match}`, v.id]));
  const seasons = {};

  for (const sid of SEASONS) {
    const meta = extras.seasons[sid] || { name: String(sid), years: "" };
    const events = C.events
      .filter((e) => e[0] === sid)
      .map(([, id, sku, name, start, end, level, venue, city, region, divisions, finalized]) => {
        const rk = C.rankings.find((r) => r[0] === sid && r[1] === id);
        const sk = C.skills.filter((k) => k[0] === sid && k[1] === id);
        const driver = sk.find((k) => k[2] === "driver");
        const prog = sk.find((k) => k[2] === "programming");
        const awards = C.awards
          .filter((a) => a[0] === sid && a[1] === id)
          .map(([, , title, quals]) => ({ title: title.replace(/\s*\((V5|WC)\)\s*$/, ""), raw: title, qualifies: quals }));

        const matches = C.matches
          .filter((m) => m[0] === sid && m[1] === id)
          .map(([, , division, round, instance, num, time, field, redScore, blueScore, red, blue]) => {
            const redTeams = red.split(" ").filter(Boolean);
            const blueTeams = blue.split(" ").filter(Boolean);
            const color = redTeams.includes(TEAM) ? "red" : "blue";
            const ours = color === "red" ? redTeams : blueTeams;
            const theirs = color === "red" ? blueTeams : redTeams;
            const us = color === "red" ? redScore : blueScore;
            const them = color === "red" ? blueScore : redScore;
            // A 0–0 at an event whose results were never finalized is a match that wasn't scored.
            const played = !(us === 0 && them === 0 && !finalized);
            const result = !played ? null : us > them ? "W" : us < them ? "L" : "T";
            return {
              round, instance, num, division, time, field,
              stage: ROUND[round]?.key || `R${round}`,
              label: matchLabel(round, instance, num),
              color, partners: ours.filter((t) => t !== TEAM), opponents: theirs,
              us, them, played, result,
              video: videoByMatch.get(`${id}:${round}-${instance}-${num}`) || null,
            };
          })
          .sort((a, b) => (a.time || "").localeCompare(b.time || "") || ROUND[a.round].order - ROUND[b.round].order || a.num - b.num);

        // The official ranking record wins over a tally of posted scores (DQs and corrections only show up there).
        const q = matches.filter((m) => m.played && m.round === 2);
        const tally = ["W", "L", "T"].map((r) => q.filter((m) => m.result === r).length);
        const mismatch = rk && (rk[4] !== tally[0] || rk[5] !== tally[1] || rk[6] !== tally[2]);
        const autoNote = mismatch
          ? `Official ranking record is ${rk[4]}-${rk[5]}-${rk[6]}; the posted match scores add up to ${tally.join("-")}.`
          : null;

        return {
          id, sku, name, short: extras.shortNames[id] || name, start, end, level,
          venue, city, region, divisions: divisions ? divisions.split("|") : [],
          finalized: !!finalized,
          division: rk ? rk[2] : matches[0]?.division || null,
          rank: rk ? { rank: rk[3], w: rk[4], l: rk[5], t: rk[6], wp: rk[7], ap: rk[8], sp: rk[9], high: rk[10], avg: rk[11] } : null,
          skills: sk.length ? { driver: driver?.[3] ?? 0, programming: prog?.[3] ?? 0, rank: (driver || prog)[4] } : null,
          awards, matches,
          finish: finish(matches, awards),
          note: [extras.notes[id], autoNote].filter(Boolean).join(" ") || null,
          qualTally: { w: tally[0], l: tally[1], t: tally[2] },
          url: `https://events.vex.com/events/${sku}.html`,
        };
      })
      .sort((a, b) => a.start.localeCompare(b.start));

    const all = events.flatMap((e) => e.matches.filter((m) => m.played && m.round !== 1).map((m) => ({ ...m, event: e.id })));
    const quals = all.filter((m) => m.round === 2);
    const elims = all.filter((m) => ROUND[m.round].order >= 2);
    // Qualification record per event: official rankings where they exist, otherwise the score tally.
    const qual = events.reduce((acc, e) => {
      const r = e.rank || e.qualTally;
      return { w: acc.w + r.w, l: acc.l + r.l, t: acc.t + r.t };
    }, { w: 0, l: 0, t: 0 });
    const elim = { w: elims.filter((m) => m.result === "W").length, l: elims.filter((m) => m.result === "L").length };
    const skillRows = events.filter((e) => e.skills);
    const best = (f) => skillRows.reduce((b, e) => (f(e) > (b ? f(b) : -1) ? e : b), null);
    const bestDriver = best((e) => e.skills.driver);
    const bestProg = best((e) => e.skills.programming);
    const bestCombined = best((e) => e.skills.driver + e.skills.programming);

    seasons[sid] = {
      id: sid, name: meta.name, years: meta.years,
      events,
      totals: {
        events: events.filter((e) => e.matches.some((m) => m.played)).length,
        matches: all.length,
        qual, elim,
        wins: qual.w + elim.w, losses: qual.l + elim.l, ties: qual.t,
        high: all.length ? Math.max(...all.map((m) => m.us)) : null,
        avg: all.length ? Math.round((all.reduce((s, m) => s + m.us, 0) / all.length) * 10) / 10 : null,
        margin: all.length ? Math.round((all.reduce((s, m) => s + m.us - m.them, 0) / all.length) * 10) / 10 : null,
        driver: bestDriver ? { score: bestDriver.skills.driver, event: bestDriver.id } : null,
        programming: bestProg ? { score: bestProg.skills.programming, event: bestProg.id } : null,
        combined: bestCombined ? { score: bestCombined.skills.driver + bestCombined.skills.programming, event: bestCombined.id } : null,
        awards: events.reduce((n, e) => n + e.awards.length, 0),
        bestRank: events.filter((e) => e.rank).reduce((b, e) => (!b || e.rank.rank < b.rank ? { rank: e.rank.rank, event: e.id } : b), null),
      },
    };
  }

  return {
    generated_at: new Date().toISOString(),
    fetched_at: C.fetched_at,
    source: `${API}/teams/${TEAM_ID}`,
    team: C.team,
    seasonOrder: SEASONS,
    seasons,
    videos: extras.videos,
    streams: extras.streams,
  };
}

// ----------------------------------------------------------------- main ----

const offline = process.argv.includes("--offline");
const token = (process.env.ROBOTEVENTS_TOKEN || "").trim(); // piped secrets can carry a trailing newline
const snapshotPath = path.join(DATA, "snapshot.compact.json");

let C;
if (offline || !token) {
  if (!offline) console.warn("ROBOTEVENTS_TOKEN not set, rebuilding from the saved snapshot.");
  C = JSON.parse(await readFile(snapshotPath, "utf8"));
} else {
  const team = await getOne(`/teams/${TEAM_ID}`, token);
  const raw = {};
  for (const s of SEASONS) {
    raw[s] = {};
    for (const k of ["events", "awards", "rankings", "skills", "matches"]) {
      raw[s][k] = await getAll(`/teams/${TEAM_ID}/${k}?season[]=${s}`, token);
    }
    console.log(`season ${s}: ${Object.entries(raw[s]).map(([k, v]) => `${v.length} ${k}`).join(", ")}`);
  }
  C = compact(team, raw);
  // Keep the snapshot stable when nothing changed, so the nightly job doesn't commit a timestamp.
  const prev = await readFile(snapshotPath, "utf8").then(JSON.parse).catch(() => null);
  const same = prev && JSON.stringify({ ...prev, fetched_at: 0 }) === JSON.stringify({ ...C, fetched_at: 0 });
  if (same) C.fetched_at = prev.fetched_at;
  await writeFile(snapshotPath, JSON.stringify(C) + "\n");
}

const extras = JSON.parse(await readFile(path.join(DATA, "extras.json"), "utf8"));
const site = build(C, extras);
site.generated_at = C.fetched_at; // tie the site's "updated" stamp to the data, not to the build
const json = JSON.stringify(site);
await writeFile(path.join(DATA, "team.json"), json + "\n");
await writeFile(path.join(DATA, "team.js"), `window.LUCKY = ${json};\n`);

for (const sid of SEASONS) {
  const t = site.seasons[sid].totals;
  console.log(`${site.seasons[sid].name}: ${t.events} events, ${t.wins}-${t.losses}-${t.ties}, ${t.awards} awards, best driver ${t.driver?.score ?? "-"}`);
}
