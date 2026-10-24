const SUPABASE_URL = "https://wzltxdwrcmrfxxrwqxvm.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6bHR4ZHdyY21yZnh4cndxeHZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4MjczMTgsImV4cCI6MjEwODQwMzMxOH0.OefY2EBUDOkxNZX46QWczQy3Bw1p40WWR8igHfXgui0";

// series:   id, title, cover_url, description
// episodes: id, series_id, episode_number, title, dailymotion_id

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const app = document.getElementById("app");

function esc(t) {
  const d = document.createElement("div");
  d.textContent = t == null ? "" : t;
  return d.innerHTML;
}

async function showSeries() {
  app.innerHTML = "<p>Loading...</p>";
  const { data, error } = await db.from("series").select("*");
  if (error) { app.innerHTML = "<p>Error: " + esc(error.message) + "</p>"; return; }
  if (!data.length) { app.innerHTML = "<p>No series yet.</p>"; return; }
  app.innerHTML = '<div class="grid"></div>';
  const grid = app.querySelector(".grid");
  data.forEach(s => {
    const card = document.createElement("div");
    card.className = "card glass";
    card.innerHTML = '<img src="' + esc(s.cover_url) + '" alt=""><p>' + esc(s.title) + "</p>";
    card.onclick = () => showEpisodes(s);
    grid.appendChild(card);
  });
}

async function showEpisodes(s) {
  app.innerHTML = "<p>Loading...</p>";
  const { data, error } = await db.from("episodes").select("*")
    .eq("series_id", s.id).order("episode_number");
  if (error) { app.innerHTML = "<p>Error: " + esc(error.message) + "</p>"; return; }
  app.innerHTML = "";
  const back = document.createElement("button");
  back.textContent = "← Back";
  back.onclick = showSeries;
  app.appendChild(back);

  const info = document.createElement("div");
  info.className = "box glass";
  info.innerHTML = "<h2>" + esc(s.title) + "</h2><p>" + esc(s.description) + "</p>";
  app.appendChild(info);

  const player = document.createElement("div");
  app.appendChild(player);

  const list = document.createElement("div");
  app.appendChild(list);

  data.forEach(ep => {
    const b = document.createElement("button");
    b.textContent = "Ep " + ep.episode_number;
    b.onclick = () => {
      player.className = "player glass";
      player.innerHTML = '<iframe src="https://www.dailymotion.com/embed/video/' +
        encodeURIComponent(ep.dailymotion_id) + '" allowfullscreen allow="autoplay; fullscreen"></iframe>';
    };
    list.appendChild(b);
  });
  if (!data.length) list.textContent = "No episodes yet.";
}

showSeries();
