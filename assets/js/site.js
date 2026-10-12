// Lucky Cats 20850C. Everything data-driven reads window.LUCKY (data/team.js),
// which scripts/sync.mjs regenerates from the VEX events API.

const D = window.LUCKY;
const TEAM = "20850C";
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const STATES = { Maryland: "MD", Virginia: "VA", "West Virginia": "WV", Tennessee: "TN", Missouri: "MO", Pennsylvania: "PA", Delaware: "DE", "District of Columbia": "DC" };
const ymd = (s) => s.split("-").map(Number);
const fmtDate = (s) => { const [y, m, d] = ymd(s); return `${MONTHS[m - 1]} ${d}, ${y}`; };
function fmtRange(a, b) {
  const [y1, m1, d1] = ymd(a), [y2, m2, d2] = ymd(b);
  if (a === b) return `${MONTHS[m1 - 1]} ${d1}`;
  if (m1 === m2 && y1 === y2) return `${MONTHS[m1 - 1]} ${d1}–${d2}`;
  return `${MONTHS[m1 - 1]} ${d1} – ${MONTHS[m2 - 1]} ${d2}`;
}
const ordinal = (n) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const place = (e) => [e.city, STATES[e.region] || e.region].filter(Boolean).join(", ");
const pct = (w, l, t) => (w + l + t ? Math.round((1000 * w) / (w + l + t)) / 10 : 0);

const allEvents = () => D.seasonOrder.flatMap((s) => D.seasons[s].events.map((e) => ({ ...e, season: s })));
const eventById = (id) => allEvents().find((e) => e.id === id);

// ---------------------------------------------------------------- season ----
// Default to the newest season once it has a few events behind it; until then
// the finished one tells the better story.
function defaultSeason() {
  const order = [...D.seasonOrder].reverse();
  const ready = order.find((s) => D.seasons[s].totals.events >= 3);
  return ready ?? order[order.length - 1];
}
let season = (() => {
  try {
    const saved = Number(localStorage.getItem("lc-season"));
    if (D.seasons[saved]) return saved;
  } catch {}
  return defaultSeason();
})();

function buildSwitches() {
  for (const sw of $$("[data-switch]")) {
    for (const sid of D.seasonOrder) {
      const s = D.seasons[sid];
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "radio");
      b.dataset.season = sid;
      b.innerHTML = `${esc(s.name)}<small>${esc(s.years.replace(/^20/, "’"))}</small>`;
      b.addEventListener("click", () => setSeason(sid));
      sw.append(b);
    }
    sw.addEventListener("keydown", (e) => {
      if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
      const i = D.seasonOrder.indexOf(season) + (e.key === "ArrowRight" ? 1 : -1);
      const next = D.seasonOrder[(i + D.seasonOrder.length) % D.seasonOrder.length];
      setSeason(next);
      $(`[data-season="${next}"]`, sw).focus();
    });
  }
  syncSwitches();
}

function syncSwitches() {
  for (const sw of $$("[data-switch]")) {
    let on;
    for (const b of $$("button", sw)) {
      const yes = Number(b.dataset.season) === season;
      b.setAttribute("aria-checked", yes);
      b.tabIndex = yes ? 0 : -1;
      if (yes) on = b;
    }
    const thumb = $(".switch__thumb", sw);
    if (on && thumb) {
      thumb.style.width = `${on.offsetWidth}px`;
      thumb.style.transform = `translateX(${on.offsetLeft}px)`;
    }
  }
}

function setSeason(sid) {
  if (sid === season) return;
  season = sid;
  try { localStorage.setItem("lc-season", sid); } catch {}
  syncSwitches();
  renderSeason(true);
}

function renderSeason(animate = false) {
  const S = D.seasons[season];
  for (const el of $$("[data-season-caption]")) el.textContent = `${S.name}, ${S.years}`;
  renderAccolades(S);
  renderLedger(S, animate);
  renderChart(S, animate);
  renderTimeline(S);
  renderAoeNotes(S);
}

// ------------------------------------------------------------- accolades ----
function awardTier(a, e) {
  if (e.level === "World") return { cls: "award--world", tier: "World Championship" };
  if (/Champions/i.test(a.title)) return { cls: "award--champ", tier: "Tournament win" };
  if (e.level === "Regional") return { cls: "", tier: "State Championship" };
  if (e.level === "Signature") return { cls: "", tier: "Signature Event" };
  return { cls: "", tier: "Tournament" };
}

