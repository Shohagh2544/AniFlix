(function () {
var SUPABASE_URL = "https://wzltxdwrcmrfxxrwqxvm.supabase.co";
var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6bHR4ZHdyY21yZnh4cndxeHZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4MjczMTgsImV4cCI6MjEwODQwMzMxOH0.OefY2EBUDOkxNZX46QWczQy3Bw1p40WWR8igHfXgui0";

var app = document.getElementById("app");
if (!window.supabase) { app.innerHTML = '<div class="empty">Could not load the Supabase library. Check your internet and refresh.</div>'; return; }
var db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
var allSeries = null;

var IC = {
  search: '<svg class="i" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  bm: '<svg class="i" viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z"/></svg>'
};

function esc(t) {
  return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
function err(e) { return '<div class="empty">Could not load: ' + esc((e && e.message) || e) + "</div>"; }
function getList() { try { return JSON.parse(localStorage.getItem("aniflix-list") || "[]"); } catch (e) { return []; } }
function setList(l) { try { localStorage.setItem("aniflix-list", JSON.stringify(l)); } catch (e) {} }
function inList(id) { return getList().indexOf(Number(id)) !== -1; }
function toggleList(id) {
  var l = getList(), i = l.indexOf(Number(id));
  if (i === -1) l.push(Number(id)); else l.splice(i, 1);
  setList(l);
  return i === -1;
}
function setTab(name) {
  var tabs = document.querySelectorAll("#tabs a");
  for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle("on", tabs[i].getAttribute("data-tab") === name);
}
async function loadSeries() {
  if (allSeries) return allSeries;
  var r = await db.from("series").select("*").order("id");
  if (r.error) throw r.error;
  allSeries = r.data || [];
  return allSeries;
}
function chips(s) {
  var out = [];
  if (s.rating) out.push("★ " + s.rating);
  if (s.year) out.push(s.year);
  String(s.genre || "").split(",").forEach(function (g) { g = g.trim(); if (g) out.push(g); });
  return out.map(function (x) { return '<span class="chip">' + esc(x) + "</span>"; }).join("");
}
function poster(s) {
  return '<a class="pc" href="#' + (s._movie ? "movie" : "series") + '-' + esc(s.id) + '">' +
    (s.cover_url ? '<img src="' + esc(s.cover_url) + '" alt="" decoding="async" loading="lazy" onerror="this.remove()">' : "") +
    (s.rating ? '<span class="rate glass">★ ' + esc(s.rating) + "</span>" : "") +
    '<div class="pt glass"><span>' + esc(s.title) + "</span></div></a>";
}
function topBar(title, withSearch) {
  return '<div class="topbar" id="topbar"><div class="logo">' + esc(title || "AniFlix") + '</div>' +
    (withSearch ? '<div class="tsw" id="tsw"><button class="tsb" id="sbtn" aria-label="Search">' + IC.search + '</button><input id="ssin" readonly type="search" placeholder="Search anime..." autocomplete="off"><button class="tsx" id="ssc" aria-label="Close">&#10005;</button></div>' : "") + "</div>";
}

async function homeView0() {
  setTab("home"); document.title = "AniFlix";
  app.innerHTML = topBar("", true) + '<div class="hero skel"></div>';
  var list;
  try { list = await loadSeries(); } catch (e) { app.innerHTML = topBar("", true) + err(e); return; }
  if (!list.length) { app.innerHTML = topBar("", true) + '<div class="empty">No series yet.</div>'; return; }
  var f = list.find(function (s) { return s.cover_url; }) || list[0];
  app.innerHTML = topBar("", true) +
    '<a class="hero" href="#series-' + esc(f.id) + '">' +
    (f.cover_url ? '<img src="' + esc(f.cover_url) + '" alt="" decoding="async" onerror="this.remove()">' : "") +
    '<div class="shade"></div><div class="hc"><div class="chips">' + chips(f) + "</div><h1>" + esc(f.title) + "</h1><p>" + esc(f.description) +
    '</p><span class="btn primary">▶ Watch now</span></div></a>' +
    '<h2 class="h">Recommended for You</h2><div class="row">' + list.filter(function (s) { return !isMovie(s); }).map(poster).join("") + "</div>" + (list.some(isMovie) ? '<h2 class="h">Movies</h2><div class="row">' + list.filter(isMovie).map(poster).join("") + "</div>" : "") +
    (list.length > 5 ? '<h2 class="h">Browse all</h2><div class="grid">' + list.map(poster).join("") + "</div>" : "");
}

async function searchView() {
  setTab("search"); document.title = "Search · AniFlix";
  app.innerHTML = topBar() + '<div class="empty">Loading...</div>';
  var list;
  try { list = await loadSeries(); } catch (e) { app.innerHTML = topBar() + err(e); return; }
  try { await loadMovies(); } catch (e) {}
  app.innerHTML = topBar() + '<label class="sbar glass">' + IC.search +
    '<input id="q" readonly type="search" placeholder="Search anime..." autocomplete="off"></label><div id="res"></div>';
  var q = document.getElementById("q"), res = document.getElementById("res");
  function draw() {
    var t = q.value.trim().toLowerCase();
    var l = ssMerge(list).filter(function (s) { return (s.title || "").toLowerCase().indexOf(t) !== -1; });
    res.innerHTML = l.length ? '<h2 class="h">' + (t ? "Results" : "All series &amp; movies") + '</h2><div class="grid">' + l.map(poster).join("") + "</div>" : '<div class="empty">No results.</div>';
  }
  q.addEventListener("input", draw);
  draw();
}

async function listView() {
  setTab("list"); document.title = "My List · AniFlix";
  app.innerHTML = topBar("", true) + '<div class="empty">Loading...</div>';
  var list;
  try { list = await loadSeries(); } catch (e) { app.innerHTML = topBar("", true) + err(e); return; }
  var ids = getList();
  var l = list.filter(function (s) { return ids.indexOf(Number(s.id)) !== -1; });
  app.innerHTML = topBar("", true) + '<h2 class="h" style="margin-top:6px">My List</h2>' + (l.length ? '<div class="grid">' + l.map(poster).join("") + "</div>" : '<div class="empty">Tap the bookmark on a series to save it here.</div>');
}

function videoInfo(ep) {
  var u = ep.video_url;
  if (u && /\.(mp4|webm|m4v|m3u8)(\?|$)/i.test(u)) return { kind: "video", src: u };
  var src = u || (ep.dailymotion_id ? "https://www.dailymotion.com/embed/video/" + encodeURIComponent(ep.dailymotion_id) : "");
  return src ? { kind: "iframe", src: src } : null;
}

async function seriesView(id) {
  setTab("home");
  app.innerHTML = '<div class="backdrop skel"></div>';
  var results;
  try {
    results = await Promise.all([
      db.from("series").select("*").eq("id", id).maybeSingle(),
      db.from("episodes").select("*").eq("series_id", id).order("episode_number")
    ]);
  } catch (e) { app.innerHTML = err(e); return; }
  var sr = results[0], er = results[1];
  if (sr.error || er.error) { app.innerHTML = err(sr.error || er.error); return; }
  var s = sr.data, eps = er.data || [];
  if (!s) { app.innerHTML = '<div class="empty">Series not found.</div>'; return; }
  document.title = s.title + " · AniFlix";

  var last = null;
  try { last = localStorage.getItem("aniflix-last-" + id); } catch (e) {}
  var lastIdx = -1;
  eps.forEach(function (e, i) { if (String(e.id) === last) lastIdx = i; });
  var text = s.description || "";
  var long = text.length > 120;

  app.innerHTML =
    '<div class="backdrop">' + (s.cover_url ? '<img src="' + esc(s.cover_url) + '" alt="" decoding="async" onerror="this.remove()">' : "") + '<div class="shade"></div>' +
    '<a class="rb l glass" href="#" aria-label="Back">‹</a>' +
    '<button class="rb r glass' + (inList(id) ? " on" : "") + '" id="save" aria-label="My List">' + IC.bm + "</button></div>" +
    '<div class="info"><h1>' + esc(s.title) + '</h1><div class="chips">' +
    '<span class="chip">' + (oneMovie(s, eps) ? "Movie" : eps.length + (eps.length === 1 ? " episode" : " episodes")) + "</span>" + chips(s) + "</div>" +
    '<button class="btn primary" id="go">▶ ' + (oneMovie(s, eps) ? "Play Movie" : (lastIdx > -1 ? "Continue Watching" : "Start Watching")) + "</button>" +
    (text ? '<p class="desc' + (long ? " clamp" : "") + '" id="desc">' + esc(text) + "</p>" : "") +
    (long ? '<button class="more" id="more">More</button>' : "") +
    '<div id="stage"></div><div id="nav"></div>' +
    '<div class="eh"><h2 class="h">Episodes</h2>' + (eps.length > 1 ? '<button class="sort glass" id="sort">Newest first</button>' : "") + "</div>" +
    '<div class="el" id="el"></div></div>';

  var stage = document.getElementById("stage"), nav = document.getElementById("nav");
  var listEl = document.getElementById("el"), sortBtn = document.getElementById("sort");
  if (oneMovie(s, eps)) { var eh = document.querySelector(".eh"); if (eh) eh.style.display = "none"; listEl.style.display = "none"; }
  var cur = -1, newest = false;

  document.getElementById("save").addEventListener("click", function () { this.classList.toggle("on", toggleList(id)); });
  var more = document.getElementById("more");
  if (more) more.addEventListener("click", function () {
    var d = document.getElementById("desc");
    d.classList.toggle("clamp");
    more.textContent = d.classList.contains("clamp") ? "More" : "Less";
  });

  function epNum(ep, i) { return ep.episode_number != null ? ep.episode_number : i + 1; }

  function renderList() {
    if (!eps.length) { listEl.innerHTML = '<div class="empty" style="padding:16px 0">No episodes yet.</div>'; return; }
    var idx = eps.map(function (x, i) { return i; });
    if (newest) idx.reverse();
    listEl.innerHTML = idx.map(function (i) {
      var ep = eps[i], n = epNum(ep, i), active = i === cur;
      var sub = active ? "Now playing" : (String(ep.id) === last ? "Continue watching" : "Episode " + n);
      return '<button class="er glass' + (active ? " active" : "") + '" data-i="' + i + '"><span class="num">' + esc(n) + '</span>' +
        '<span class="meta"><span class="t">' + esc(ep.title || ("Episode " + n)) + '</span><span class="s">' + esc(sub) + "</span></span>" +
        '<span class="go">' + (active ? "❚❚" : "▶") + "</span></button>";
    }).join("");
  }

  function play(i, scroll) {
    cur = i;
    var ep = eps[i];
    try { localStorage.setItem("aniflix-last-" + id, String(ep.id)); } catch (e) {}
    var v = videoInfo(ep), player;
    if (!v) player = '<div class="empty">No video yet.</div>';
    else if (v.kind === "video" && window.initPlayers) player = '<div class="vp" data-src="' + esc(v.src) + '"></div>';
    else if (v.kind === "video") player = '<video controls playsinline preload="metadata" src="' + esc(v.src) + '"></video>';
    else player = '<iframe src="' + esc(v.src) + '" ' + (/abyss/i.test(v.src) ? 'sandbox="allow-scripts allow-same-origin allow-presentation allow-forms" ' : '') + 'allowfullscreen allow="autoplay; fullscreen; encrypted-media; picture-in-picture"></iframe>';
    stage.innerHTML = '<div class="player">' + player + "</div>";
    if (window.initPlayers) window.initPlayers(stage);

    var fs = v && v.kind === "iframe" ? '<a href="' + esc(v.src) + '" target="_blank" rel="noopener">Full screen ↗</a>' : "";
    nav.innerHTML = '<div class="navrow"><button class="navb glass" id="prev"' + (i === 0 ? " disabled" : "") + '>‹ Prev</button>' +
      '<div class="mid"><span class="t">' + esc(ep.title || ("Episode " + epNum(ep, i))) + "</span>" + fs + "</div>" +
      '<button class="navb glass" id="next"' + (i === eps.length - 1 ? " disabled" : "") + '>Next ›</button></div>';
    document.getElementById("prev").addEventListener("click", function () { if (cur > 0) play(cur - 1, true); });
    document.getElementById("next").addEventListener("click", function () { if (cur < eps.length - 1) play(cur + 1, true); });
    var vid = stage.querySelector("video");
    if (vid) vid.addEventListener("ended", function () { if (cur < eps.length - 1) play(cur + 1, false); });

    renderList();
    if (scroll) stage.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  document.getElementById("go").addEventListener("click", function () { if (eps.length) goWatch(id, eps[lastIdx > -1 ? lastIdx : 0].id); });
  listEl.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest(".er") : null;
    if (b) goWatch(id, eps[Number(b.getAttribute("data-i"))].id);
  });
  if (sortBtn) sortBtn.addEventListener("click", function () {
    newest = !newest;
    sortBtn.textContent = newest ? "Oldest first" : "Newest first";
    renderList();
  });
  renderList();
}

var lastTab = 0;
function route0() {
  var h = location.hash, m = h.match(/^#series-(\d+)$/);
  var tab = h === "#search" ? 1 : h === "#list" ? 2 : 0;
  var cls = "enter-u";
  if (!m) { cls = tab > lastTab ? "enter-r" : (tab < lastTab ? "enter-l" : "enter-u"); lastTab = tab; }
  app.scrollTop = 0;
  app.className = m ? "flush" : "wrap";
  void app.offsetWidth;
  app.className += " " + cls;
  var tabs = document.getElementById("tabs");
  if (tabs) tabs.style.setProperty("--i", String(m ? 0 : tab));
  if (m) { seriesView(Number(m[1])); return; }
  if (h === "#search") searchView();
  else if (h === "#list") listView();
  else homeView();
}
function ssEnsure() {
  var el = document.getElementById("ss");
  if (el) return el;
  el = document.createElement("div");
  el.id = "ss";
  el.className = "ss";
  el.innerHTML = '<div class="ssb"></div><div class="ssp glass"><div class="ssh"><label class="ssi">' + IC.search +
    '<input id="ssin" readonly type="search" placeholder="Search anime..." autocomplete="off"></label><button class="ssc" id="ssc">Cancel</button></div><div class="ssr" id="ssr"></div></div>';
  document.body.appendChild(el);
  return el;
}
function ssRow(s) {
  var sub = [s.year, s.rating ? "\u2605 " + s.rating : "", s.genre].filter(Boolean).join(" \u00b7 ");
  return '<a class="rr" href="#series-' + esc(s.id) + '"><span class="th">' +
    (s.cover_url ? '<img src="' + esc(s.cover_url) + '" alt="" decoding="async" onerror="this.remove()">' : "") +
    '</span><span class="meta"><span class="t">' + esc(s.title) + '</span><span class="s">' + esc(sub || "Anime") + '</span></span><span class="go">\u203a</span></a>';
}
function drawSS() {
  var inp = document.getElementById("ssin"), box = document.getElementById("ssr");
  if (!inp || !box) return;
  if (!allSeries) { box.innerHTML = '<div class="empty" style="padding:28px">Loading...</div>'; return; }
  var q = inp.value.trim().toLowerCase();
  var l = allSeries.filter(function (s) { return (s.title || "").toLowerCase().indexOf(q) !== -1; });
  box.innerHTML = (q ? "" : '<div class="ssl">All series</div>') + (l.length ? l.map(ssRow).join("") : '<div class="empty" style="padding:28px">No results.</div>');
}
async function openSS(btn) {
  var el = ssEnsure(), p = el.querySelector(".ssp"), inp = document.getElementById("ssin");
  var r = btn.getBoundingClientRect();
  p.style.transformOrigin = (r.left + r.width / 2 - p.offsetLeft) + "px " + (r.top + r.height / 2 - p.offsetTop) + "px";
  void p.offsetWidth;
  el.classList.add("show");
  document.body.style.overflow = "hidden";
  drawSS();
  try { await loadSeries(); } catch (e) {}
  drawSS();
}
function closeSS() {
  var el = document.getElementById("ss");
  if (!el || !el.classList.contains("show")) return;
  var inp = document.getElementById("ssin");
  inp.blur();
  el.classList.remove("show");
  document.body.style.overflow = "";
  setTimeout(function () { inp.value = ""; }, 450);
}
document.addEventListener("click", function (e) {
  var t = e.target;
  if (!t || !t.closest) return;
  var b = t.closest("#sbtn");
  if (b) { openSS(b); return; }
  if (t.closest("#ssc") || (t.classList && t.classList.contains("ssb"))) { closeSS(); return; }
  if (t.closest(".rr")) closeSS();
});
document.addEventListener("input", function (e) { if (e.target && e.target.id === "ssin") drawSS(); });
document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSS(); });
window.addEventListener("hashchange", closeSS);
function goWatch(sid, eid) { location.hash = "#watch-" + sid + "-" + eid; }

var watchCache = {}, lastWatch = null;
async function watchView(sid, eid) {
  setTab("home");
  var same = !!(lastWatch && lastWatch.sid === sid);
  if (same) app.classList.add("epswitch");
  var cached = watchCache[sid];
  if (!cached) {
    document.title = "Watching \u00b7 AniFlix";
    app.innerHTML = '<div class="wbar"><a class="wback glass" href="#series-' + sid + '" aria-label="Back">\u2039</a></div><div class="player skel"></div>';
    var results;
    try {
      results = await Promise.all([
        db.from("series").select("*").eq("id", sid).maybeSingle(),
        db.from("episodes").select("*").eq("series_id", sid).order("episode_number")
      ]);
    } catch (e) { app.innerHTML = err(e); return; }
    var sr = results[0], er = results[1];
    if (sr.error || er.error) { app.innerHTML = err(sr.error || er.error); return; }
    if (!sr.data) { app.innerHTML = '<div class="empty">Series not found.</div>'; return; }
    cached = watchCache[sid] = { s: sr.data, eps: er.data || [] };
  }
  var s = cached.s, eps = cached.eps;
  var i = -1;
  eps.forEach(function (x, k) { if (Number(x.id) === eid) i = k; });
  if (i < 0) { app.innerHTML = '<div class="empty">Episode not found.</div>'; return; }
  var ep = eps[i];
  var dir = 0;
  if (same && lastWatch.i !== i) dir = i > lastWatch.i ? 1 : -1;
  lastWatch = { sid: sid, i: i };
  try { localStorage.setItem("aniflix-last-" + sid, String(ep.id)); } catch (e) {}
  document.title = (s.title || "") + " \u00b7 AniFlix";
  function num(x, k) { return x.episode_number != null ? x.episode_number : k + 1; }
  function go(k) { location.replace("#watch-" + sid + "-" + eps[k].id); }

  var v = videoInfo(ep), player;
  if (!v) player = '<div class="empty">No video yet.</div>';
  else if (v.kind === "video" && window.initPlayers) player = '<div class="vp" data-src="' + esc(v.src) + '"></div>';
  else if (v.kind === "video") player = '<video controls playsinline preload="metadata" src="' + esc(v.src) + '"></video>';
  else player = '<iframe src="' + esc(v.src) + '" ' + (/abyss/i.test(v.src) ? 'sandbox="allow-scripts allow-same-origin allow-presentation allow-forms" ' : '') + 'allowfullscreen allow="autoplay; fullscreen; encrypted-media; picture-in-picture"></iframe>';

  var rows = eps.map(function (x, k) {
    var n = num(x, k), active = k === i;
    return '<button class="er glass' + (active ? " active" : "") + '" data-i="' + k + '"><span class="num">' + esc(n) + '</span>' +
      '<span class="meta"><span class="t">' + esc(x.title || ("Episode " + n)) + '</span><span class="s">' + (active ? "Now playing" : "Episode " + esc(n)) + '</span></span>' +
      '<span class="go">' + (active ? "\u275a\u275a" : "\u25b6") + '</span></button>';
  }).join("");

  var sw = dir === 0 ? "" : (dir > 0 ? " swap-f" : " swap-b");
  app.innerHTML =
    '<div class="wbar"><a class="wback glass" href="#series-' + sid + '" aria-label="Back">\u2039</a><div class="wtitle' + sw + '"><span class="a" style="white-space:normal;overflow:visible;text-overflow:clip;line-height:1.25">' + esc(s.title) + '</span><span class="b">Episode ' + esc(num(ep, i)) + '</span></div></div>' +
    '<div class="player' + sw + ' swap-d1">' + player + '</div>' +
    '<div class="navrow wnav' + sw + ' swap-d2"><button class="navb glass" id="wprev"' + (i === 0 ? " disabled" : "") + '>\u2039 Prev</button>' +
    '<div class="mid"><span class="t">' + esc(ep.title || ("Episode " + num(ep, i))) + '</span></div>' +
    '<button class="navb glass" id="wnext"' + (i === eps.length - 1 ? " disabled" : "") + '>Next \u203a</button></div>' +
    '<h2 class="h">Episodes</h2><div class="el" id="wel">' + rows + '</div>';

  if (window.initPlayers) window.initPlayers(app);
  var vid = app.querySelector("video");
  if (vid) vid.addEventListener("ended", function () { if (i < eps.length - 1) go(i + 1); });
  document.getElementById("wprev").addEventListener("click", function () { if (i > 0) go(i - 1); });
  document.getElementById("wnext").addEventListener("click", function () { if (i < eps.length - 1) go(i + 1); });
  document.getElementById("wel").addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest(".er") : null;
    if (!b) return;
    var k = Number(b.getAttribute("data-i"));
    if (k !== i) go(k);
  });
}

