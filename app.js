const SUPABASE_URL = "https://wzltxdwrcmrfxxrwqxvm.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6bHR4ZHdyY21yZnh4cndxeHZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4MjczMTgsImV4cCI6MjEwODQwMzMxOH0.OefY2EBUDOkxNZX46QWczQy3Bw1p40WWR8igHfXgui0";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const app = document.getElementById("app");
const search = document.getElementById("search");
let allSeries = null;

function esc(t) {
  return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function skeletons(n) {
  var h = '<div class="grid">';
  for (var i = 0; i < n; i++) h += '<div class="card skeleton"></div>';
  return h + "</div>";
}

function cardHTML(s) {
  return '<a class="card" href="#series-' + esc(s.id) + '">' +
    (s.cover_url ? '<img src="' + esc(s.cover_url) + '" alt="" loading="lazy" onerror="this.remove()">' : "") +
    '<div class="info">' + esc(s.title) + "</div></a>";
}

async function showHome() {
  document.title = "AniFlix";
  if (!allSeries) {
    app.innerHTML = skeletons(6);
    var res = await db.from("series").select("*").order("id");
    if (res.error) {
      app.innerHTML = '<div class="empty">Could not load: ' + esc(res.error.message) + "</div>";
      return;
    }
    allSeries = res.data || [];
  }
  var q = search.value.trim().toLowerCase();
  var list = allSeries.filter(function (s) { return (s.title || "").toLowerCase().indexOf(q) !== -1; });
  if (!list.length) {
    app.innerHTML = '<div class="empty">' + (allSeries.length ? "No results." : "No series yet.") + "</div>";
    return;
  }
  app.innerHTML = '<h2 class="section">' + (q ? "Results" : "All series") + '</h2><div class="grid">' +
    list.map(cardHTML).join("") + "</div>";
}

function videoInfo(ep) {
  var u = ep.video_url;
  if (u && /\.(mp4|webm|m4v|m3u8)(\?|$)/i.test(u)) return { kind: "video", src: u };
  var src = u || (ep.dailymotion_id ? "https://www.dailymotion.com/embed/video/" + encodeURIComponent(ep.dailymotion_id) : "");
  return src ? { kind: "iframe", src: src } : null;
}

async function showSeries(id) {
  app.innerHTML = '<div class="hero skeleton" style="height:160px"></div>';
  var results = await Promise.all([
    db.from("series").select("*").eq("id", id).maybeSingle(),
    db.from("episodes").select("*").eq("series_id", id).order("episode_number")
  ]);
  var sr = results[0], er = results[1];
  if (sr.error || er.error) {
    app.innerHTML = '<div class="empty">Could not load: ' + esc((sr.error || er.error).message) + "</div>";
    return;
  }
  var s = sr.data;
  var eps = er.data || [];
  if (!s) { app.innerHTML = '<div class="empty">Series not found.</div>'; return; }
  document.title = s.title + " · AniFlix";

  var last = null;
  try { last = localStorage.getItem("aniflix-last-" + id); } catch (e) {}

  var poster = s.cover_url ? '<img src="' + esc(s.cover_url) + '" alt="" onerror="this.remove()">' : "";
  app.innerHTML =
    '<a class="back" href="#">← Back</a>' +
    '<div class="hero"><div class="poster">' + poster + "</div><div>" +
    "<h2>" + esc(s.title) + "</h2><p>" + esc(s.description) + "</p>" +
    '<span class="badge">' + eps.length + (eps.length === 1 ? " episode" : " episodes") + "</span></div></div>" +
    '<div id="stage"></div><div id="nav"></div>' +
    '<div class="eps-head"><h3 class="section">Episodes</h3>' +
    (eps.length > 1 ? '<button class="sort" id="sort">Newest first</button>' : "") + "</div>" +
    '<div class="ep-list" id="eplist"></div>';

  var stage = document.getElementById("stage");
  var nav = document.getElementById("nav");
  var list = document.getElementById("eplist");
  var sortBtn = document.getElementById("sort");
  var cur = -1;
  var desc = false;

  function epNum(ep, i) { return ep.episode_number != null ? ep.episode_number : i + 1; }

  function renderList() {
    if (!eps.length) { list.innerHTML = '<div class="empty" style="padding:16px 0">No episodes yet.</div>'; return; }
    var idx = eps.map(function (x, i) { return i; });
    if (desc) idx.reverse();
    list.innerHTML = idx.map(function (i) {
      var ep = eps[i];
      var n = epNum(ep, i);
      var active = i === cur;
      var sub = active ? "Now playing" : (last !== null && String(ep.id) === last ? "Continue watching" : "Episode " + n);
      return '<button class="ep' + (active ? " active" : "") + '" data-i="' + i + '">' +
        '<span class="num">' + esc(n) + "</span>" +
        '<span class="meta"><span class="t">' + esc(ep.title || ("Episode " + n)) + '</span><span class="s">' + esc(sub) + "</span></span>" +
        '<span class="go">' + (active ? "❚❚" : "▶") + "</span></button>";
    }).join("");
  }

  function play(i, scroll) {
    cur = i;
    var ep = eps[i];
    try { localStorage.setItem("aniflix-last-" + id, String(ep.id)); } catch (e) {}
    var v = videoInfo(ep);
    var player;
    if (!v) player = '<div class="empty">No video yet.</div>';
    else if (v.kind === "video" && window.initPlayers) player = '<div class="vp" data-src="' + esc(v.src) + '"></div>';
    else if (v.kind === "video") player = '<video controls playsinline preload="metadata" src="' + esc(v.src) + '"></video>';
    else player = '<iframe src="' + esc(v.src) + '" allowfullscreen allow="autoplay; fullscreen"></iframe>';
    stage.innerHTML = '<div class="player">' + player + "</div>";
    if (window.initPlayers) initPlayers(stage);

    var fs = v && v.kind === "iframe" ? '<a href="' + esc(v.src) + '" target="_blank" rel="noopener">Full screen ↗</a>' : "";
    nav.innerHTML = '<div class="navrow">' +
      '<button class="navb" id="prev"' + (i === 0 ? " disabled" : "") + '>← Prev</button>' +
      '<div class="mid"><span class="t">' + esc(ep.title || ("Episode " + epNum(ep, i))) + "</span>" + fs + "</div>" +
      '<button class="navb" id="next"' + (i === eps.length - 1 ? " disabled" : "") + '>Next →</button></div>';
    document.getElementById("prev").addEventListener("click", function () { if (cur > 0) play(cur - 1, true); });
    document.getElementById("next").addEventListener("click", function () { if (cur < eps.length - 1) play(cur + 1, true); });

    var vid = stage.querySelector("video");
    if (vid) vid.addEventListener("ended", function () { if (cur < eps.length - 1) play(cur + 1, false); });

    renderList();
    if (scroll) stage.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  list.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest(".ep") : null;
    if (b) play(Number(b.getAttribute("data-i")), true);
  });
  if (sortBtn) sortBtn.addEventListener("click", function () {
    desc = !desc;
    sortBtn.textContent = desc ? "Oldest first" : "Newest first";
    renderList();
  });

  renderList();
}

function route() {
  var m = location.hash.match(/^#series-(\d+)$/);
  if (m) showSeries(Number(m[1]));
  else showHome();
}

search.addEventListener("input", function () {
  if (location.hash.length > 1) location.hash = "";
  else showHome();
});
window.addEventListener("hashchange", route);
route();