function renderAccolades(S) {
  const list = $("#accoladeList");
  const items = S.events
    .flatMap((e) => e.awards.map((a) => ({ a, e })))
    .sort((x, y) => (y.e.level === "World") - (x.e.level === "World") || y.e.start.localeCompare(x.e.start));

  if (!items.length) {
    const played = S.events.filter((e) => e.rank);
    const latest = played[played.length - 1];
    list.innerHTML = `
      <article class="award award--empty" style="--i:0">
        <h3 class="award__title">No awards yet.</h3>
        <p>${latest
          ? `${esc(S.name)} is ${played.length === 1 ? "one event" : `${played.length} events`} old. Most recently: ${latest.rank.w}–${latest.rank.l}${latest.rank.t ? `–${latest.rank.t}` : ""} in qualifications and ranked ${ordinal(latest.rank.rank)} at ${esc(latest.short)}${latest.skills ? `, with a ${latest.skills.driver}-point driver skills run` : ""}. This space fills in as the season goes.`
          : `The ${esc(S.name)} season hasn't started for us yet.`}</p>
      </article>`;
    return;
  }

  list.innerHTML = items.map(({ a, e }, i) => {
    const t = awardTier(a, e);
    const quals = a.qualifies.length ? `<span>Qualified for ${esc(a.qualifies.join(", ").replace("Event Region Championship", "State"))}</span>` : "";
    return `
      <article class="award ${t.cls}" style="--i:${i}">
        <span class="award__tier">${esc(t.tier)}</span>
        <h3 class="award__title">${esc(a.title)}</h3>
        <p class="award__event">${esc(e.short)}${e.level === "World" && e.division ? ` · ${esc(e.division)} Division` : ""}</p>
        <p class="award__meta"><span>${esc(fmtDate(e.end))}</span><span>${esc(place(e))}</span>${quals}</p>
      </article>`;
  }).join("");
}

// ---------------------------------------------------------------- ledger ----
let ledgerSeen = false;
function renderLedger(S, animate) {
  const T = S.totals;
  const ev = (id) => eventById(id)?.short ?? "";
  const cells = [
    { v: pct(T.wins, T.losses, T.ties), d: 1, unit: "%", k: "Win rate", where: `${T.matches} matches` },
    { v: T.events, k: "Events", where: (() => {
      const played = S.events.filter((e) => e.matches.some((m) => m.played));
      const sig = played.filter((e) => e.level === "Signature").length;
      return `${sig ? `${sig} Signature` : "no Signature events"}, ${played.some((e) => e.level === "World") ? "plus Worlds" : "no Worlds yet"}`;
    })() },
    { v: T.bestRank?.rank ?? 0, ord: true, k: "Best rank", where: ev(T.bestRank?.event) },
    { v: T.awards, k: "Awards", where: T.awards ? "see above" : "none yet" },
    { v: T.high ?? 0, k: "High score", where: "alliance total" },
    { v: T.avg ?? 0, d: 1, k: "Average score", where: `${T.margin >= 0 ? "+" : ""}${T.margin} average margin` },
    { v: T.driver?.score ?? 0, k: "Driver skills", where: ev(T.driver?.event) },
    { v: T.programming?.score ?? 0, k: "Auton skills", where: ev(T.programming?.event) },
  ];
  $("#ledger").innerHTML = `
    <div class="ledger__record">
      <p class="ledger__k">${esc(S.name)} record · W–L${T.ties ? "–T" : ""}</p>
      <p class="ledger__big"><span data-count="${T.wins}">${T.wins}</span><span class="dash">–</span><span data-count="${T.losses}">${T.losses}</span>${T.ties ? `<span class="dash">–</span><span data-count="${T.ties}">${T.ties}</span>` : ""}</p>
      <p class="ledger__sub"><b>${T.qual.w}–${T.qual.l}${T.qual.t ? `–${T.qual.t}` : ""}</b> in qualifications, <b>${T.elim.w}–${T.elim.l}</b> in eliminations.</p>
    </div>
    <div class="ledger__cells">
      ${cells.map((c) => `
        <div class="cell">
          <p class="ledger__k">${esc(c.k)}</p>
          <p class="cell__v"><span data-count="${c.v}" data-d="${c.d || 0}" ${c.ord ? "data-ord" : ""}>${c.ord ? ordinal(c.v) : c.v}</span>${c.unit ? `<small>${c.unit}</small>` : ""}</p>
          <p class="cell__where">${esc(c.where)}</p>
        </div>`).join("")}
    </div>`;
  if (ledgerSeen || animate) countUp($("#ledger"));
}

function countUp(root) {
  if (reduced) return;
  for (const el of $$("[data-count]", root)) {
    const to = Number(el.dataset.count), d = Number(el.dataset.d || 0), ord = el.hasAttribute("data-ord");
    const t0 = performance.now(), dur = 1100;
    const fmt = (v) => (ord ? ordinal(Math.round(v)) : v.toFixed(d));
    el.textContent = fmt(0);
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 4);
      el.textContent = fmt(ord ? Math.max(1, to * e) : to * e);
      if (p < 1) requestAnimationFrame(tick); else el.textContent = fmt(to);
    };
    requestAnimationFrame(tick);
  }
}

// ----------------------------------------------------------------- chart ----
const SVGNS = "http://www.w3.org/2000/svg";
let chartSeen = false;
let chartSeason = null;

// A bar anchored on the baseline with 4px rounding only on its free end.
function barPath(x, y0, w, h, up) {
  if (h <= 0) return "";
  const r = Math.min(4, w / 2, h);
  if (up) {
    const y = y0 - h;
    return `M${x},${y0}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y0}Z`;
  }
  const y = y0 + h;
  return `M${x},${y0}V${y - r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y - r}V${y0}Z`;
}

function renderChart(S, animate) {
  const svg = $("#chart");
  const scroll = $("#chartScroll");
  const matches = S.events.flatMap((e) => e.matches.filter((m) => m.played && m.round !== 1).map((m) => ({ ...m, ev: e })));
  svg.innerHTML = "";
  if (!matches.length) return;

  const H = 380, top = 52, bottom = 22, left = 44, right = 18;
  const avail = Math.max(320, scroll.clientWidth - 4);
  const minSlot = innerWidth >= 900 ? 8 : 13;
  const slot = Math.min(120, Math.max(minSlot, (avail - left - right) / matches.length));
  const W = Math.max(avail, left + right + slot * matches.length);
  const y0 = top + (H - top - bottom) / 2;
  const half = (H - top - bottom) / 2 - 6;
  const max = Math.max(...matches.flatMap((m) => [m.us, m.them]));
  const step = max > 120 ? 50 : 25;
  const ceil = Math.ceil(max / step) * step;
  const sc = (v) => (v / ceil) * half;
  const bw = Math.max(5, Math.min(18, slot * 0.58));

  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("width", W);
  svg.setAttribute("height", H);
  svg.style.width = `${W}px`;

  const g = (cls) => { const n = document.createElementNS(SVGNS, "g"); if (cls) n.setAttribute("class", cls); svg.append(n); return n; };
  const el = (parent, tag, attrs, text) => {
    const n = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text != null) n.textContent = text;
    parent.append(n);
    return n;
  };

  // event bands and labels
  const bands = g();
  const labels = g();
  let i = 0;
  S.events.forEach((e, ei) => {
    const n = e.matches.filter((m) => m.played && m.round !== 1).length;
    if (!n) return;
    const x = left + i * slot, w = n * slot;
    el(bands, "rect", { x, y: top - 34, width: w, height: H - top + 34 - bottom + 4, class: `ev-band${ei % 2 ? " alt" : ""}`, "data-ev": e.id });
    if (i > 0) el(bands, "line", { x1: x, x2: x, y1: top - 34, y2: H - bottom + 4, class: "sep" });
    const chars = Math.floor((w - 10) / 6.7);
    const name = e.short.length <= chars ? e.short : chars >= 5 ? e.short.slice(0, chars - 1).trimEnd() + "…" : "";
    if (name) el(labels, "text", { x: x + 6, y: top - 20, class: "ev-label" }, name);
    const mo = MONTHS[ymd(e.start)[1] - 1];
    if (w > 30) el(labels, "text", { x: x + 6, y: top - 7 }, `${mo}${e.awards.length ? " ★" : ""}`);
    i += n;
  });

  // grid
  const grid = g();
  for (let v = step; v <= ceil; v += step) {
    for (const s of [-1, 1]) {
      const y = y0 - s * sc(v);
      el(grid, "line", { x1: left, x2: W - right, y1: y, y2: y, class: "grid" });
      el(grid, "text", { x: left - 8, y: y + 4, "text-anchor": "end" }, v);
    }
  }
  el(grid, "text", { x: left - 8, y: y0 + 4, "text-anchor": "end" }, "0");

  // bars
  const marks = g();
  matches.forEach((m, k) => {
    const cx = left + k * slot + slot / 2;
    const grp = el(marks, "g", { class: "m", "data-k": k, "data-ev": m.ev.id });
    el(grp, "path", { d: barPath(cx - bw / 2, y0 - 1, bw, sc(m.us), true), class: "bar-us grow up", style: `transition-delay:${k * 6}ms` });
    el(grp, "path", { d: barPath(cx - bw / 2, y0 + 1, bw, sc(m.them), false), class: "bar-them grow down", style: `transition-delay:${k * 6}ms` });
    if (m.round !== 2) el(grp, "circle", { cx, cy: y0 - sc(m.us) - 9, r: 4, class: "elim" });
  });
  el(svg, "line", { x1: left, x2: W - right, y1: y0, y2: y0, class: "base" });

  // hit targets, wider than the marks
  const hits = g();
  hits.setAttribute("aria-hidden", "true");
  matches.forEach((m, k) => {
    el(hits, "rect", { x: left + k * slot, y: top - 34, width: slot, height: H - top + 34 - bottom, class: "hit", "data-k": k });
  });

  const tip = $("#tip");
  const fig = svg.closest(".chart");
  const show = (k) => {
    const m = matches[k];
    svg.classList.add("is-hovering");
    $$(".m", svg).forEach((n) => n.classList.toggle("is-hot", Number(n.dataset.k) === k));
    $$(".ev-band", svg).forEach((n) => n.classList.toggle("is-hot", Number(n.dataset.ev) === m.ev.id));
    tip.innerHTML = `
      <p class="tip__ev">${esc(m.ev.short)} · ${esc(fmtDate(m.time.slice(0, 10)))}</p>
      <p class="tip__score">${m.us}–${m.them} <span class="tip__res tip__res--${m.result}">${m.result === "W" ? "WIN" : m.result === "L" ? "LOSS" : "TIE"}</span></p>
      <p class="tip__row"><span>${esc(m.label)}</span>${m.stage === "Q" ? "Qualification" : "Elimination"}</p>
      <p class="tip__row"><span>with</span>${esc(m.partners.join(", ") || "—")}</p>
      <p class="tip__row"><span>vs</span>${esc(m.opponents.join(", "))}</p>`;
    tip.hidden = false;
    const hr = $(`.hit[data-k="${k}"]`, svg).getBoundingClientRect();
    const fr = fig.getBoundingClientRect();
    const tw = tip.offsetWidth;
    let x = hr.left - fr.left + hr.width / 2 + 14;
    if (x + tw > fr.width) x = hr.left - fr.left + hr.width / 2 - tw - 14;
    const sr = scroll.getBoundingClientRect();
    tip.style.left = `${Math.max(0, x)}px`;
    tip.style.top = `${sr.top - fr.top + 56}px`;
  };
  const hide = () => {
    svg.classList.remove("is-hovering");
    $$(".is-hot", svg).forEach((n) => n.classList.remove("is-hot"));
    tip.hidden = true;
  };
  hits.addEventListener("pointerover", (e) => { const k = e.target.dataset.k; if (k != null) show(Number(k)); });
  hits.addEventListener("pointerleave", hide);
  svg.onpointerleave = hide;
  scroll.onscroll = hide;

  // grow in: on first view, and whenever the season changes
  if (!reduced && (!chartSeen || animate)) {
    svg.classList.add("is-pre");
    if (chartSeen) requestAnimationFrame(() => requestAnimationFrame(() => svg.classList.remove("is-pre")));
  }
  // open on the newest matches when the chart is wider than the screen
  if (chartSeason !== season) scroll.scrollLeft = 0;
  chartSeason = season;
}

// -------------------------------------------------------------- timeline ----
function finishChip(e) {
  if (!e.finish || e.awards.some((a) => /Tournament (Champions|Finalists)/.test(a.raw))) return "";
  const label = { Qualifications: "Qualifications only" }[e.finish] || e.finish;
  return `<span class="chip chip--finish">${esc(label)}</span>`;
}

function matchRows(e) {
  if (!e.matches.length) return `<p class="ev__note">No matches recorded for 20850C at this event.</p>`;
  const rows = e.matches.map((m) => {
    const t = m.time ? m.time.slice(11, 16) : "";
    const score = m.played ? `${m.us}–${m.them}` : "—";
    const res = m.played ? `<span class="res res--${m.result}">${m.result}</span>` : `<span class="muted">—</span>`;
    const vid = m.video ? `<a class="vid-link" href="https://www.youtube.com/watch?v=${esc(m.video)}" target="_blank" rel="noopener">Watch ↗</a>` : "";
    return `
      <tr class="${m.round === 2 || m.round === 1 ? "" : "is-elim"}">
        <td class="num">${esc(m.round === 1 ? `Practice ${m.num}` : m.label)}</td>
        <td class="col-field muted num">${esc(t)}</td>
        <td><span class="ally"><i class="dot dot--${m.color}" title="${m.color} alliance"></i>${m.partners.length ? `<span class="w">with </span>${esc(m.partners.join(", "))}` : "solo"}</span></td>
        <td>${esc(m.opponents.join(", "))}</td>
        <td class="score">${score}</td>
        <td>${res}</td>
        <td>${vid}</td>
      </tr>`;
  }).join("");
  return `
    <div class="mtable-wrap">
      <table class="mtable">
        <thead><tr><th>Match</th><th class="col-field">Time</th><th>Alliance</th><th>Opponents</th><th>Score</th><th>Result</th><th><span class="sr">Video</span></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderTimeline(S) {
  const ol = $("#timeline");
  ol.innerHTML = S.events.map((e) => {
    const [y] = ymd(e.start);
    const r = e.rank;
    const awards = e.awards.map((a) => `<span class="chip chip--award">${esc(a.title)}</span>`).join("");
    const none = !e.matches.some((m) => m.played) ? `<span class="chip">${e.matches.length ? "Unscored" : "No matches"}</span>` : "";
    const lvl = { Signature: "Signature", World: "Worlds", Regional: "State" }[e.level];
    const pid = `ev-${e.id}`;
    return `
      <li class="ev${e.awards.length ? " ev--award" : ""}${e.level === "World" ? " ev--world" : ""}" data-reveal>
        <button class="ev__row" type="button" data-cursor="Open" aria-expanded="false" aria-controls="${pid}">
          <span class="ev__date"><b>${esc(fmtRange(e.start, e.end))}</b>${y}</span>
          <span class="ev__node" aria-hidden="true"></span>
          <span class="ev__main">
            <span class="ev__name">${esc(e.short)}${lvl ? `<span class="ev__level">${lvl}</span>` : ""}</span>
            <span class="ev__where" style="display:block">${esc(place(e))}${e.division && !/^(Default|Division 1|Middle School|Default Division)$/.test(e.division) && e.division !== e.short ? ` · ${esc(e.division)}` : ""}</span>
            <span class="ev__badges">${awards}${finishChip(e)}${none}</span>
          </span>
          <span class="ev__stats">
            ${r ? `<span class="stat"><span class="stat__v">${ordinal(r.rank)}</span><span class="stat__k">Rank</span></span>
            <span class="stat stat--record"><span class="stat__v">${r.w}–${r.l}${r.t ? `–${r.t}` : ""}</span><span class="stat__k">Quals</span></span>` : ""}
            ${e.skills ? `<span class="stat stat--skills"><span class="stat__v">${e.skills.driver + e.skills.programming}</span><span class="stat__k">Skills</span></span>` : ""}
            <span class="ev__toggle" aria-hidden="true"></span>
          </span>
        </button>
        <div class="ev__panel" id="${pid}">
          <div class="ev__inner">
            <div class="ev__body">
              ${e.note ? `<p class="ev__note">${esc(e.note)}</p>` : ""}
              <p class="ev__extra">
                ${e.venue && e.venue !== e.city ? `<span>${esc(e.venue)}</span>` : ""}
                ${e.skills ? `<span>Skills <b>${e.skills.driver}</b> driver · <b>${e.skills.programming}</b> auton · ${ordinal(e.skills.rank)}</span>` : ""}
                ${r ? `<span>WP <b>${r.wp}</b> · AP <b>${r.ap}</b> · SP <b>${r.sp}</b></span><span>Avg <b>${r.avg}</b> · High <b>${r.high}</b></span>` : ""}
                <a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.sku)} ↗</a>
              </p>
              ${matchRows(e)}
            </div>
          </div>
        </div>
      </li>`;
  }).join("");

  for (const li of $$(".ev", ol)) {
    const btn = $(".ev__row", li);
    btn.addEventListener("click", () => {
      const open = !li.classList.contains("is-open");
      li.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", open);
    });
  }
  observeReveals(ol);
}

// ---------------------------------------------------------------- worlds ----
function renderWorlds() {
  const e = allEvents().filter((x) => x.level === "World").pop();
  if (!e) return;
  const r = e.rank;
  const facts = [
    ["Division", e.division],
    ["Rank", r ? `${ordinal(r.rank)}` : "—"],
    ["Record", r ? `${r.w}–${r.l}` : "—"],
    ["Average score", r ? r.avg : "—"],
    ["Driver skills", e.skills ? e.skills.driver : "—"],
    ["Auton skills", e.skills ? e.skills.programming : "—"],
  ];
  $("#worldsFacts").innerHTML = facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");
  const q = e.matches.filter((m) => m.round === 2 && m.played);
  $("#worldsStrip").innerHTML = q.map((m, i) => `
    <li class="${m.result}" style="--i:${i}" title="${esc(`${m.label}: with ${m.partners.join(", ")} vs ${m.opponents.join(", ")}`)}">
      <span class="s-res">${m.result === "W" ? "WIN" : m.result === "L" ? "LOSS" : "TIE"}</span>
      <span class="s-score">${m.us}<span>–${m.them}</span></span>
      <span class="s-q">${esc(m.label)}</span>
    </li>`).join("");
}

// ---------------------------------------------------------------- videos ----
function findMatch(eventId, key) {
  const e = eventById(eventId);
  if (!e) return {};
  const [round, inst, num] = key.split("-").map(Number);
  return { e, m: e.matches.find((x) => x.round === round && x.instance === inst && x.num === num) };
}

function renderVideos() {
  $("#videoGrid").innerHTML = D.videos.map((v, i) => {
    const { e, m } = findMatch(v.event, v.match);
    const sname = e ? D.seasons[e.season].name : "";
    const res = m && m.played ? `<b>${m.result === "W" ? "Won" : "Lost"} ${m.us}–${m.them}</b>` : "";
    return `
      <figure class="vid" data-reveal style="transition-delay:${(i % 3) * 70}ms">
        <button class="vid__frame" type="button" data-cursor="Play" data-yt="${esc(v.id)}" aria-label="Play: ${esc(v.title)}">
          <img src="https://i.ytimg.com/vi/${esc(v.id)}/hqdefault.jpg" alt="" loading="lazy" width="480" height="360" />
          <span class="vid__play">${m ? esc(m.label) : "Play"}</span>
        </button>
        <figcaption>
          <p class="vid__t">${esc(v.title)}</p>
          <p class="vid__m">${[sname, e ? fmtDate(e.start) : "", res, m?.partners?.length ? `with ${esc(m.partners.join(", "))}` : ""].filter(Boolean).join(" · ")}</p>
          <p class="vid__m">via ${esc(v.channel)}</p>
        </figcaption>
      </figure>`;
  }).join("");
  $("#streamList").innerHTML = D.streams.map((s) =>
    `<li><a href="https://www.youtube.com/watch?v=${esc(s.id)}" target="_blank" rel="noopener">${esc(s.title)}</a><span>${esc(s.channel)}</span></li>`).join("");

  $("#videoGrid").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-yt]");
    if (!b || b.dataset.playing) return;
    b.dataset.playing = "1";
    const f = document.createElement("iframe");
    f.src = `https://www.youtube-nocookie.com/embed/${b.dataset.yt}?autoplay=1&rel=0&modestbranding=1`;
    f.title = b.getAttribute("aria-label").replace(/^Play: /, "");
    f.allow = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen";
    f.allowFullscreen = true;
    b.replaceChildren(f);
  });
}

