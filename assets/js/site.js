// Lucky Cats 20850C. Everything data-driven reads window.LUCKY (data/team.js),
// which scripts/sync.mjs regenerates from the VEX events API every night.
// Motion uses anime.js v4 (vendored in assets/vendor).

import { animate, stagger, splitText, utils } from "../vendor/anime.esm.min.js";

const D = window.LUCKY;
const TEAM = "20850C";
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(pointer: fine)").matches;
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
const suffix = (n) => ordinal(n).slice(String(n).length);
const place = (e) => [e.city, STATES[e.region] || e.region].filter(Boolean).join(", ");
const pct = (w, l, t) => (w + l + t ? Math.round((1000 * w) / (w + l + t)) / 10 : 0);
const wl = (r) => `${r.w}–${r.l}${r.t ? `–${r.t}` : ""}`;

const allEvents = () => D.seasonOrder.flatMap((s) => D.seasons[s].events.map((e) => ({ ...e, season: s })));
const eventById = (id) => allEvents().find((e) => e.id === id);
const played = (e) => e.matches.filter((m) => m.played && m.round !== 1);

// ------------------------------------------------------------- in view ----
// One observer for everything that animates when it scrolls into view.
const onView = (() => {
  const fns = new Map();
  const io = new IntersectionObserver((ents) => {
    for (const en of ents) {
      if (!en.isIntersecting) continue;
      const fn = fns.get(en.target);
      io.unobserve(en.target);
      fns.delete(en.target);
      fn?.(en.target);
    }
  }, { rootMargin: "0px 0px -12% 0px", threshold: 0.08 });
  return (el, fn) => { if (!el) return; if (reduced) { fn(el); return; } fns.set(el, fn); io.observe(el); };
})();

// Cards and rows rise in, staggered (ReactBits "AnimatedContent").
function riseIn(els, { y = 36, gap = 70 } = {}) {
  els = [...els];
  if (!els.length) return;
  if (reduced) { els.forEach((e) => (e.style.opacity = 1)); return; }
  els.forEach((e) => e.setAttribute("data-in", ""));
  onView(els[0], () => {
    animate(els, { opacity: { from: 0, to: 1 }, translateY: { from: y, to: 0 }, duration: 1000, delay: stagger(gap), ease: "outExpo",
      onComplete: () => els.forEach((e) => { e.removeAttribute("data-in"); e.style.transform = ""; e.style.opacity = ""; }) });
  });
}

// Count a number up from zero (ReactBits "CountUp").
function countUp(el, { delay = 0 } = {}) {
  const to = Number(el.dataset.count), dec = Number(el.dataset.dec || 0);
  const fmt = (v) => v.toFixed(dec);
  if (reduced) { el.textContent = fmt(to); return; }
  el.textContent = fmt(0);
  const o = { v: 0 };
  animate(o, { v: to, duration: 1600, delay, ease: "outExpo", onUpdate: () => (el.textContent = fmt(o.v)) });
}
const counters = (root, opts) => onView(root, () => $$("[data-count]", root).forEach((el, i) => countUp(el, { delay: i * 60, ...opts })));

// Headings come in word by word out of a blur (ReactBits "BlurText").
function blurText() {
  for (const el of $$("[data-blur]")) {
    if (reduced) continue;
    const { words } = splitText(el, { words: true });
    words.forEach((w) => { w.classList.add("word"); w.style.opacity = 0; });
    onView(el, () => animate(words, {
      opacity: { from: 0, to: 1 }, filter: { from: "blur(12px)", to: "blur(0px)" }, translateY: { from: 26, to: 0 },
      duration: 1100, delay: stagger(80), ease: "outExpo",
    }));
  }
}

// ---------------------------------------------------------------- season ----
// Default to the newest season once it has a few events behind it.
function defaultSeason() {
  const order = [...D.seasonOrder].reverse();
  return order.find((s) => D.seasons[s].totals.events >= 3) ?? order[order.length - 1];
}
let season = defaultSeason();

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
    if (on && thumb) { thumb.style.width = `${on.offsetWidth}px`; thumb.style.transform = `translateX(${on.offsetLeft}px)`; }
  }
}

function setSeason(sid) {
  if (sid === season) return;
  season = sid;
  syncSwitches();
  renderSeason(true);
}

function renderSeason(changed = false) {
  const S = D.seasons[season];
  for (const el of $$("[data-season-caption]")) el.textContent = `${S.name}, ${S.years}`;
  renderRail(S, changed);
  renderKpis(S, changed);
  renderChart(S, changed);
  renderAoeNotes(S);
}

// -------------------------------------------------------------- overview ----
// Running record: +1 for a win, −1 for a loss, match by match.
function sparkline(S) {
  const ms = S.events.flatMap(played);
  if (ms.length < 2) return "";
  const pts = [0];
  for (const m of ms) pts.push(pts[pts.length - 1] + (m.result === "W" ? 1 : m.result === "L" ? -1 : 0));
  const W = 230, H = 64, pad = 4;
  const lo = Math.min(0, ...pts), hi = Math.max(1, ...pts);
  const x = (i) => pad + (i / (pts.length - 1)) * (W - pad * 2);
  const y = (v) => pad + (1 - (v - lo) / (hi - lo)) * (H - pad * 2);
  const line = pts.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const area = `${line}L${x(pts.length - 1).toFixed(1)},${y(0).toFixed(1)}L${x(0).toFixed(1)},${y(0).toFixed(1)}Z`;
  return `<svg class="spark-line" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Running win-loss record over ${ms.length} matches">
    <clipPath id="above-${S.id}"><rect x="0" y="0" width="${W}" height="${y(0)}"/></clipPath>
    <path class="area-pos" d="${area}" clip-path="url(#above-${S.id})"/>
    <line class="zero" x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}"/>
    <path class="line" d="${line}"/></svg>`;
}

