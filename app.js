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
  return '<a class="pc" href="#series-' + esc(s.id) + '">' +
    (s.cover_url ? '<img src="' + esc(s.cover_url) + '" alt="" loading="lazy" onerror="this.remove()">' : "") +
    (s.rating ? '<span class="rate glass">★ ' + esc(s.rating) + "</span>" : "") +
    '<div class="pt glass">' + esc(s.title) + "</div></a>";
}
function topBar(title, withSearch) {
  return '<div class="topbar" id="topbar"><div class="logo">' + esc(title || "AniFlix") + '</div>' +
    (withSearch ? '<div class="tsearch glass"><button class="tsb" id="tsb" aria-label="Search">' + IC.search + '</button><input id="tsi" type="search" placeholder="Search anime..." autocomplete="off"><button class="tsx" id="tsx" aria-label="Close">&#10005;</button></div>' : "") + '</div>' +
    (withSearch ? '<div class="sres glass" id="sres"></div>' : "");
}

async function homeView() {
  setTab("home"); document.title = "AniFlix";
  app.innerHTML = topBar("", true) + '<div class="hero skel"></div>';
  var list;
  try { list = await loadSeries(); } catch (e) { app.innerHTML = topBar("", true) + err(e); return; }
  if (!list.length) { app.innerHTML = topBar("", true) + '<div class="empty">No series yet.</div>'; return; }
  var f = list.find(function (s) { return s.cover_url; }) || list[0];
  app.innerHTML = topBar("", true) +
    '<a class="hero" href="#series-' + esc(f.id) + '">' +
    (f.cover_url ? '<img src="' + esc(f.cover_url) + '" alt="" onerror="this.remove()">' : "") +
    '<div class="shade"></div><div class="hc"><div class="chips">' + chips(f) + "</div><h1>" + esc(f.title) + "</h1><p>" + esc(f.description) +
    '</p><span class="btn primary">▶ Watch now</span></div></a>' +
    '<h2 class="h">Recommended for You</h2><div class="row">' + list.map(poster).join("") + "</div>" +
    (list.length > 5 ? '<h2 class="h">Browse all</h2><div class="grid">' + list.map(poster).join("") + "</div>" : "");
}

async function searchView() {
  setTab("search"); document.title = "Search · AniFlix";
  app.innerHTML = topBar("Search") + '<div class="empty">Loading...</div>';
  var list;
  try { list = await loadSeries(); } catch (e) { app.innerHTML = topBar("Search") + err(e); return; }
  app.innerHTML = topBar("Search") + '<label class="sbar glass">' + IC.search +
    '<input id="q" type="search" placeholder="Search anime..." autocomplete="off"></label><div id="res"></div>';
  var q = document.getElementById("q"), res = document.getElementById("res");
  function draw() {
    var t = q.value.trim().toLowerCase();
    var l = list.filter(function (s) { return (s.title || "").toLowerCase().indexOf(t) !== -1; });
    res.innerHTML = l.length ? '<h2 class="h">' + (t ? "Results" : "All series") + '</h2><div class="grid">' + l.map(poster).join("") + "</div>" : '<div class="empty">No results.</div>';
  }
  q.addEventListener("input", draw);
  draw();
  q.focus();
}