// ------------------------------------------------------------------- aoe ----
function renderAoeNotes(S) {
  const ms = S.events.flatMap((e) => e.matches.filter((m) => m.played && m.round !== 1));
  const aoe = (t) => /^20850[A-Z]$/.test(t) && t !== TEAM;
  const withAoe = ms.filter((m) => m.partners.some(aoe)).length;
  const vsAoe = ms.filter((m) => m.opponents.some(aoe)).length;
  const sibs = new Set(ms.flatMap((m) => [...m.partners, ...m.opponents]).filter(aoe));
  $("#aoeSiblings").innerHTML = ms.length ? `
    <dt>${esc(S.name)} on the field</dt>
    <dd>Of our <b>${ms.length}</b> matches, <b>${withAoe}</b> were alongside another AOE team and <b>${vsAoe}</b> were against one. We crossed paths with <b>${sibs.size}</b> different 20850 teams.</dd>` : `
    <dt>${esc(S.name)}</dt><dd>No matches played yet this season.</dd>`;

  const home = allEvents().filter((e) => /^AOE Robotics/.test(e.short) && e.rank);
  $("#aoeHome").innerHTML = `
    <dt>At AOE's own events</dt>
    <dd>${home.map((e) => `<b>${esc(e.short)}</b> (${esc(fmtRange(e.start, e.end))}, ${ymd(e.start)[0]}): ranked ${ordinal(e.rank.rank)}, ${e.finish === "Qualifications" ? "out after qualifications" : esc((e.finish || "").toLowerCase())}.`).join(" ") || "Results will appear here."}</dd>`;
}