function renderOverview() {
  const order = [...D.seasonOrder].reverse();
  $("#seasonCards").innerHTML = order.map((sid, i) => {
    const S = D.seasons[sid], T = S.totals;
    const last = S.events.filter((e) => e.rank).pop();
    return `
      <button class="scard" type="button" data-go-season="${sid}">
        <div class="scard__top">
          <p class="scard__name">${esc(S.name)}<small>${esc(S.years)}</small></p>
          <span class="badge ${i === 0 ? "badge--live" : ""}">${i === 0 ? "This season" : "Last season"}</span>
        </div>
        <div class="scard__main">
          <div>
            <p class="scard__record"><span data-count="${T.wins}">${T.wins}</span><span class="dash">–</span><span data-count="${T.losses}">${T.losses}</span></p>
            <p class="scard__recordk">${wl(T.qual)} in quals · ${T.elim.w}–${T.elim.l} in elims</p>
          </div>
          ${sparkline(S)}
        </div>
        <dl class="scard__stats">
          <div><dt>Best rank</dt><dd>${T.bestRank ? `<span data-count="${T.bestRank.rank}">${T.bestRank.rank}</span>${suffix(T.bestRank.rank)}` : "—"}</dd></div>
          <div><dt>Driver</dt><dd><span data-count="${T.driver?.score ?? 0}">${T.driver?.score ?? 0}</span></dd></div>
          <div><dt>Auton</dt><dd><span data-count="${T.programming?.score ?? 0}">${T.programming?.score ?? 0}</span></dd></div>
          <div><dt>Awards</dt><dd><span data-count="${T.awards}">${T.awards}</span></dd></div>
        </dl>
        <p class="scard__latest"><span>${last ? `Latest: <b>${esc(last.short)}</b>, ${esc(fmtRange(last.start, last.end))}` : "No events yet"}</span><span class="scard__go">${T.events} event${T.events === 1 ? "" : "s"} →</span></p>
      </button>`;
  }).join("");

  for (const c of $$(".scard")) {
    c.addEventListener("click", () => {
      setSeason(Number(c.dataset.goSeason));
      scrollToEl($("#events"));
    });
  }
  riseIn($$(".scard"));
  counters($("#seasonCards"));

  // awards, newest first
  const items = allEvents().flatMap((e) => e.awards.map((a) => ({ a, e }))).sort((x, y) => y.e.end.localeCompare(x.e.end));
  const seasonsWon = D.seasonOrder.filter((s) => D.seasons[s].totals.awards).length;
  $("#awardsCount").textContent = items.length ? `${items.length} award${items.length === 1 ? "" : "s"} across ${seasonsWon} season${seasonsWon === 1 ? "" : "s"}` : "";
  $("#awardList").innerHTML = items.length ? items.map(({ a, e }) => {
    const world = e.level === "World", champ = /Champions/i.test(a.raw), fin = /Finalists/i.test(a.raw);
    const icon = world ? "★" : champ ? "1st" : fin ? "2nd" : "✦";
    const tier = world ? "World Championship" : e.level === "Regional" ? "State Championship" : e.level === "Signature" ? "Signature Event" : "Tournament";
    return `
      <li class="award ${world ? "award--world" : champ ? "award--champ" : fin ? "award--fin" : "award--other"}">
        <span class="award__icon" aria-hidden="true">${icon}</span>
        <p class="award__title">${esc(a.title)}<small>${esc(tier)}</small></p>
        <p class="award__event">${esc(e.short)}${world && e.division ? `, ${esc(e.division)} Division` : ""}</p>
        <p class="award__date">${esc(fmtDate(e.end))}<br>${esc(place(e))}</p>
      </li>`;
  }).join("") : `<li class="award award--none">No awards yet.</li>`;
  riseIn($$(".award"), { y: 20, gap: 60 });
}

// ---------------------------------------------------- events: side scroll ----
function finishLabel(e) {
  const a = e.awards.find((x) => /Tournament (Champions|Finalists)/.test(x.raw));
  if (a) return null;
  return { Qualifications: "Quals only", "Round of 16": "Round of 16", Quarterfinalists: "Quarterfinals", Semifinalists: "Semifinals", Finalists: "Finalist", Champions: "Champions" }[e.finish] || e.finish;
}

