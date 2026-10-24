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
  if (u && /\.(mp4|webm|m4v)(\?|$)/i.test(u)) return { kind: "video", src: u };
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

  var poster = s.cover_url ? '<img src="' + esc(s.cover_url) + '" alt="" onerror="this.remove()">' : "";
  app.innerHTML =
    '<a class="back" href="#">← Back</a>' +
    '<div class="hero"><div class="poster">' + poster + "</div><div>" +
    "<h2>" + esc(s.title) + "</h2><p>" + esc(s.description) + "</p>" +
    '<span class="badge">' + eps.length + (eps.length === 1 ? " episode" : " episodes") + "</span></div></div>" +
    '<div id="stage"></div>' +
    '<h3 class="section">Episodes</h3><div class="eps" id="eps">' +
    (eps.length
      ? eps.map(function (ep, i) {
          return '<button class="chip" data-i="' + i + '">Ep ' + esc(ep.episode_number != null ? ep.episode_number : i + 1) + "</button>";
        }).join("")
      : '<div class="empty" style="padding:16px 0">No episodes yet.</div>') +
    "</div>";

  var stage = document.getElementById("stage");
  var chips = document.querySelectorAll(".chip");

  function play(i) {
    var ep = eps[i];
    chips.forEach(function (c, k) { c.classList.toggle("active", k === i); });
    var v = videoInfo(ep);
    var player = !v
      ? '<div class="empty">No video yet.</div>'
      : v.kind === "video"
        ? '<video controls playsinline preload="metadata" src="' + esc(v.src) + '"></video>'
        : '<iframe src="' + esc(v.src) + '" allowfullscreen allow="autoplay; fullscreen"></iframe>';
    var fs = v && v.kind === "iframe"
      ? '<a class="fs" href="' + esc(v.src) + '" target="_blank" rel="noopener">Full screen ↗</a>' : "";
    stage.innerHTML = '<div class="player">' + player + "</div>" +
      '<div class="now"><span>' + esc(ep.title || ("Episode " + ep.episode_number)) + "</span>" + fs + "</div>";
    stage.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  chips.forEach(function (c) {
    c.addEventListener("click", function () { play(Number(c.getAttribute("data-i"))); });
  });
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