async function listView() {
  setTab("list"); document.title = "My List · AniFlix";
  app.innerHTML = topBar("My List", true) + '<div class="empty">Loading...</div>';
  var list;
  try { list = await loadSeries(); } catch (e) { app.innerHTML = topBar("My List", true) + err(e); return; }
  var ids = getList();
  var l = list.filter(function (s) { return ids.indexOf(Number(s.id)) !== -1; });
  app.innerHTML = topBar("My List", true) + (l.length ? '<div class="grid">' + l.map(poster).join("") + "</div>" : '<div class="empty">Tap the bookmark on a series to save it here.</div>');
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
    '<div class="backdrop">' + (s.cover_url ? '<img src="' + esc(s.cover_url) + '" alt="" onerror="this.remove()">' : "") + '<div class="shade"></div>' +
    '<a class="rb l glass" href="#" aria-label="Back">‹</a>' +
    '<button class="rb r glass' + (inList(id) ? " on" : "") + '" id="save" aria-label="My List">' + IC.bm + "</button></div>" +
    '<div class="info"><h1>' + esc(s.title) + '</h1><div class="chips">' +
    '<span class="chip">' + eps.length + (eps.length === 1 ? " episode" : " episodes") + "</span>" + chips(s) + "</div>" +
    '<button class="btn primary" id="go">▶ ' + (lastIdx > -1 ? "Continue Watching" : "Start Watching") + "</button>" +
    (text ? '<p class="desc' + (long ? " clamp" : "") + '" id="desc">' + esc(text) + "</p>" : "") +
    (long ? '<button class="more" id="more">More</button>' : "") +
    '<div id="stage"></div><div id="nav"></div>' +
    '<div class="eh"><h2 class="h">Episodes</h2>' + (eps.length > 1 ? '<button class="sort glass" id="sort">Newest first</button>' : "") + "</div>" +
    '<div class="el" id="el"></div></div>';

  var stage = document.getElementById("stage"), nav = document.getElementById("nav");
  var listEl = document.getElementById("el"), sortBtn = document.getElementById("sort");
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
    else player = '<iframe src="' + esc(v.src) + '" allowfullscreen allow="autoplay; fullscreen"></iframe>';
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

  document.getElementById("go").addEventListener("click", function () { if (eps.length) play(lastIdx > -1 ? lastIdx : 0, true); });
  listEl.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest(".er") : null;
    if (b) play(Number(b.getAttribute("data-i")), true);
  });
  if (sortBtn) sortBtn.addEventListener("click", function () {
    newest = !newest;
    sortBtn.textContent = newest ? "Oldest first" : "Newest first";
    renderList();
  });
  renderList();
}

var lastTab = 0;
function route() {
  var h = location.hash, m = h.match(/^#series-(\d+)$/);
  var tab = h === "#search" ? 1 : h === "#list" ? 2 : 0;
  var cls = "enter-u";
  if (!m) { cls = tab > lastTab ? "enter-r" : (tab < lastTab ? "enter-l" : "enter-u"); lastTab = tab; }
  window.scrollTo(0, 0);
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
function resRow(s) {
  var sub = [s.year, s.rating ? "\u2605 " + s.rating : "", s.genre].filter(Boolean).join(" \u00b7 ");
  return '<a class="rr" href="#series-' + esc(s.id) + '"><span class="th">' +
    (s.cover_url ? '<img src="' + esc(s.cover_url) + '" alt="" onerror="this.remove()">' : "") +
    '</span><span class="meta"><span class="t">' + esc(s.title) + '</span><span class="s">' + esc(sub || "Anime") + '</span></span><span class="go">&rsaquo;</span></a>';
}
function drawTS() {
  var inp = document.getElementById("tsi"), pan = document.getElementById("sres");
  if (!inp || !pan || !allSeries) return;
  var q = inp.value.trim().toLowerCase();
  var l = allSeries.filter(function (s) { return (s.title || "").toLowerCase().indexOf(q) !== -1; }).slice(0, 12);
  pan.innerHTML = l.length ? l.map(resRow).join("") : '<div class="empty" style="padding:24px">No results.</div>';
}
async function openTS() {
  var bar = document.getElementById("topbar"), inp = document.getElementById("tsi"), pan = document.getElementById("sres");
  if (!bar || !inp || !pan) return;
  if (bar.classList.contains("open")) { inp.focus(); return; }
  window.scrollTo(0, 0);
  bar.classList.add("open");
  pan.classList.add("show");
  inp.focus();
  setTimeout(function () { inp.focus(); }, 280);
  try { await loadSeries(); } catch (e) {}
  drawTS();
}
function closeTS() {
  var bar = document.getElementById("topbar"), inp = document.getElementById("tsi"), pan = document.getElementById("sres");
  if (!bar || !inp || !pan) return;
  inp.value = "";
  inp.blur();
  bar.classList.remove("open");
  pan.classList.remove("show");
}
document.addEventListener("click", function (e) {
  var t = e.target;
  if (!t || !t.closest) return;
  if (t.closest("#tsx")) { closeTS(); return; }
  if (t.closest("#tsb")) { openTS(); return; }
  if (document.querySelector(".topbar.open") && !t.closest(".tsearch") && !t.closest(".sres")) closeTS();
});
document.addEventListener("input", function (e) { if (e.target && e.target.id === "tsi") drawTS(); });
document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeTS(); });
window.addEventListener("hashchange", route);
route();
})();