function renderRail(S, changed) {
  const track = $("#railTrack");
  track.innerHTML = S.events.map((e) => {
    const r = e.rank;
    const lvl = { Signature: "Signature", World: "Worlds", Regional: "State" }[e.level];
    const award = e.awards[0];
    const fin = finishLabel(e);
    const tag = award ? `<span class="chip chip--award">${esc(award.title)}</span>` : fin ? `<span class="chip">${esc(fin)}</span>` : `<span class="chip">${played(e).length ? "" : "No matches"}</span>`;
    return `
      <li>
        <button class="ecard spot ecard--${(e.level || "other").toLowerCase()} ${e.awards.length ? "ecard--award" : ""} ${e.level === "World" ? "ecard--world" : ""}" type="button" data-event="${e.id}">
          <span class="ecard__date"><span>${esc(fmtRange(e.start, e.end))}, ${ymd(e.start)[0]}</span>${lvl ? `<span class="ecard__lvl">${lvl}</span>` : ""}</span>
          <span class="ecard__name">${esc(e.short)}</span>
          <span class="ecard__where">${esc(place(e))}</span>
          ${r ? `<span class="ecard__rank">${r.rank}<sup>${suffix(r.rank)}</sup></span><span class="ecard__rankk">Rank${e.division && !/^(Default|Default Division)$/.test(e.division) && e.division !== e.short ? ` · ${esc(e.division)}` : ""}</span>`
              : `<span class="ecard__rank is-none">${played(e).length ? "Unranked" : "No results"}</span><span class="ecard__rankk">${e.note ? "" : ""}</span>`}
          <span class="ecard__bar" aria-hidden="true"><i style="width:${r && r.w + r.l + r.t ? Math.round((100 * r.w) / (r.w + r.l + r.t)) : 0}%"></i></span>
          <span class="ecard__foot"><span>${r ? `Quals <b>${wl(r)}</b>` : "&nbsp;"}</span>${tag}</span>
        </button>
      </li>`;
  }).join("");
  for (const b of $$(".ecard", track)) b.addEventListener("click", () => openDrawer(eventById(Number(b.dataset.event))));
  spotlight($$(".spot", track));
  rail.measure();
  if (changed && !reduced) animate($$(".ecard", track), { opacity: { from: 0, to: 1 }, translateX: { from: 60, to: 0 }, duration: 900, delay: stagger(50), ease: "outExpo" });
  else riseIn($$(".ecard", track), { y: 40, gap: 60 });
}

// The rail pins while the page scrolls, and vertical scroll moves it sideways.
const rail = (() => {
  let section, track, bar, hint, extra = 0, x = 0, target = 0, pinned = false;
  const measure = () => {
    section ??= $("#events"); track ??= $("#railTrack"); bar ??= $("#railProgress"); hint ??= $("#railHint");
    pinned = innerWidth > 900 && !reduced;
    extra = Math.max(0, track.scrollWidth - innerWidth);
    if (!pinned || extra < 40) { section.style.height = ""; track.style.transform = ""; x = target = 0; bar.style.transform = "scaleX(1)"; hint.textContent = "Click any event for its matches."; return; }
    section.style.height = `${innerHeight + extra}px`;
    hint.textContent = "Keep scrolling. Click any event for its matches.";
  };
  const tick = () => {
    if (pinned && extra >= 40) {
      const top = section.getBoundingClientRect().top;
      const p = Math.min(1, Math.max(0, -top / extra));
      target = -p * extra;
      x += (target - x) * 0.14;
      track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
      bar.style.transform = `scaleX(${p})`;
    }
    requestAnimationFrame(tick);
  };
  return { measure, start: () => requestAnimationFrame(tick) };
})();

// Spotlight follows the pointer inside a card (ReactBits "SpotlightCard").
function spotlight(els) {
  for (const el of els) {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  }
}

// ---------------------------------------------------------------- drawer ----
let lastFocus = null;
function openDrawer(e) {
  if (!e) return;
  const dr = $("#drawer"), body = $("#drawerBody"), panel = $(".drawer__panel", dr);
  const r = e.rank;
  const chips = [
    ...e.awards.map((a) => `<span class="chip chip--award">${esc(a.title)}</span>`),
    finishLabel(e) ? `<span class="chip">${esc(finishLabel(e))}</span>` : "",
    e.division && !/^(Default|Default Division)$/.test(e.division) ? `<span class="chip">${esc(e.division)}</span>` : "",
  ].join("");
  const rows = e.matches.map((m) => {
    const res = m.played ? `<span class="res res--${m.result}">${m.result}</span>` : `<span class="res">–</span>`;
    return `
      <li class="mrow ${m.round > 2 ? "is-elim" : ""}">
        <span class="mrow__label">${esc(m.round === 1 ? `P${m.num}` : m.label)}</span>
        <span class="mrow__teams"><i class="dot dot--${m.color}" title="${m.color} alliance"></i>${m.partners.length ? `with <b>${esc(m.partners.join(", "))}</b>` : "solo"} <span>vs ${esc(m.opponents.join(", "))}</span></span>
        <span class="mrow__score">${m.played ? `${m.us}–${m.them}` : "—"}${m.video ? `<a class="mrow__vid" href="https://www.youtube.com/watch?v=${esc(m.video)}" target="_blank" rel="noopener">▶ Video</a>` : ""}</span>
        ${res}
      </li>`;
  }).join("");
  body.innerHTML = `
    <p class="dr__date">${esc(fmtRange(e.start, e.end))}, ${ymd(e.start)[0]}${e.level !== "Other" ? ` · ${esc(e.level === "Regional" ? "State" : e.level)}` : ""}</p>
    <h3 class="dr__title" id="drawerTitle">${esc(e.short)}</h3>
    <p class="dr__where">${esc([e.venue !== e.city ? e.venue : "", place(e)].filter(Boolean).join(", "))}</p>
    ${chips ? `<div class="dr__chips">${chips}</div>` : ""}
    <dl class="dr__stats">
      <div><dt>Rank</dt><dd>${r ? ordinal(r.rank) : "—"}</dd></div>
      <div><dt>Quals</dt><dd>${r ? wl(r) : "—"}</dd></div>
      <div><dt>Driver</dt><dd>${e.skills ? e.skills.driver : "—"}</dd></div>
      <div><dt>Auton</dt><dd>${e.skills ? e.skills.programming : "—"}</dd></div>
    </dl>
    ${e.note ? `<p class="dr__note">${esc(e.note)}</p>` : ""}
    ${rows ? `<ol class="mlist">${rows}</ol>` : `<p class="dr__note">No matches were recorded for us at this event.</p>`}
    <a class="dr__link" href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.sku)} on VEX Events ↗</a>`;

  lastFocus = document.activeElement;
  dr.hidden = false;
  lenis?.stop();
  document.documentElement.style.overflow = "hidden";
  panel.scrollTop = 0;
  $(".drawer__close", dr).focus();
  if (!reduced) {
    animate($(".drawer__scrim", dr), { opacity: { from: 0, to: 1 }, duration: 400, ease: "outQuad" });
    animate(panel, { translateX: { from: "100%", to: "0%" }, duration: 700, ease: "outExpo" });
    // match rows drop in one after another (ReactBits "AnimatedList")
    animate($$(".mrow", panel), { opacity: { from: 0, to: 1 }, translateY: { from: 16, to: 0 }, scale: { from: 0.98, to: 1 }, duration: 600, delay: stagger(30, { start: 250 }), ease: "outExpo" });
  }
}