// ------------------------------------------------------------------ hero ----
const monthYear = (d) => { const [y, m] = ymd(d); return `${MONTHS[m - 1]} ${y}`; };

function renderHeroStats() {
  const evs = allEvents();
  const items = [];
  const world = evs.filter((e) => e.level === "World" && e.awards.length).pop();
  if (world) items.push(["Latest honor", world.awards[0].title, `${ymd(world.start)[0]} World Championship`]);
  const champ = evs.filter((e) => e.awards.some((a) => /Champions/i.test(a.raw))).pop();
  if (champ) items.push(["Tournament win", `Champions, ${champ.short}`, monthYear(champ.start)]);
  const full = [...D.seasonOrder].reverse().find((s) => D.seasons[s].events.some((e) => e.level === "World"));
  if (full) {
    const S = D.seasons[full], T = S.totals;
    items.push([`${S.name} record`, `${T.wins}–${T.losses}${T.ties ? `–${T.ties}` : ""}`, `${T.awards} awards across ${T.events} events`]);
  }
  const cur = D.seasons[D.seasonOrder[D.seasonOrder.length - 1]];
  if (cur && cur.id !== full) {
    const last = cur.events.filter((e) => e.rank).pop();
    items.push([`${cur.name} so far`, last ? `${last.rank.w}–${last.rank.l}, ranked ${ordinal(last.rank.rank)}` : "Season under way", last ? last.short : cur.years]);
  }
  $("#heroStats").innerHTML = items.slice(0, 4).map(([k, v, sub]) =>
    `<div><dt>${esc(k)}</dt><dd>${esc(v)}<small>${esc(sub)}</small></dd></div>`).join("");
}