function route1() {
  var w = location.hash.match(/^#watch-(\d+)-(\d+)$/);
  document.body.classList.toggle("watching", !!w);
  if (!w) { lastWatch = null; route0(); return; }
  app.scrollTop = 0;
  app.className = "wrap";
  void app.offsetWidth;
  app.className = "wrap enter-r";
  var tabs = document.getElementById("tabs");
  if (tabs) tabs.style.setProperty("--i", "0");
  watchView(Number(w[1]), Number(w[2]));
}
var ssImgs = false, ssRaf = 0;
function ssRow(s) {
  var sub = [s.year, s.rating ? "\u2605 " + s.rating : "", s.genre].filter(Boolean).join(" \u00b7 ");
  return '<a class="rr" href="#series-' + esc(s.id) + '"><span class="th">' +
    (ssImgs && s.cover_url ? '<img src="' + esc(s.cover_url) + '" alt="" decoding="async" onerror="this.remove()">' : "") +
    '</span><span class="meta"><span class="t">' + esc(s.title) + '</span><span class="s">' + esc(sub || "Anime") + '</span></span><span class="go">\u203a</span></a>';
}
function drawSSNow() {
  var inp = document.getElementById("ssin"), box = document.getElementById("ssr");
  if (!inp || !box) return;
  if (!allSeries) { box.innerHTML = '<div class="empty" style="padding:28px">Loading...</div>'; return; }
  var q = inp.value.trim().toLowerCase();
  var l = allSeries.filter(function (s) { return (s.title || "").toLowerCase().indexOf(q) !== -1; });
  box.innerHTML = (q ? "" : '<div class="ssl">All series</div>') + (l.length ? l.map(ssRow).join("") : '<div class="empty" style="padding:28px">No results.</div>');
}
function drawSS() { cancelAnimationFrame(ssRaf); ssRaf = requestAnimationFrame(drawSSNow); }
async function openSS(btn) {
  var el = ssEnsure(), p = el.querySelector(".ssp"), inp = document.getElementById("ssin");
  var r = btn.getBoundingClientRect();
  p.style.transformOrigin = (r.left + r.width / 2 - p.offsetLeft) + "px " + (r.top + r.height / 2 - p.offsetTop) + "px";
  ssImgs = false;
  drawSSNow();
  void p.offsetWidth;
  el.classList.add("show");
  document.body.style.overflow = "hidden";
  setTimeout(function () { if (el.classList.contains("show")) { ssImgs = true; drawSSNow(); } }, 470);
  try { await loadSeries(); } catch (e) {}
  drawSSNow();
}
function closeSS() {
  var el = document.getElementById("ss");
  if (!el || !el.classList.contains("show")) return;
  var inp = document.getElementById("ssin");
  inp.blur();
  el.classList.remove("show");
  document.body.style.overflow = "";
  setTimeout(function () { if (!el.classList.contains("show")) { inp.value = ""; ssImgs = false; } }, 450);
}
document.addEventListener("pointerdown", function (e) {
  var t = e.target;
  if (t && (t.id === "q" || t.id === "ssin") && t.readOnly) t.readOnly = false;
}, true);
document.addEventListener("focusout", function (e) {
  var t = e.target;
  if (t && (t.id === "q" || t.id === "ssin")) t.readOnly = true;
});
function ssBarMarker() {}
function ssEnsure() {
  var d = document.getElementById("ssres");
  if (d) return d;
  var bd = document.createElement("div");
  bd.id = "ssbd";
  bd.className = "tsd";
  document.body.appendChild(bd);
  d = document.createElement("div");
  d.id = "ssres";
  d.className = "tsres";
  d.innerHTML = '<div class="ssr" id="ssr"></div>';
  document.body.appendChild(d);
  return d;
}
async function openSS(btn) {
  var bar = document.getElementById("topbar"), inp = document.getElementById("ssin");
  if (!bar || !inp) return;
  if (bar.classList.contains("open")) { inp.readOnly = false; inp.focus(); return; }
  var res = ssEnsure(), bd = document.getElementById("ssbd");
  app.scrollTop = 0;
  ssImgs = false;
  drawSSNow();
  document.body.style.overflow = "hidden";
  bar.classList.add("open");
  bd.classList.add("show");
  res.classList.add("show");
  setTimeout(function () { if (bar.classList.contains("open")) { ssImgs = true; drawSSNow(); } }, 420);
  try { await loadSeries(); } catch (e) {}
  drawSSNow();
}
function closeSS() {
  var bar = document.getElementById("topbar"), res = document.getElementById("ssres");
  var bd = document.getElementById("ssbd"), inp = document.getElementById("ssin");
  if (inp) inp.blur();
  if (bar) bar.classList.remove("open");
  if (res) res.classList.remove("show");
  if (bd) bd.classList.remove("show");
  document.body.style.overflow = "";
  setTimeout(function () {
    var b = document.getElementById("topbar");
    if (!b || !b.classList.contains("open")) {
      var i = document.getElementById("ssin");
      if (i) { i.value = ""; i.readOnly = true; }
      ssImgs = false;
    }
  }, 420);
}
document.addEventListener("click", function (e) {
  var t = e.target;
  if (t && t.classList && t.classList.contains("tsd")) closeSS();
});
function isMovie(s) { return String((s && s.kind) || "").toLowerCase() === "movie"; }
function oneMovie(s, eps) { return isMovie(s) && eps.length <= 1; }
var allMovies = null;
async function loadMovies() {
  if (allMovies) return allMovies;
  var r = await db.from("movies").select("*").order("id", { ascending: false });
  if (r.error) throw r.error;
  allMovies = r.data || [];
  return allMovies;
}
function moviePoster(m) {
  return '<a class="pc" href="#movie-' + esc(m.id) + '">' +
    (m.cover_url ? '<img src="' + esc(m.cover_url) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">' : "") +
    (m.rating ? '<span class="rate glass">\u2605 ' + esc(m.rating) + "</span>" : "") +
    '<div class="pt glass"><span>' + esc(m.title) + "</span></div></a>";
}
function rowHead(h, href) {
  if (!h || !h.parentNode || h.parentNode.classList.contains("rowhead")) return;
  var w = document.createElement("div");
  w.className = "rowhead";
  h.parentNode.insertBefore(w, h);
  w.appendChild(h);
  var b = document.createElement("a");
  b.className = "va";
  b.href = href;
  b.textContent = "View all";
  w.appendChild(b);
  var row = w.nextElementSibling;
  if (row && row.classList.contains("row")) while (row.children.length > 10) row.removeChild(row.lastChild);
}
async function homeView3() {
  await homeView0();
  var ms = null;
  try { ms = await loadMovies(); } catch (e) {}
  if (location.hash && location.hash !== "#") return;
  if (ms && ms.length) {
    var html = '<h2 class="h">Movies</h2><div class="row">' + ms.slice(0, 10).map(moviePoster).join("") + "</div>";
    var row = app.querySelector(".row");
    if (row) row.insertAdjacentHTML("afterend", html);
    else app.insertAdjacentHTML("beforeend", html);
  }
  var hs = app.querySelectorAll("h2.h");
  for (var i = 0; i < hs.length; i++) {
    var h = hs[i], t = h.textContent.trim();
    if (t === "Recommended for You" || t === "Anime") { h.textContent = "Anime"; rowHead(h, "#all-anime"); }
    else if (t === "Movies") rowHead(h, "#all-movies");
    else if (t === "Browse all") { var g = h.nextElementSibling; if (g && g.classList.contains("grid")) g.remove(); h.remove(); }
  }
}
async function allView(kind) {
  setTab("home");
  var isM = kind === "movies", title = isM ? "Movies" : "Anime";
  document.title = title + " \u00b7 AniFlix";
  var head = '<div class="wbar"><a class="wback glass" href="#" aria-label="Back">\u2039</a><div class="wtitle"><span class="a">' + title + '</span><span class="b" id="cnt">&nbsp;</span></div></div>';
  app.innerHTML = head + skeletons(8);
  var list;
  try { list = isM ? await loadMovies() : await loadSeries(); } catch (e) { app.innerHTML = head + err(e); return; }
  if (location.hash !== "#all-" + kind) return;
  app.innerHTML = head + '<label class="sbar glass">' + IC.search + '<input id="allq" type="search" placeholder="Search ' + title.toLowerCase() + '..." autocomplete="off"></label><div id="allg"></div>';
  var cnt = document.getElementById("cnt"), box = document.getElementById("allg"), q = document.getElementById("allq");
  function draw() {
    var t = q.value.trim().toLowerCase();
    var l = list.filter(function (s) { return (s.title || "").toLowerCase().indexOf(t) !== -1; });
    cnt.textContent = l.length + (l.length === 1 ? " title" : " titles");
    box.innerHTML = l.length ? '<div class="grid" style="margin-top:14px">' + l.map(isM ? moviePoster : poster).join("") + "</div>" : '<div class="empty">No results.</div>';
  }
  q.addEventListener("input", draw);
  draw();
}
function routeAll() {
  var h = location.hash;
  if (h === "#all-anime" || h === "#all-movies") {
    document.body.classList.remove("watching");
    if (typeof lastWatch !== "undefined") lastWatch = null;
    app.className = "wrap";
    void app.offsetWidth;
    app.className = "wrap enter-r";
    app.scrollTop = 0;
    var tabs = document.getElementById("tabs");
    if (tabs) tabs.style.setProperty("--i", "0");
    allView(h === "#all-movies" ? "movies" : "anime").catch(function (e) { app.innerHTML = err(e); });
    return true;
  }
  return false;
}
async function movieView(id) {
  setTab("home");
  app.innerHTML = '<div class="backdrop skel"></div>';
  var r;
  try { r = await db.from("movies").select("*").eq("id", id).maybeSingle(); } catch (e) { app.innerHTML = err(e); return; }
  if (r.error) { app.innerHTML = err(r.error); return; }
  var m = r.data;
  if (!m) { app.innerHTML = '<div class="empty">Movie not found.</div>'; return; }
  document.title = m.title + " · AniFlix";
  var text = m.description || "", long = text.length > 120;
  app.innerHTML =
    '<div class="backdrop">' + (m.cover_url ? '<img src="' + esc(m.cover_url) + '" alt="" decoding="async" onerror="this.remove()">' : "") + '<div class="shade"></div>' +
    '<a class="rb l glass" href="#" aria-label="Back">\u2039</a></div>' +
    '<div class="info"><h1>' + esc(m.title) + '</h1><div class="chips"><span class="chip">Movie</span>' + chips(m) + '</div>' +
    '<a class="btn primary" href="#playmovie-' + esc(m.id) + '">\u25b6 Play Movie</a>' +
    (text ? '<p class="desc' + (long ? " clamp" : "") + '" id="desc">' + esc(text) + '</p>' : "") +
    (long ? '<button class="more" id="more">More</button>' : "") + '</div>';
  var more = document.getElementById("more");
  if (more) more.addEventListener("click", function () {
    var d = document.getElementById("desc");
    d.classList.toggle("clamp");
    more.textContent = d.classList.contains("clamp") ? "More" : "Less";
  });
}
async function playMovieView(id) {
  setTab("home");
  document.title = "Watching · AniFlix";
  app.innerHTML = '<div class="wbar"><a class="wback glass" href="#movie-' + id + '" aria-label="Back">\u2039</a></div><div class="player skel"></div>';
  var r;
  try { r = await db.from("movies").select("*").eq("id", id).maybeSingle(); } catch (e) { app.innerHTML = err(e); return; }
  if (r.error || !r.data) { app.innerHTML = err(r.error || "Movie not found."); return; }
  var m = r.data;
  document.title = m.title + " · AniFlix";
  var v = videoInfo(m), player;
  if (!v) player = '<div class="empty">No video yet.</div>';
  else if (v.kind === "video" && window.initPlayers) player = '<div class="vp" data-src="' + esc(v.src) + '"></div>';
  else if (v.kind === "video") player = '<video controls playsinline preload="metadata" src="' + esc(v.src) + '"></video>';
  else player = '<iframe src="' + esc(v.src) + '" ' + (/abyss/i.test(v.src) ? 'sandbox="allow-scripts allow-same-origin allow-presentation allow-forms" ' : '') + 'allowfullscreen allow="autoplay; fullscreen; encrypted-media; picture-in-picture"></iframe>';
  app.innerHTML =
    '<div class="wbar"><a class="wback glass" href="#movie-' + esc(m.id) + '" aria-label="Back"><span>\u2039</span></a><div class="wtitle"><span class="a">' + esc(m.title) + '</span><span class="b">Movie</span></div></div>' +
    '<div class="player">' + player + '</div>' +
    (m.description ? '<p class="desc" style="margin-top:16px">' + esc(m.description) + '</p>' : "");
  if (window.initPlayers) window.initPlayers(app);
}
function route() {
  if (routeAll()) return;
  var h = location.hash, mm = h.match(/^#movie-(\d+)$/), pm = h.match(/^#playmovie-(\d+)$/);
  if (!mm && !pm) { route1(); return; }
  document.body.classList.toggle("watching", !!pm);
  app.scrollTop = 0;
  app.className = mm ? "flush" : "wrap";
  void app.offsetWidth;
  app.className += mm ? " enter-u" : " enter-r";
  var tabs = document.getElementById("tabs");
  if (tabs) tabs.style.setProperty("--i", "0");
  if (mm) movieView(Number(mm[1])); else playMovieView(Number(pm[1]));
}
function ssMerge(list) {
  var out = (list || []).slice();
  (allMovies || []).forEach(function (m) {
    var c = {};
    for (var k in m) c[k] = m[k];
    c._movie = true;
    out.push(c);
  });
  return out;
}
function ssRow(s) {
  var sub = [s._movie ? "Movie" : "", s.year, s.rating ? "\u2605 " + s.rating : "", s.genre].filter(Boolean).join(" \u00b7 ");
  var withImg = typeof ssImgs === "undefined" || ssImgs;
  return '<a class="rr" href="#' + (s._movie ? "movie" : "series") + '-' + esc(s.id) + '"><span class="th">' +
    (withImg && s.cover_url ? '<img src="' + esc(s.cover_url) + '" alt="" decoding="async" onerror="this.remove()">' : "") +
    '</span><span class="meta"><span class="t">' + esc(s.title) + '</span><span class="s">' + esc(sub || "Anime") + '</span></span><span class="go">\u203a</span></a>';
}
var ssMoviesTried = false;
function drawSSNow() {
  var inp = document.getElementById("ssin"), box = document.getElementById("ssr");
  if (!inp || !box) return;
  if (!ssMoviesTried && !allMovies) {
    ssMoviesTried = true;
    loadMovies().then(drawSSNow, drawSSNow);
  }
  if (!allSeries) { box.innerHTML = '<div class="empty" style="padding:28px">Loading...</div>'; return; }
  var q = inp.value.trim().toLowerCase();
  var l = ssMerge(allSeries).filter(function (s) { return (s.title || "").toLowerCase().indexOf(q) !== -1; });
  box.innerHTML = (q ? "" : '<div class="ssl">All series &amp; movies</div>') + (l.length ? l.map(ssRow).join("") : '<div class="empty" style="padding:28px">No results.</div>');
}
function skeletons(n) {
  var h = '<div class="grid">';
  for (var i = 0; i < n; i++) h += '<div class="pc skel"></div>';
  return h + "</div>";
}
var allWeb = null, webCache = {}, webLast = null;
async function loadWeb() {
  if (allWeb) return allWeb;
  var r = await db.from("web_series").select("*").order("id", { ascending: false });
  if (r.error) throw r.error;
  allWeb = r.data || [];
  return allWeb;
}
function webPoster(w) {
  return '<a class="pc" href="#web-' + esc(w.id) + '">' +
    (w.cover_url ? '<img src="' + esc(w.cover_url) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">' : "") +
    (w.rating ? '<span class="rate glass">\u2605 ' + esc(w.rating) + "</span>" : "") +
    '<div class="pt glass"><span>' + esc(w.title) + "</span></div></a>";
}
async function homeView() {
  await homeView3();
  var ws;
  try { ws = await loadWeb(); } catch (e) { return; }
  if (!ws.length) return;
  if (location.hash && location.hash !== "#") return;
  var html = '<h2 class="h">Web Series</h2><div class="row">' + ws.slice(0, 10).map(webPoster).join("") + "</div>";
  var rows = app.querySelectorAll(".row");
  if (rows.length) rows[rows.length - 1].insertAdjacentHTML("afterend", html);
  else app.insertAdjacentHTML("beforeend", html);
  var hs = app.querySelectorAll("h2.h");
  for (var i = 0; i < hs.length; i++) if (hs[i].textContent.trim() === "Web Series") rowHead(hs[i], "#all-web");
}
async function webView(id) {
  setTab("home");
  app.innerHTML = '<div class="backdrop skel"></div>';
  var rs;
  try {
    rs = await Promise.all([
      db.from("web_series").select("*").eq("id", id).maybeSingle(),
      db.from("web_episodes").select("*").eq("series_id", id).order("episode_number")
    ]);
  } catch (e) { app.innerHTML = err(e); return; }
  var sr = rs[0], er = rs[1];
  if (sr.error || er.error) { app.innerHTML = err(sr.error || er.error); return; }
  var s = sr.data, eps = er.data || [];
  if (!s) { app.innerHTML = '<div class="empty">Web series not found.</div>'; return; }
  document.title = s.title + " \u00b7 AniFlix";
  var last = null;
  try { last = localStorage.getItem("aniflix-wlast-" + id); } catch (e) {}
  var lastIdx = -1;
  eps.forEach(function (x, i) { if (String(x.id) === last) lastIdx = i; });
  var text = s.description || "", long = text.length > 120;
  function num(x, k) { return x.episode_number != null ? x.episode_number : k + 1; }
  var rows = eps.map(function (x, k) {
    var n = num(x, k);
    return '<button class="er glass" data-i="' + k + '"><span class="num">' + esc(n) + '</span><span class="meta"><span class="t">' + esc(x.title || ("Episode " + n)) + '</span><span class="s">' + (k === lastIdx ? "Continue watching" : "Episode " + esc(n)) + '</span></span><span class="go">\u25b6</span></button>';
  }).join("");
  app.innerHTML =
    '<div class="backdrop">' + (s.cover_url ? '<img src="' + esc(s.cover_url) + '" alt="" decoding="async" onerror="this.remove()">' : "") + '<div class="shade"></div>' +
    '<a class="rb l glass" href="#" aria-label="Back">\u2039</a></div>' +
    '<div class="info"><h1>' + esc(s.title) + '</h1><div class="chips"><span class="chip">Web Series</span><span class="chip">' + eps.length + (eps.length === 1 ? " episode" : " episodes") + '</span>' + chips(s) + '</div>' +
    '<button class="btn primary" id="go">\u25b6 ' + (lastIdx > -1 ? "Continue Watching" : "Start Watching") + '</button>' +
    (text ? '<p class="desc' + (long ? " clamp" : "") + '" id="desc">' + esc(text) + '</p>' : "") +
    (long ? '<button class="more" id="more">More</button>' : "") +
    '<div class="eh"><h2 class="h">Episodes</h2></div><div class="el" id="el">' + (rows || '<div class="empty" style="padding:16px 0">No episodes yet.</div>') + '</div></div>';
  var more = document.getElementById("more");
  if (more) more.addEventListener("click", function () {
    var d = document.getElementById("desc");
    d.classList.toggle("clamp");
    more.textContent = d.classList.contains("clamp") ? "More" : "Less";
  });
  function openEp(k) { location.hash = "#webwatch-" + id + "-" + eps[k].id; }
  document.getElementById("go").addEventListener("click", function () { if (eps.length) openEp(lastIdx > -1 ? lastIdx : 0); });
  document.getElementById("el").addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest(".er") : null;
    if (b) openEp(Number(b.getAttribute("data-i")));
  });
}
async function webWatchView(sid, eid) {
  setTab("home");
  var same = !!(webLast && webLast.sid === sid);
  var cached = webCache[sid];
  if (!cached) {
    document.title = "Watching \u00b7 AniFlix";
    app.innerHTML = '<div class="wbar"><a class="wback glass" href="#web-' + sid + '" aria-label="Back">\u2039</a></div><div class="player skel"></div>';
    var rs;
    try {
      rs = await Promise.all([
        db.from("web_series").select("*").eq("id", sid).maybeSingle(),
        db.from("web_episodes").select("*").eq("series_id", sid).order("episode_number")
      ]);
    } catch (e) { app.innerHTML = err(e); return; }
    var sr = rs[0], er = rs[1];
    if (sr.error || er.error) { app.innerHTML = err(sr.error || er.error); return; }
    if (!sr.data) { app.innerHTML = '<div class="empty">Web series not found.</div>'; return; }
    cached = webCache[sid] = { s: sr.data, eps: er.data || [] };
  }
  var s = cached.s, eps = cached.eps, i = -1;
  eps.forEach(function (x, k) { if (Number(x.id) === eid) i = k; });
  if (i < 0) { app.innerHTML = '<div class="empty">Episode not found.</div>'; return; }
  var ep = eps[i], dir = 0;
  if (same && webLast.i !== i) dir = i > webLast.i ? 1 : -1;
  webLast = { sid: sid, i: i };
  try { localStorage.setItem("aniflix-wlast-" + sid, String(ep.id)); } catch (e) {}
  document.title = (s.title || "") + " \u00b7 AniFlix";
  function num(x, k) { return x.episode_number != null ? x.episode_number : k + 1; }
  function go(k) { location.replace("#webwatch-" + sid + "-" + eps[k].id); }
  var v = videoInfo(ep), player;
  if (!v) player = '<div class="empty">No video yet.</div>';
  else if (v.kind === "video" && window.initPlayers) player = '<div class="vp" data-src="' + esc(v.src) + '"></div>';
  else if (v.kind === "video") player = '<video controls playsinline preload="metadata" src="' + esc(v.src) + '"></video>';
  else player = '<iframe src="' + esc(v.src) + '" ' + (/abyss/i.test(v.src) ? 'sandbox="allow-scripts allow-same-origin allow-presentation allow-forms" ' : '') + 'allowfullscreen allow="autoplay; fullscreen"></iframe>';
  var rows = eps.map(function (x, k) {
    var n = num(x, k), active = k === i;
    return '<button class="er glass' + (active ? " active" : "") + '" data-i="' + k + '"><span class="num">' + esc(n) + '</span>' +
      '<span class="meta"><span class="t">' + esc(x.title || ("Episode " + n)) + '</span><span class="s">' + (active ? "Now playing" : "Episode " + esc(n)) + '</span></span>' +
      '<span class="go">' + (active ? "\u275a\u275a" : "\u25b6") + '</span></button>';
  }).join("");
  var sw = dir === 0 ? "" : (dir > 0 ? " swap-f" : " swap-b");
  app.innerHTML =
    '<div class="wbar"><a class="wback glass" href="#web-' + sid + '" aria-label="Back">\u2039</a><div class="wtitle' + sw + '"><span class="a" style="white-space:normal;overflow:visible;text-overflow:clip;line-height:1.25">' + esc(s.title) + '</span><span class="b">Episode ' + esc(num(ep, i)) + '</span></div></div>' +
    '<div class="player' + sw + ' swap-d1">' + player + '</div>' +
    '<div class="navrow wnav' + sw + ' swap-d2"><button class="navb glass" id="wprev"' + (i === 0 ? " disabled" : "") + '>\u2039 Prev</button>' +
    '<div class="mid"><span class="t">' + esc(ep.title || ("Episode " + num(ep, i))) + '</span></div>' +
    '<button class="navb glass" id="wnext"' + (i === eps.length - 1 ? " disabled" : "") + '>Next \u203a</button></div>' +
    '<h2 class="h">Episodes</h2><div class="el" id="wel">' + rows + '</div>';
  if (window.initPlayers) window.initPlayers(app);
  var vid = app.querySelector("video");
  if (vid) vid.addEventListener("ended", function () { if (i < eps.length - 1) go(i + 1); });
  document.getElementById("wprev").addEventListener("click", function () { if (i > 0) go(i - 1); });
  document.getElementById("wnext").addEventListener("click", function () { if (i < eps.length - 1) go(i + 1); });
  document.getElementById("wel").addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest(".er") : null;
    if (!b) return;
    var k = Number(b.getAttribute("data-i"));
    if (k !== i) go(k);
  });
}
async function webAllView() {
  setTab("home");
  document.title = "Web Series \u00b7 AniFlix";
  var head = '<div class="wbar"><a class="wback glass" href="#" aria-label="Back">\u2039</a><div class="wtitle"><span class="a">Web Series</span><span class="b" id="cnt">&nbsp;</span></div></div>';
  app.innerHTML = head + skeletons(8);
  var list;
  try { list = await loadWeb(); } catch (e) { app.innerHTML = head + err(e); return; }
  if (location.hash !== "#all-web") return;
  app.innerHTML = head + '<label class="sbar glass">' + IC.search + '<input id="allq" type="search" placeholder="Search web series..." autocomplete="off"></label><div id="allg"></div>';
  var cnt = document.getElementById("cnt"), box = document.getElementById("allg"), q = document.getElementById("allq");
  function draw() {
    var t = q.value.trim().toLowerCase();
    var l = list.filter(function (s) { return (s.title || "").toLowerCase().indexOf(t) !== -1; });
    cnt.textContent = l.length + (l.length === 1 ? " title" : " titles");
    box.innerHTML = l.length ? '<div class="grid" style="margin-top:14px">' + l.map(webPoster).join("") + "</div>" : '<div class="empty">No results.</div>';
  }
  q.addEventListener("input", draw);
  draw();
}
function routeWeb() {
  var h = location.hash, m = h.match(/^#web-(\d+)$/), w = h.match(/^#webwatch-(\d+)-(\d+)$/), al = h === "#all-web";
  if (!m && !w && !al) return false;
  document.body.classList.toggle("watching", !!w);
  if (!w) webLast = null;
  if (typeof lastWatch !== "undefined") lastWatch = null;
  app.scrollTop = 0;
  app.className = m ? "flush" : "wrap";
  void app.offsetWidth;
  app.className += m ? " enter-u" : " enter-r";
  var tabs = document.getElementById("tabs");
  if (tabs) tabs.style.setProperty("--i", "0");
  var fail = function (e) { app.innerHTML = err(e); };
  if (m) webView(Number(m[1])).catch(fail);
  else if (w) webWatchView(Number(w[1]), Number(w[2])).catch(fail);
  else webAllView().catch(fail);
  return true;
}
function poster(s) {
  var p = s._movie ? "movie" : (s._web ? "web" : "series");
  return '<a class="pc" href="#' + p + '-' + esc(s.id) + '">' +
    (s.cover_url ? '<img src="' + esc(s.cover_url) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">' : "") +
    (s.rating ? '<span class="rate glass">\u2605 ' + esc(s.rating) + "</span>" : "") +
    '<div class="pt glass"><span>' + esc(s.title) + "</span></div></a>";
}
function ssMerge(list) {
  var out = (list || []).slice();
  (allMovies || []).forEach(function (m) { var c = {}; for (var k in m) c[k] = m[k]; c._movie = true; out.push(c); });
  (allWeb || []).forEach(function (m) { var c = {}; for (var k in m) c[k] = m[k]; c._web = true; out.push(c); });
  return out;
}
function ssRow(s) {
  var tag = s._movie ? "Movie" : (s._web ? "Web Series" : "");
  var p = s._movie ? "movie" : (s._web ? "web" : "series");
  var sub = [tag, s.year, s.rating ? "\u2605 " + s.rating : "", s.genre].filter(Boolean).join(" \u00b7 ");
  var withImg = typeof ssImgs === "undefined" || ssImgs;
  return '<a class="rr" href="#' + p + '-' + esc(s.id) + '"><span class="th">' +
    (withImg && s.cover_url ? '<img src="' + esc(s.cover_url) + '" alt="" decoding="async" onerror="this.remove()">' : "") +
    '</span><span class="meta"><span class="t">' + esc(s.title) + '</span><span class="s">' + esc(sub || "Anime") + '</span></span><span class="go">\u203a</span></a>';
}
var ssExtraTried = false;
function drawSSNow() {
  var inp = document.getElementById("ssin"), box = document.getElementById("ssr");
  if (!inp || !box) return;
  if (!ssExtraTried) {
    ssExtraTried = true;
    Promise.all([loadMovies().catch(function () {}), loadWeb().catch(function () {})]).then(drawSSNow);
  }
  if (!allSeries) { box.innerHTML = '<div class="empty" style="padding:28px">Loading...</div>'; return; }
  var q = inp.value.trim().toLowerCase();
  var l = ssMerge(allSeries).filter(function (s) { return (s.title || "").toLowerCase().indexOf(q) !== -1; });
  box.innerHTML = (q ? "" : '<div class="ssl">All series, movies &amp; web series</div>') + (l.length ? l.map(ssRow).join("") : '<div class="empty" style="padding:28px">No results.</div>');
}
function inListK(k) { return getList().indexOf(k) !== -1; }
function toggleListK(k) {
  var l = getList(), i = l.indexOf(k);
  if (i === -1) l.push(k); else l.splice(i, 1);
  setList(l);
  return i === -1;
}
function addSave(key) {
  var bd = app.querySelector(".backdrop");
  if (!bd || document.getElementById("save2")) return;
  bd.insertAdjacentHTML("beforeend", '<button class="rb r glass' + (inListK(key) ? " on" : "") + '" id="save2" aria-label="My List">' + IC.bm + "</button>");
  document.getElementById("save2").addEventListener("click", function () { this.classList.toggle("on", toggleListK(key)); });
}
if (typeof movieView === "function") {
  var movieView0 = movieView;
  movieView = async function (id) {
    await movieView0(id);
    if (location.hash === "#movie-" + id) addSave("m:" + id);
  };
}
if (typeof webView === "function") {
  var webView0 = webView;
  webView = async function (id) {
    await webView0(id);
    if (location.hash === "#web-" + id) addSave("w:" + id);
  };
}
async function listView() {
  setTab("list");
  document.title = "My List \u00b7 AniFlix";
  var head = topBar("", true) + '<h2 class="h" style="margin-top:6px">My List</h2>';
  app.innerHTML = head + '<div class="empty">Loading...</div>';
  try {
    await Promise.all([loadSeries(), loadMovies().catch(function () {}), typeof loadWeb === "function" ? loadWeb().catch(function () {}) : null]);
  } catch (e) { app.innerHTML = head + err(e); return; }
  var ids = getList(), items = [];
  function tag(src, flag) { return (src || []).map(function (m) { var c = {}; for (var k in m) c[k] = m[k]; c[flag] = true; return c; }); }
  (allSeries || []).forEach(function (s) { if (ids.indexOf(Number(s.id)) !== -1) items.push(s); });
  tag(typeof allMovies !== "undefined" ? allMovies : [], "_movie").forEach(function (m) { if (ids.indexOf("m:" + m.id) !== -1) items.push(m); });
  tag(typeof allWeb !== "undefined" ? allWeb : [], "_web").forEach(function (m) { if (ids.indexOf("w:" + m.id) !== -1) items.push(m); });
  if (location.hash !== "#list") return;
  app.innerHTML = head + (items.length ? '<div class="grid">' + items.map(poster).join("") + "</div>" : '<div class="empty">Tap the bookmark on any title to save it here.</div>');
}
function rowHead(h, href) {
  if (!h || h.getAttribute("data-rh")) return;
  h.setAttribute("data-rh", "1");
  var row = h.nextElementSibling;
  if (!row || !row.classList.contains("row")) return;
  var MAX = 8;
  while (row.children.length > MAX) row.removeChild(row.lastChild);
  var a = document.createElement("a");
  a.className = "mt";
  a.href = href;
  a.setAttribute("aria-label", "View all");
  a.innerHTML = '<span class="mc"><svg class="i" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></span><span class="ml">View all</span>';
  row.appendChild(a);
}
function shuf(a) {
  var r = a.slice();
  for (var i = r.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = r[i]; r[i] = r[j]; r[j] = t;
  }
  return r;
}
async function loadSeries() {
  if (allSeries) return allSeries;
  var r = await db.from("series").select("*").order("id");
  if (r.error) throw r.error;
  allSeries = shuf(r.data || []);
  return allSeries;
}
async function loadMovies() {
  if (allMovies) return allMovies;
  var r = await db.from("movies").select("*").order("id", { ascending: false });
  if (r.error) throw r.error;
  allMovies = shuf(r.data || []);
  return allMovies;
}
async function loadWeb() {
  if (allWeb) return allWeb;
  var r = await db.from("web_series").select("*").order("id", { ascending: false });
  if (r.error) throw r.error;
  allWeb = shuf(r.data || []);
  return allWeb;
}
var ssSugg = null, ssSuggN = -1, ssLoadTried2 = false;
function ssPick(all) {
  if (!ssSugg || ssSuggN !== all.length) { ssSugg = shuf(all).slice(0, 8); ssSuggN = all.length; }
  return ssSugg;
}
function drawSSNow() {
  var inp = document.getElementById("ssin"), box = document.getElementById("ssr");
  if (!inp || !box) return;
  if (!ssLoadTried2) {
    ssLoadTried2 = true;
    Promise.all([typeof loadMovies === "function" ? loadMovies().catch(function () {}) : 0, typeof loadWeb === "function" ? loadWeb().catch(function () {}) : 0]).then(drawSSNow);
  }
  if (!allSeries) { box.innerHTML = '<div class="empty" style="padding:28px">Loading...</div>'; return; }
  var all = ssMerge(allSeries), q = inp.value.trim().toLowerCase(), l, head = "";
  if (!q) { l = ssPick(all); head = '<div class="ssl">Suggestions</div>'; }
  else {
    var m = all.filter(function (s) { return (s.title || "").toLowerCase().indexOf(q) !== -1; });
    l = m.slice(0, 15);
    if (m.length > 15) head = '<div class="ssl">Top 15 of ' + m.length + ' results</div>';
  }
  box.innerHTML = head + (l.length ? l.map(ssRow).join("") : '<div class="empty" style="padding:28px">No results.</div>');
}
async function searchView() {
  setTab("search");
  document.title = "Search \u00b7 AniFlix";
  app.innerHTML = topBar() + '<div class="empty">Loading...</div>';
  var list;
  try { list = await loadSeries(); } catch (e) { app.innerHTML = topBar() + err(e); return; }
  try {
    await Promise.all([typeof loadMovies === "function" ? loadMovies().catch(function () {}) : 0, typeof loadWeb === "function" ? loadWeb().catch(function () {}) : 0]);
  } catch (e) {}
  if (location.hash !== "#search") return;
  app.innerHTML = topBar() + '<label class="sbar glass">' + IC.search + '<input id="q" readonly type="search" placeholder="Search anime, movies, series..." autocomplete="off"></label><div id="res"></div>';
  var q = document.getElementById("q"), res = document.getElementById("res");
  var all = ssMerge(list), sugg = shuf(all).slice(0, 8);
  function draw() {
    var t = q.value.trim().toLowerCase();
    if (!t) { res.innerHTML = '<h2 class="h">Suggestions</h2><div class="grid">' + sugg.map(poster).join("") + "</div>"; return; }
    var m = all.filter(function (s) { return (s.title || "").toLowerCase().indexOf(t) !== -1; });
    var l = m.slice(0, 24);
    res.innerHTML = l.length
      ? '<h2 class="h">Results</h2><div class="grid">' + l.map(poster).join("") + "</div>" + (m.length > 24 ? '<div class="empty" style="padding:16px">Showing 24 of ' + m.length + ". Keep typing to narrow it down.</div>" : "")
      : '<div class="empty">No results.</div>';
  }
  q.addEventListener("input", draw);
  draw();
}
function rowHead(h, href) {
  if (!h || h.getAttribute("data-rh")) return;
  h.setAttribute("data-rh", "1");
  h.setAttribute("data-href", href);
  h.setAttribute("role", "link");
  h.tabIndex = 0;
  var row = h.nextElementSibling;
  if (!row || !row.classList.contains("row")) return;
  var MAX = 8;
  while (row.children.length > MAX) row.removeChild(row.lastChild);
  var a = document.createElement("a");
  a.className = "mt";
  a.href = href;
  a.setAttribute("aria-label", "View all");
  a.innerHTML = '<span class="mc"><svg class="i" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></span><span class="ml">View all</span>';
  row.appendChild(a);
}
document.addEventListener("click", function (e) {
  var t = e.target;
  if (!t || !t.closest) return;
  var h = t.closest("h2[data-href]");
  if (h) location.hash = h.getAttribute("data-href");
});
document.addEventListener("keydown", function (e) {
  if (e.key !== "Enter") return;
  var t = e.target;
  if (t && t.getAttribute && t.getAttribute("data-href")) location.hash = t.getAttribute("data-href");
});
var homeView4 = homeView;
var heroPick = null;
homeView = async function () {
  app.classList.add("herowait");
  try {
    await homeView4();
    if (location.hash && location.hash !== "#") return;
    var hero = app.querySelector("a.hero");
    if (!hero) return;
    var all = ssMerge(allSeries || []).filter(function (s) { return s.cover_url; });
    if (!all.length) return;
    var f = null;
    if (heroPick) {
      all.forEach(function (s) {
        if (String(s.id) === String(heroPick.id) && !!s._movie === !!heroPick._movie && !!s._web === !!heroPick._web) f = s;
      });
    }
    if (!f) { f = all[Math.floor(Math.random() * all.length)]; heroPick = f; }
    var p = f._movie ? "movie" : (f._web ? "web" : "series");
    var tag = f._movie ? "Movie" : (f._web ? "Web Series" : "Anime");
    hero.outerHTML = '<a class="hero" href="#' + p + "-" + esc(f.id) + '"><img src="' + esc(f.cover_url) + '" alt="" decoding="async" onerror="this.remove()"><div class="shade"></div><div class="hc"><div class="chips">' +
      (tag ? '<span class="chip">' + tag + "</span>" : "") + chips(f) + "</div><h1>" + esc(f.title) + "</h1><p>" + esc(f.description) +
      '</p><span class="btn primary">\u25b6 Watch now</span></div></a>';
  } finally {
    app.classList.remove("herowait");
  }
};
async function addSugg(kind, id, expect) {
  try {
    var list = await loadSeries();
    var tasks = [];
    if (typeof loadMovies === "function") tasks.push(loadMovies().catch(function () {}));
    if (typeof loadWeb === "function") tasks.push(loadWeb().catch(function () {}));
    await Promise.all(tasks);
    if (location.hash !== expect) return;
    var all = ssMerge(list).filter(function (s) {
      var k = s._movie ? "movie" : (s._web ? "web" : "series");
      return !(k === kind && String(s.id) === String(id));
    });
    var pick = shuf(all).slice(0, 8);
    if (!pick.length) return;
    var old = document.getElementById("sugg");
    if (old) old.remove();
    app.insertAdjacentHTML("beforeend", '<div id="sugg"><h2 class="h">You may also like</h2><div class="row">' + pick.map(poster).join("") + "</div></div>");
  } catch (e) {}
}
if (typeof watchView === "function") {
  var watchViewS = watchView;
  watchView = async function (sid, eid) {
    await watchViewS(sid, eid);
    addSugg("series", sid, "#watch-" + sid + "-" + eid);
  };
}
if (typeof playMovieView === "function") {
  var playMovieViewS = playMovieView;
  playMovieView = async function (id) {
    await playMovieViewS(id);
    addSugg("movie", id, "#playmovie-" + id);
  };
}
if (typeof webWatchView === "function") {
  var webWatchViewS = webWatchView;
  webWatchView = async function (sid, eid) {
    await webWatchViewS(sid, eid);
    addSugg("web", sid, "#webwatch-" + sid + "-" + eid);
  };
}
function routeTop() { if (routeAll()) return; if (routeWeb()) return; route(); }
window.addEventListener("hashchange", routeTop);
routeTop();
})();