function closeDrawer() {
  const dr = $("#drawer"), panel = $(".drawer__panel", dr);
  if (dr.hidden) return;
  const done = () => { dr.hidden = true; panel.style.transform = ""; document.documentElement.style.overflow = ""; lenis?.start(); lastFocus?.focus?.(); };
  if (reduced) return done();
  animate($(".drawer__scrim", dr), { opacity: 0, duration: 300, ease: "outQuad" });
  animate(panel, { translateX: "100%", duration: 450, ease: "inQuart", onComplete: done });
}

function drawer() {
  const dr = $("#drawer");
  dr.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeDrawer(); });
  document.addEventListener("keydown", (e) => {
    if (dr.hidden) return;
    if (e.key === "Escape") closeDrawer();
    if (e.key === "Tab") { // keep focus inside the panel
      const f = $$("a[href], button", $(".drawer__panel", dr));
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
}

// ------------------------------------------------------------------ kpis ----
function renderKpis(S, changed) {
  const T = S.totals;
  const k = [
    { k: "Win rate", v: pct(T.wins, T.losses, T.ties), dec: 1, unit: "%", sub: `${T.wins}–${T.losses} in ${T.matches} matches` },
    { k: "Avg score", v: T.avg ?? 0, dec: 1, sub: "our alliance" },
    { k: "Avg margin", v: Math.abs(T.margin ?? 0), dec: 1, pre: (T.margin ?? 0) >= 0 ? "+" : "−", sub: (T.margin ?? 0) >= 0 ? "points per match" : "points behind" },
    { k: "High score", v: T.high ?? 0, sub: "best alliance score" },
    { k: "Driver skills", v: T.driver?.score ?? 0, sub: eventById(T.driver?.event)?.short ?? "—" },
    { k: "Auton skills", v: T.programming?.score ?? 0, sub: eventById(T.programming?.event)?.short ?? "—" },
  ];
  const el = $("#kpis");
  el.innerHTML = k.map((c) => `
    <div class="kpi"><dt>${esc(c.k)}</dt><dd>${c.pre ?? ""}<span data-count="${c.v}" data-dec="${c.dec ?? 0}">${Number(c.v).toFixed(c.dec ?? 0)}</span>${c.unit ? `<small>${c.unit}</small>` : ""}</dd><p>${esc(c.sub)}</p></div>`).join("");
  if (changed) $$("[data-count]", el).forEach((n, i) => countUp(n, { delay: i * 40 }));
  else counters(el);
}

// ----------------------------------------------------------------- chart ----
const SVGNS = "http://www.w3.org/2000/svg";
let chartSeen = false;

// A bar anchored on the baseline with rounding only on its free end.
function barPath(x, y0, w, h, up) {
  if (h <= 0) return "";
  const r = Math.min(4, w / 2, h);
  if (up) { const y = y0 - h; return `M${x},${y0}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y0}Z`; }
  const y = y0 + h;
  return `M${x},${y0}V${y - r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y - r}V${y0}Z`;
}

function growBars() {
  if (reduced) return;
  const svg = $("#chart");
  animate($$(".bar-us", svg), { scaleY: { from: 0, to: 1 }, duration: 900, delay: stagger(5), ease: "outExpo" });
  animate($$(".bar-them", svg), { scaleY: { from: 0, to: 1 }, duration: 900, delay: stagger(5, { start: 80 }), ease: "outExpo" });
  animate($$(".elim", svg), { scale: { from: 0, to: 1 }, duration: 600, delay: stagger(20, { start: 500 }), ease: "outBack" });
}

function renderChart(S, changed) {
  const svg = $("#chart");
  const scroll = $("#chartScroll");
  const matches = S.events.flatMap((e) => played(e).map((m) => ({ ...m, ev: e })));
  svg.innerHTML = "";
  if (!matches.length) return;

  const H = 380, top = 52, bottom = 22, left = 44, right = 18;
  const avail = Math.max(320, scroll.clientWidth - 2);
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

  const g = () => { const n = document.createElementNS(SVGNS, "g"); svg.append(n); return n; };
  const el = (parent, tag, attrs, text) => {
    const n = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text != null) n.textContent = text;
    parent.append(n);
    return n;
  };

  const bands = g(), labels = g();
  let i = 0;
  S.events.forEach((e, ei) => {
    const n = played(e).length;
    if (!n) return;
    const x = left + i * slot, w = n * slot;
    el(bands, "rect", { x, y: top - 34, width: w, height: H - top + 34 - bottom + 4, class: `ev-band${ei % 2 ? " alt" : ""}`, "data-ev": e.id });
    if (i > 0) el(bands, "line", { x1: x, x2: x, y1: top - 34, y2: H - bottom + 4, class: "sep" });
    const chars = Math.floor((w - 10) / 6.7);
    const name = e.short.length <= chars ? e.short : chars >= 5 ? e.short.slice(0, chars - 1).trimEnd() + "…" : "";
    if (name) el(labels, "text", { x: x + 6, y: top - 20, class: "ev-label" }, name);
    if (w > 30) el(labels, "text", { x: x + 6, y: top - 7 }, `${MONTHS[ymd(e.start)[1] - 1]}${e.awards.length ? " ★" : ""}`);
    i += n;
  });

  const grid = g();
  for (let v = step; v <= ceil; v += step) {
    for (const s of [-1, 1]) {
      const y = y0 - s * sc(v);
      el(grid, "line", { x1: left, x2: W - right, y1: y, y2: y, class: "grid" });
      el(grid, "text", { x: left - 8, y: y + 4, "text-anchor": "end" }, v);
    }
  }
  el(grid, "text", { x: left - 8, y: y0 + 4, "text-anchor": "end" }, "0");

  const marks = g();
  matches.forEach((m, k) => {
    const cx = left + k * slot + slot / 2;
    const grp = el(marks, "g", { class: "m", "data-k": k, "data-ev": m.ev.id });
    el(grp, "path", { d: barPath(cx - bw / 2, y0 - 1, bw, sc(m.us), true), class: "bar-us", style: "transform-box:fill-box;transform-origin:50% 100%" });
    el(grp, "path", { d: barPath(cx - bw / 2, y0 + 1, bw, sc(m.them), false), class: "bar-them", style: "transform-box:fill-box;transform-origin:50% 0%" });
    if (m.round !== 2) el(grp, "circle", { cx, cy: y0 - sc(m.us) - 9, r: 4, class: "elim", style: "transform-box:fill-box;transform-origin:center" });
  });
  el(svg, "line", { x1: left, x2: W - right, y1: y0, y2: y0, class: "base" });

  const hits = g();
  hits.setAttribute("aria-hidden", "true");
  matches.forEach((m, k) => el(hits, "rect", { x: left + k * slot, y: top - 34, width: slot, height: H - top + 34 - bottom, class: "hit", "data-k": k }));

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
    let x = hr.left - fr.left + hr.width / 2 + 14;
    if (x + tip.offsetWidth > fr.width) x = hr.left - fr.left + hr.width / 2 - tip.offsetWidth - 14;
    tip.style.left = `${Math.max(0, x)}px`;
    tip.style.top = `${scroll.getBoundingClientRect().top - fr.top + 56}px`;
  };
  const hide = () => { svg.classList.remove("is-hovering"); $$(".is-hot", svg).forEach((n) => n.classList.remove("is-hot")); tip.hidden = true; };
  hits.addEventListener("pointerover", (e) => { const k = e.target.dataset.k; if (k != null) show(Number(k)); });
  hits.addEventListener("pointerleave", hide);
  svg.onpointerleave = hide;
  scroll.onscroll = hide;
  scroll.scrollLeft = 0;

  if (reduced) return;
  if (changed && chartSeen) growBars();
  else if (!chartSeen) {
    $$(".bar-us, .bar-them, .elim", svg).forEach((n) => (n.style.transform = "scale(1, 0)"));
    onView(scroll, () => { chartSeen = true; growBars(); });
  }
}