// The logo drifts a few pixels against the pointer.
const pointer = { x: 0.7, y: 0.55, tx: 0.7, ty: 0.55 };
function heroMotion() {
  const hero = $(".hero"), art = $("#heroArt");
  hero.addEventListener("pointermove", (e) => {
    const hr = hero.getBoundingClientRect();
    pointer.tx = (e.clientX - hr.left) / hr.width;
    pointer.ty = 1 - (e.clientY - hr.top) / hr.height;
    if (reduced || !matchMedia("(pointer: fine)").matches) return;
    const ar = art.getBoundingClientRect();
    const dx = (e.clientX - (ar.left + ar.width / 2)) / innerWidth;
    const dy = (e.clientY - (ar.top + ar.height / 2)) / innerHeight;
    art.style.setProperty("--px", `${(dx * -26).toFixed(1)}px`);
    art.style.setProperty("--py", `${(dy * -20).toFixed(1)}px`);
  });
  hero.addEventListener("pointerleave", () => { art.style.setProperty("--px", "0px"); art.style.setProperty("--py", "0px"); });
}

// ------------------------------------------------------------ color flow ----
// A domain-warped noise field in the logo's colors, drawn behind the hero.
// It runs at a fraction of screen resolution (it's soft anyway) and stops
// whenever the hero is off screen.
function flow() {
  const cv = $("#flow");
  const gl = cv.getContext("webgl", { antialias: false, alpha: false, preserveDrawingBuffer: false });
  if (!gl) return;
  const vs = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;
  const fs = `
    precision mediump float;
    uniform vec2 u_res; uniform float u_t; uniform vec2 u_m;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(h(i), h(i + vec2(1.0, 0.0)), u.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), u.x), u.y); }
    float fbm(vec2 p){ float v = 0.0, a = 0.5; mat2 r = mat2(1.6, 1.2, -1.2, 1.6);
      for (int i = 0; i < 5; i++) { v += a * n(p); p = r * p; a *= 0.5; } return v; }
    void main(){
      vec2 uv = gl_FragCoord.xy / u_res;
      float asp = u_res.x / u_res.y;
      vec2 p = uv * vec2(asp, 1.0) * 1.7;
      vec2 m = u_m * vec2(asp, 1.0) * 1.7;
      float t = u_t * 0.045;
      vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
      vec2 r = vec2(fbm(p + 3.0 * q + vec2(1.7, 9.2) + 1.4 * t), fbm(p + 3.0 * q + vec2(8.3, 2.8) - t));
      float pull = exp(-length(p - m) * 2.2);
      r += 0.22 * pull;
      float f = fbm(p + 3.0 * r);
      vec3 cream = vec3(0.984, 0.965, 0.925);
      vec3 gold  = vec3(1.0, 0.722, 0.11);
      vec3 flame = vec3(1.0, 0.333, 0.2);
      vec3 sky   = vec3(0.42, 0.58, 1.0);
      vec3 col = mix(cream, gold, smoothstep(0.28, 0.62, f));
      col = mix(col, flame, smoothstep(0.5, 0.85, r.x));
      col = mix(col, sky, smoothstep(0.56, 0.9, q.y) * 0.6);
      col = mix(col, cream, smoothstep(0.8, 1.0, f) * 0.35);
      col += (h(gl_FragCoord.xy + fract(u_t)) - 0.5) * 0.03;
      gl_FragColor = vec4(col, 1.0);
    }`;
  const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null; };
  const v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs);
  if (!v || !f) return;
  const prog = gl.createProgram();
  gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(prog, "u_res"), uT = gl.getUniformLocation(prog, "u_t"), uM = gl.getUniformLocation(prog, "u_m");

  const size = () => {
    const scale = Math.min(1, (devicePixelRatio || 1)) * 0.55;
    cv.width = Math.max(2, Math.round(cv.clientWidth * scale));
    cv.height = Math.max(2, Math.round(cv.clientHeight * scale));
    gl.viewport(0, 0, cv.width, cv.height);
    gl.uniform2f(uRes, cv.width, cv.height);
  };
  let running = false, raf = 0;
  const t0 = performance.now() - 20000; // start mid-flow rather than at a blank first frame
  const draw = (now) => {
    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;
    gl.uniform1f(uT, (now - t0) / 1000);
    gl.uniform2f(uM, pointer.x, pointer.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (running) raf = requestAnimationFrame(draw);
  };
  const start = () => { if (!running && !reduced) { running = true; raf = requestAnimationFrame(draw); } };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  size();
  draw(performance.now());
  cv.style.background = "none";
  addEventListener("resize", () => { size(); if (!running) draw(performance.now()); });
  new IntersectionObserver(([en]) => (en.isIntersecting ? start() : stop())).observe(cv);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
}