// ---------------------------------------------------------------- worlds ----
function renderWorlds() {
  const e = allEvents().filter((x) => x.level === "World").pop();
  if (!e) return;
  const r = e.rank;
  const facts = [
    ["Division", e.division], ["Rank", r ? ordinal(r.rank) : "—"], ["Record", r ? wl(r) : "—"],
    ["Avg score", r ? r.avg : "—"], ["Driver skills", e.skills?.driver ?? "—"], ["Auton skills", e.skills?.programming ?? "—"],
  ];
  $("#worldsFacts").innerHTML = facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");
  const q = played(e).filter((m) => m.round === 2);
  const strip = $("#worldsStrip");
  strip.innerHTML = q.map((m) => `
    <li class="${m.result}" title="${esc(`${m.label}: with ${m.partners.join(", ")} vs ${m.opponents.join(", ")}`)}">
      <span class="s-res">${m.result === "W" ? "WIN" : m.result === "L" ? "LOSS" : "TIE"}</span>
      <span class="s-score">${m.us}<span>–${m.them}</span></span>
      <span class="s-q">${esc(m.label)}</span>
    </li>`).join("");
  const tiles = $$("li", strip);
  if (reduced) return;
  tiles.forEach((t) => (t.style.opacity = 0));
  onView(strip, () => animate(tiles, {
    opacity: { from: 0, to: 1 }, translateY: { from: 40, to: 0 }, rotate: { from: (_, i) => (i % 2 ? 6 : -6), to: 0 },
    duration: 900, delay: stagger(70, { from: "center" }), ease: "outBack(1.4)",
  }));
}

// ---------------------------------------------------------------- videos ----
function findMatch(eventId, key) {
  const e = eventById(eventId);
  if (!e) return {};
  const [round, inst, num] = key.split("-").map(Number);
  return { e, m: e.matches.find((x) => x.round === round && x.instance === inst && x.num === num) };
}

function renderVideos() {
  $("#videoGrid").innerHTML = D.videos.map((v) => {
    const { e, m } = findMatch(v.event, v.match);
    const res = m?.played ? `<span class="vid__res ${m.result}">${m.result === "W" ? "W" : "L"} ${m.us}–${m.them}</span>` : "";
    return `
      <li class="vid">
        <button class="vid__frame" type="button" data-yt="${esc(v.id)}" aria-label="Play: ${esc(v.title)}">
          <img src="https://i.ytimg.com/vi/${esc(v.id)}/hqdefault.jpg" alt="" loading="lazy" width="480" height="360" draggable="false" />
          <span class="vid__play" aria-hidden="true"></span>${res}
        </button>
        <figcaption>
          <p class="vid__t">${esc(v.title)}</p>
          <p class="vid__m">${[e ? fmtDate(e.start) : "", m?.partners?.length ? `with ${esc(m.partners.join(", "))}` : "", `via ${esc(v.channel)}`].filter(Boolean).join(" · ")}</p>
        </figcaption>
      </li>`;
  }).join("");
  $("#streamList").innerHTML = `Full livestreams: ${D.streams.map((s) => `<a href="https://www.youtube.com/watch?v=${esc(s.id)}" target="_blank" rel="noopener">${esc(s.title)}</a>`).join(" · ")}`;

  $("#videoGrid").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-yt]");
    if (!b || b.dataset.playing || carouselDragged) return;
    b.dataset.playing = "1";
    const f = document.createElement("iframe");
    f.src = `https://www.youtube-nocookie.com/embed/${b.dataset.yt}?autoplay=1&rel=0&modestbranding=1`;
    f.title = b.getAttribute("aria-label").replace(/^Play: /, "");
    f.allow = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen";
    f.allowFullscreen = true;
    b.replaceChildren(f);
  });
  riseIn($$(".vid"), { y: 30, gap: 80 });
}

// Drag the video row sideways with the mouse; arrows step one card at a time.
let carouselDragged = false;
function carousel() {
  const el = $("#videoRail"), prev = $("#vidPrev"), next = $("#vidNext");
  const step = () => ($(".vid", el)?.offsetWidth ?? 400) + 18;
  const update = () => {
    prev.disabled = el.scrollLeft < 4;
    next.disabled = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
  };
  prev.addEventListener("click", () => el.scrollBy({ left: -step(), behavior: "smooth" }));
  next.addEventListener("click", () => el.scrollBy({ left: step(), behavior: "smooth" }));
  el.addEventListener("scroll", update, { passive: true });
  addEventListener("resize", update);
  update();

  let down = false, startX = 0, startLeft = 0;
  el.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    down = true; carouselDragged = false; startX = e.clientX; startLeft = el.scrollLeft;
  });
  addEventListener("pointermove", (e) => {
    if (!down) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 5) { carouselDragged = true; el.classList.add("is-dragging"); }
    el.scrollLeft = startLeft - dx;
  });
  addEventListener("pointerup", () => {
    if (!down) return;
    down = false;
    el.classList.remove("is-dragging");
    setTimeout(() => (carouselDragged = false), 0);
  });
}

// ------------------------------------------------------------------- aoe ----
function renderAoeNotes(S) {
  const ms = S.events.flatMap(played);
  const aoe = (t) => /^20850[A-Z]$/.test(t) && t !== TEAM;
  const withAoe = ms.filter((m) => m.partners.some(aoe)).length;
  const vsAoe = ms.filter((m) => m.opponents.some(aoe)).length;
  const sibs = new Set(ms.flatMap((m) => [...m.partners, ...m.opponents]).filter(aoe));
  $("#aoeSiblings").innerHTML = ms.length
    ? `<dt>AOE teams in ${esc(S.name)}</dt><dd>We played <b>${ms.length}</b> matches. In <b>${withAoe}</b> of them our partner was another AOE team, and in <b>${vsAoe}</b> we played against one. That's <b>${sibs.size}</b> different 20850 teams.</dd>`
    : `<dt>${esc(S.name)}</dt><dd>We haven't played any matches yet this season.</dd>`;
  const home = allEvents().filter((e) => /^AOE Robotics/.test(e.short) && e.rank);
  const out = (f) => ({ "Round of 16": "out in the round of 16", Quarterfinalists: "out in the quarterfinals", Semifinalists: "out in the semifinals", Qualifications: "didn't make elims" })[f] || (f || "").toLowerCase();
  $("#aoeHome").innerHTML = `<dt>At AOE's own events</dt><dd>${home.map((e) => `<b>${esc(e.short)}</b> (${esc(fmtRange(e.start, e.end))}, ${ymd(e.start)[0]}): ${ordinal(e.rank.rank)} after quals, ${esc(out(e.finish))}.`).join(" ") || "Results will show up here."}</dd>`;
}

// ------------------------------------------------------------------ hero ----
// Letters rise into place (ReactBits "SplitText").
function heroIntro() {
  const title = $("#heroTitle");
  if (reduced) return;
  const { chars } = splitText(title, { chars: true });
  chars.forEach((c) => c.classList.add("char"));
  animate(chars, {
    opacity: { from: 0, to: 1 }, translateY: { from: "45%", to: "0%" }, rotate: { from: 8, to: 0 },
    filter: { from: "blur(14px)", to: "blur(0px)" },
    duration: 1300, delay: stagger(50, { start: 150 }), ease: "outExpo",
  });
  animate([".hero__lede", ".hero__actions", ".hero__art"], {
    opacity: { from: 0, to: 1 }, translateY: { from: 24, to: 0 }, duration: 1100, delay: stagger(110, { start: 350 }), ease: "outExpo",
  });
}