// ---------------------------------------------------------------- themes ----
// The section crossing the middle of the screen sets the page's colors.
const THEME_COLOR = { cream: "#FBF6EC", gold: "#FFC23A", night: "#121010", sky: "#D3E2FF", flame: "#FF5533" };
function themes() {
  const meta = $('meta[name="theme-color"]');
  const io = new IntersectionObserver((ents) => {
    for (const en of ents) {
      if (!en.isIntersecting) continue;
      const t = en.target.dataset.theme;
      if (document.body.dataset.theme !== t) {
        document.body.dataset.theme = t;
        meta?.setAttribute("content", THEME_COLOR[t] || THEME_COLOR.cream);
      }
    }
  }, { rootMargin: "-50% 0px -50% 0px" });
  for (const el of $$("main [data-theme], footer[data-theme]")) io.observe(el);
}

// --------------------------------------------------------------- marquees ----
// Two endless tracks: results under the hero, the wordmark in the footer.
// They drift on their own and pick up speed (and direction) from scrolling.
let scrollVel = 0;
function marquees() {
  const evs = allEvents();
  const items = [];
  for (const e of [...evs].reverse()) for (const a of e.awards) items.push(`<b>${esc(a.title)}</b> ${esc(e.short)}`);
  for (const sid of [...D.seasonOrder].reverse()) {
    const S = D.seasons[sid], T = S.totals;
    if (!T.matches) continue;
    items.push(`<b>${T.wins}–${T.losses}</b> ${esc(S.name)} record`);
    if (T.driver) items.push(`<b>${T.driver.score}</b> ${esc(S.name)} driver skills`);
  }
  const world = evs.find((e) => e.level === "World");
  if (world?.rank) items.push(`<b>${ordinal(world.rank.rank)}</b> ${esc(world.division)} Division, Worlds`);
  const line = items.map((t) => `<span class="marquee__item"><i class="marquee__star" aria-hidden="true"></i>${t}</span>`).join("");
  $("#marquee").innerHTML = line + line;

  const mark = `<span class="wordmark__item">Lucky Cats <img src="assets/img/logo.webp" alt="" /> <span class="o">20850C</span> <img src="assets/img/logo.webp" alt="" /></span>`;
  $("#wordmark").innerHTML = mark.repeat(4);

  const tracks = [
    { el: $("#marquee"), x: 0, speed: 0.6, dir: -1 },
    { el: $("#wordmark"), x: 0, speed: 0.45, dir: 1 },
  ];
  let lastY = scrollY;
  addEventListener("scroll", () => { scrollVel += scrollY - lastY; lastY = scrollY; }, { passive: true });
  if (reduced) return;
  let prev = performance.now();
  const tick = (now) => {
    const dt = Math.min(48, now - prev) / 16.67;
    prev = now;
    scrollVel *= 0.9;
    const boost = Math.min(8, Math.abs(scrollVel) * 0.12);
    const sign = scrollVel < -0.5 ? -1 : 1;
    for (const t of tracks) {
      const half = t.el.scrollWidth / 2;
      t.x += t.dir * sign * (t.speed + boost) * dt;
      if (t.x <= -half) t.x += half;
      if (t.x > 0) t.x -= half;
      t.el.style.transform = `translate3d(${t.x}px,0,0)`;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ----------------------------------------------------------- split words ----
function splitHeadings() {
  for (const h of $$(".sh__main h2, .cta__title")) {
    const words = h.textContent.trim().split(/\s+/);
    h.setAttribute("aria-label", h.textContent.trim());
    h.classList.add("words");
    h.innerHTML = words.map((w, i) => `<span class="w" aria-hidden="true"><span style="--wi:${i}">${esc(w)}</span></span>`).join(" ");
  }
}

// --------------------------------------------------------- magnetic + cursor ----
function magnetic() {
  if (reduced || !matchMedia("(pointer: fine)").matches) return;
  for (const b of $$(".hero__actions .btn, .cta__actions .btn, .nav__cta")) {
    b.addEventListener("pointermove", (e) => {
      const r = b.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
      b.style.transform = `translate(${x * 0.22}px, ${y * 0.3}px)`;
    });
    b.addEventListener("pointerleave", () => { b.style.transform = ""; });
  }
}

function cursorLabel() {
  if (reduced || !matchMedia("(pointer: fine)").matches) return;
  const c = Object.assign(document.createElement("div"), { className: "cursor" });
  c.setAttribute("aria-hidden", "true");
  document.body.append(c);
  let x = 0, y = 0, cx = 0, cy = 0, on = false;
  const update = (target) => {
    const t = target?.closest?.("[data-cursor]");
    const label = t ? (t.closest(".ev.is-open") && t.classList.contains("ev__row") ? "Close" : t.dataset.cursor) : "";
    if (label) c.textContent = label;
    if (!!label !== on) { on = !!label; c.classList.toggle("is-on", on); }
  };
  document.addEventListener("pointermove", (e) => { x = e.clientX; y = e.clientY; update(e.target); });
  // scrolling moves the page under a still pointer, so look again
  addEventListener("scroll", () => update(document.elementFromPoint(x, y)), { passive: true });
  document.addEventListener("pointerleave", () => update(null));
  document.addEventListener("click", () => requestAnimationFrame(() => update(document.elementFromPoint(x, y))));
  const tick = () => {
    cx += (x - cx) * 0.2; cy += (y - cy) * 0.2;
    c.style.transform = `translate3d(${cx + 26}px, ${cy + 22}px, 0)`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---------------------------------------------------------- smooth scroll ----
let lenis = null;
function smoothScroll() {
  if (reduced || !window.Lenis) return;
  lenis = new window.Lenis({ lerp: 0.095, smoothWheel: true });
  const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute("href");
    const el = id === "#top" ? 0 : document.querySelector(id);
    if (el === null) return;
    e.preventDefault();
    lenis.scrollTo(el, { offset: id === "#top" ? 0 : -70, duration: 1.4 });
    history.replaceState(null, "", id);
  });
}

function nav() {
  const n = $("#nav"), menu = $("#navMenu"), links = $("#navLinks");
  let last = scrollY;
  addEventListener("scroll", () => {
    const y = scrollY;
    n.classList.toggle("is-scrolled", y > 8);
    const open = links.classList.contains("is-open");
    n.classList.toggle("is-hidden", !open && y > innerHeight * 0.9 && y > last + 4);
    if (y < last - 4) n.classList.remove("is-hidden");
    last = y;
  }, { passive: true });
  menu.addEventListener("click", () => {
    const open = !links.classList.contains("is-open");
    links.classList.toggle("is-open", open);
    n.classList.toggle("menu-open", open);
    menu.setAttribute("aria-expanded", open);
  });
  links.addEventListener("click", (e) => {
    if (e.target.closest("a")) { links.classList.remove("is-open"); n.classList.remove("menu-open"); menu.setAttribute("aria-expanded", "false"); }
  });
  const map = new Map($$("a", links).map((a) => [a.getAttribute("href").slice(1), a]));
  const io = new IntersectionObserver((ents) => {
    for (const en of ents) {
      if (!en.isIntersecting) continue;
      for (const a of map.values()) a.classList.remove("is-active");
      map.get(en.target.id)?.classList.add("is-active");
    }
  }, { rootMargin: "-45% 0px -50% 0px" });
  for (const id of map.keys()) { const s = document.getElementById(id); if (s) io.observe(s); }
}

let revealIO;
function observeReveals(root = document) {
  revealIO ??= new IntersectionObserver((ents) => {
    for (const en of ents) if (en.isIntersecting) { en.target.classList.add("is-in"); revealIO.unobserve(en.target); }
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
  for (const el of $$("[data-reveal]:not(.is-in), .sh:not(.is-in)", root)) revealIO.observe(el);
}

function watchFirstViews() {
  const io = new IntersectionObserver((ents) => {
    for (const en of ents) {
      if (!en.isIntersecting) continue;
      if (en.target.id === "ledger" && !ledgerSeen) { ledgerSeen = true; countUp(en.target); }
      if (en.target.id === "chartScroll" && !chartSeen) {
        chartSeen = true;
        const svg = $("#chart");
        requestAnimationFrame(() => requestAnimationFrame(() => svg.classList.remove("is-pre")));
      }
      io.unobserve(en.target);
    }
  }, { threshold: 0.25 });
  io.observe($("#ledger"));
  io.observe($("#chartScroll"));
}

function mail() {
  const b = $("#copyMail");
  const toast = Object.assign(document.createElement("div"), { className: "toast", role: "status" });
  document.body.append(toast);
  b.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText("luckycats20850@gmail.com");
      toast.textContent = "Address copied";
    } catch {
      toast.textContent = "luckycats20850@gmail.com";
    }
    toast.classList.add("is-on");
    setTimeout(() => toast.classList.remove("is-on"), 1800);
  });
}

function footer() {
  const t = new Date(D.generated_at);
  const when = isNaN(t) ? "" : ` Last updated ${MONTHS[t.getMonth()]} ${t.getDate()}, ${t.getFullYear()}.`;
  $("#footData").innerHTML = `Results from <a href="https://events.vex.com/teams/V5RC/20850C" target="_blank" rel="noopener">VEX Events</a>, synced nightly.${esc(when)}`;
}

// ------------------------------------------------------------------ boot ----
function boot() {
  if (!D) { console.error("data/team.js did not load"); return; }
  // Each season-driven section header carries its own copy of the season switch.
  for (const slot of $$("[data-switch-slot]")) {
    const sw = Object.assign(document.createElement("div"), { className: "switch" });
    sw.setAttribute("role", "radiogroup");
    sw.setAttribute("aria-label", "Season");
    sw.dataset.switch = "";
    sw.innerHTML = `<span class="switch__thumb" aria-hidden="true"></span>`;
    slot.append(sw);
  }

  splitHeadings();
  buildSwitches();
  renderSeason();
  renderHeroStats();
  renderWorlds();
  renderVideos();
  footer();
  nav();
  heroMotion();
  flow();
  themes();
  marquees();
  magnetic();
  cursorLabel();
  smoothScroll();
  mail();
  observeReveals();
  watchFirstViews();

  let rw = innerWidth, rt;
  addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      syncSwitches();
      if (innerWidth !== rw) { rw = innerWidth; renderChart(D.seasons[season], false); }
    }, 120);
  });
  document.fonts?.ready.then(syncSwitches);
}

boot();