// The highlighted phrase cycles through real results (ReactBits "RotatingText").
function rotator() {
  const el = $("#rotator");
  const phrases = [];
  for (const e of [...allEvents()].reverse()) for (const a of e.awards) {
    const t = a.title.replace(/^Tournament /, "");
    phrases.push(e.level === "World" ? `${t} at Worlds` : `${t} at ${e.short}`);
  }
  const cur = D.seasons[D.seasonOrder[D.seasonOrder.length - 1]];
  const last = cur?.events.filter((e) => e.rank).pop();
  if (last) phrases.unshift(`${wl(last.rank)} at ${last.short.split(" · ")[0]}`);
  if (!phrases.length) return;
  // letters are grouped per word so a long phrase can still wrap on a phone
  const chars = (t) => t.split(" ").map((w) => `<span class="rw">${[...w].map((c) => `<span class="char">${esc(c)}</span>`).join("")}</span>`).join(" ");
  let i = 0;
  el.innerHTML = chars(phrases[0]);
  if (reduced || phrases.length < 2) return;
  setInterval(async () => {
    if (document.hidden) return;
    const w0 = el.offsetWidth;
    await animate($$(".char", el), { translateY: "-120%", opacity: 0, duration: 380, delay: stagger(12), ease: "inQuad" });
    i = (i + 1) % phrases.length;
    el.style.width = "";
    el.innerHTML = chars(phrases[i]);
    const w1 = el.offsetWidth;
    el.style.width = `${w0}px`;
    animate(el, { width: w1, duration: 500, ease: "outExpo", onComplete: () => (el.style.width = "") });
    animate($$(".char", el), { translateY: { from: "120%", to: "0%" }, opacity: { from: 0, to: 1 }, duration: 600, delay: stagger(16), ease: "outExpo" });
  }, 3200);
}

// The logo drifts a few pixels against the pointer.
const pointer = { x: 0.7, y: 0.55, tx: 0.7, ty: 0.55 };
function heroMotion() {
  const hero = $(".hero"), art = $(".hero__logo");
  hero.addEventListener("pointermove", (e) => {
    const hr = hero.getBoundingClientRect();
    pointer.tx = (e.clientX - hr.left) / hr.width;
    pointer.ty = 1 - (e.clientY - hr.top) / hr.height;
    if (reduced || !finePointer) return;
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
function flow(cv = $("#flow"), ptr = pointer, base = [0.965, 0.961, 0.949]) {
  if (!cv) return;
  const gl = cv.getContext("webgl", { antialias: false, alpha: false, preserveDrawingBuffer: false });
  if (!gl) return;
  const vs = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;
  const fs = `
    precision mediump float;
    uniform vec2 u_res; uniform float u_t; uniform vec2 u_m; uniform vec3 u_base;
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
      vec3 cream = u_base;
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
  gl.uniform3f(gl.getUniformLocation(prog, "u_base"), ...base);

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
    ptr.x += (ptr.tx - ptr.x) * 0.04;
    ptr.y += (ptr.ty - ptr.y) * 0.04;
    gl.uniform1f(uT, (now - t0) / 1000);
    gl.uniform2f(uM, ptr.x, ptr.y);
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

// Team number scrambles before it settles (ReactBits "DecryptedText").
function decrypt(el) {
  const final = el.dataset.final ?? (el.dataset.final = el.textContent);
  const pool = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&";
  let frame = 0;
  clearInterval(el._dec);
  el._dec = setInterval(() => {
    const done = Math.floor(frame / 2);
    el.textContent = [...final].map((c, i) => (i < done ? c : pool[(Math.random() * pool.length) | 0])).join("");
    if (done >= final.length) { clearInterval(el._dec); el.textContent = final; }
    frame++;
  }, 40);
}

// Buttons drift toward the pointer (ReactBits "Magnet").
function magnet() {
  if (reduced || !finePointer) return;
  for (const b of $$("[data-magnet]")) {
    b.addEventListener("pointermove", (e) => {
      const r = b.getBoundingClientRect();
      utils.set(b, { translateX: (e.clientX - (r.left + r.width / 2)) * 0.25, translateY: (e.clientY - (r.top + r.height / 2)) * 0.35 });
    });
    b.addEventListener("pointerleave", () => animate(b, { translateX: 0, translateY: 0, duration: 700, ease: "outElastic(1, .5)" }));
  }
}

// Little gold sparks fly out where you click (ReactBits "ClickSpark").
function clickSpark() {
  if (reduced) return;
  document.addEventListener("click", (e) => {
    if (!e.target.closest("[data-spark]") || !e.clientX) return;
    const sparks = Array.from({ length: 8 }, (_, i) => {
      const s = document.createElement("span");
      s.className = "spark";
      s.style.left = `${e.clientX - 1}px`;
      s.style.top = `${e.clientY - 10}px`;
      s.dataset.a = (i / 8) * Math.PI * 2;
      document.body.append(s);
      return s;
    });
    animate(sparks, {
      translateX: (el) => Math.cos(+el.dataset.a) * 34,
      translateY: (el) => Math.sin(+el.dataset.a) * 34,
      rotate: (el) => (+el.dataset.a * 180) / Math.PI + 90,
      scaleY: { from: 1, to: 0 }, opacity: { from: 1, to: 0 },
      duration: 550, ease: "outQuart",
      onComplete: () => sparks.forEach((s) => s.remove()),
    });
  });
}

// Two rows of big type that speed up with scrolling (ReactBits "ScrollVelocity").
function scrollVelocity() {
  const rows = $$(".velocity__row");
  const item = `<span class="velocity__item">Lucky Cats <i class="velocity__dot"></i> 20850C <img src="assets/img/logo.webp" alt="" /> Rockville, MD <i class="velocity__dot"></i></span>`;
  for (const r of rows) $(".velocity__track", r).innerHTML = item.repeat(4);
  if (reduced) return;
  let vel = 0, lastY = scrollY;
  addEventListener("scroll", () => { vel += scrollY - lastY; lastY = scrollY; }, { passive: true });
  const state = rows.map((r) => ({ el: $(".velocity__track", r), dir: Number(r.dataset.dir), x: 0 }));
  let prev = performance.now();
  const tick = (now) => {
    const dt = Math.min(48, now - prev) / 16.67;
    prev = now;
    vel *= 0.88;
    const boost = Math.min(10, Math.abs(vel) * 0.15);
    const sign = vel < -0.5 ? -1 : 1;
    for (const s of state) {
      const half = s.el.scrollWidth / 2;
      s.x += s.dir * sign * (0.5 + boost) * dt;
      if (s.x <= -half) s.x += half;
      if (s.x > 0) s.x -= half;
      s.el.style.transform = `translate3d(${s.x}px,0,0)`;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ------------------------------------------------------------- page chrome ----
let lenis = null;
function scrollToEl(el) {
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: -10, duration: 1.4 });
  else el.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
}

function smoothScroll() {
  if (!reduced && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || !lenis) return;
    const id = a.getAttribute("href");
    const el = id === "#top" ? 0 : document.querySelector(id);
    if (el === null) return;
    e.preventDefault();
    lenis.scrollTo(el, { offset: id === "#top" ? 0 : -10, duration: 1.4 });
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
    n.classList.toggle("is-hidden", !open && y > innerHeight * 0.8 && y > last + 4);
    if (y < last - 4) n.classList.remove("is-hidden");
    last = y;
  }, { passive: true });
  const close = () => { links.classList.remove("is-open"); n.classList.remove("menu-open"); menu.setAttribute("aria-expanded", "false"); };
  menu.addEventListener("click", () => {
    const open = !links.classList.contains("is-open");
    links.classList.toggle("is-open", open);
    n.classList.toggle("menu-open", open);
    menu.setAttribute("aria-expanded", open);
  });
  links.addEventListener("click", (e) => { if (e.target.closest("a")) close(); });
  const map = new Map($$("a", links).map((a) => [a.getAttribute("href").slice(1), a]));
  const io = new IntersectionObserver((ents) => {
    for (const en of ents) {
      if (!en.isIntersecting) continue;
      for (const a of map.values()) a.classList.remove("is-active");
      map.get(en.target.id)?.classList.add("is-active");
    }
  }, { rootMargin: "-45% 0px -50% 0px" });
  for (const id of map.keys()) { const s = document.getElementById(id); if (s) io.observe(s); }
  const num = $("[data-decrypt]");
  if (num && !reduced) { decrypt(num); $(".nav__mark").addEventListener("pointerenter", () => decrypt(num)); }
}

function mail() {
  const toast = Object.assign(document.createElement("div"), { className: "toast", role: "status" });
  document.body.append(toast);
  $("#copyMail").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText("luckycats20850@gmail.com"); toast.textContent = "Email copied"; }
    catch { toast.textContent = "luckycats20850@gmail.com"; }
    toast.classList.add("is-on");
    setTimeout(() => toast.classList.remove("is-on"), 1800);
  });
}

function footer() {
  const t = new Date(D.generated_at);
  const when = isNaN(t) ? "" : ` Last updated ${MONTHS[t.getMonth()]} ${t.getDate()}, ${t.getFullYear()}.`;
  $("#footData").innerHTML = `Match results come from <a href="https://events.vex.com/teams/V5RC/20850C" target="_blank" rel="noopener">VEX Events</a> and update every night.${esc(when)}`;
}

// The support card gets its own, warmer copy of the hero's color field.
function ctaFlow() {
  const cv = $("#ctaFlow");
  if (!cv) return;
  const card = cv.parentElement;
  const ptr = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
  card.addEventListener("pointermove", (e) => {
    const r = card.getBoundingClientRect();
    ptr.tx = (e.clientX - r.left) / r.width;
    ptr.ty = 1 - (e.clientY - r.top) / r.height;
  });
  flow(cv, ptr, [1.0, 0.84, 0.6]);
}

// A thin bar across the top fills in as you read down the page.
function pageProgress() {
  const bar = $("#pageProgress");
  if (!bar) return;
  const set = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
  };
  addEventListener("scroll", set, { passive: true });
  addEventListener("resize", set);
  set();
}

// ------------------------------------------------------------------ boot ----
function boot() {
  if (!D) { console.error("data/team.js did not load"); return; }
  buildSwitches();
  renderOverview();
  renderSeason();
  renderWorlds();
  renderVideos();
  footer();
  heroIntro();
  rotator();
  heroMotion();
  flow();
  ctaFlow();
  pageProgress();
  blurText();
  riseIn($$(".about__card"), { y: 40, gap: 90 });
  riseIn($$(".cta"), { y: 40 });
  nav();
  smoothScroll();
  magnet();
  clickSpark();
  scrollVelocity();
  carousel();
  drawer();
  mail();
  rail.start();

  let rw = innerWidth, rt;
  addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      syncSwitches();
      rail.measure();
      if (innerWidth !== rw) { rw = innerWidth; renderChart(D.seasons[season], false); }
    }, 150);
  });
  document.fonts?.ready.then(() => { syncSwitches(); rail.measure(); });
  addEventListener("load", () => rail.measure());
}

boot();
