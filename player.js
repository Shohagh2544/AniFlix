(function () {
  function fmt(t) {
    if (!isFinite(t)) return "0:00";
    var m = Math.floor(t / 60), s = Math.floor(t % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }
  window.initPlayers = function (root) {
    root.querySelectorAll(".vp").forEach(function (box) {
      var src = box.getAttribute("data-src");
      box.innerHTML =
        '<video playsinline preload="metadata"></video>' +
        '<button class="big" aria-label="Play">▶</button>' +
        '<div class="bar"><input class="seek" type="range" min="0" max="1000" value="0">' +
        '<div class="row"><button class="pp">▶</button><button class="b10">−10</button>' +
        '<button class="f10">+10</button><span class="time">0:00 / 0:00</span>' +
        '<button class="spd">1x</button><button class="full">⛶</button></div></div>';
      var v = box.querySelector("video"), seek = box.querySelector(".seek");
      var pp = box.querySelector(".pp"), time = box.querySelector(".time"), timer;

      if (/\.m3u8(\?|$)/i.test(src) && !v.canPlayType("application/vnd.apple.mpegurl") && window.Hls && Hls.isSupported()) {
        var h = new Hls(); h.loadSource(src); h.attachMedia(v);
      } else { v.src = src; }

      function showBar() {
        box.classList.add("show");
        clearTimeout(timer);
        timer = setTimeout(function () { box.classList.remove("show"); }, 3000);
      }
      function toggle() { if (v.paused) v.play(); else v.pause(); }

      v.addEventListener("play", function () { box.classList.add("playing"); pp.textContent = "❚❚"; showBar(); });
      v.addEventListener("pause", function () { box.classList.remove("playing"); pp.textContent = "▶"; });
      v.addEventListener("timeupdate", function () {
        if (v.duration) seek.value = (v.currentTime / v.duration) * 1000;
        time.textContent = fmt(v.currentTime) + " / " + fmt(v.duration);
      });
      v.addEventListener("loadedmetadata", function () { time.textContent = "0:00 / " + fmt(v.duration); });
      seek.addEventListener("input", function () { if (v.duration) v.currentTime = (seek.value / 1000) * v.duration; showBar(); });

      box.querySelector(".big").addEventListener("click", toggle);
      pp.addEventListener("click", toggle);
      box.querySelector(".b10").addEventListener("click", function () { v.currentTime = Math.max(0, v.currentTime - 10); showBar(); });
      box.querySelector(".f10").addEventListener("click", function () { v.currentTime = Math.min(v.duration || 0, v.currentTime + 10); showBar(); });
      var speeds = [1, 1.25, 1.5, 2, 0.75], si = 0, spd = box.querySelector(".spd");
      spd.addEventListener("click", function () { si = (si + 1) % speeds.length; v.playbackRate = speeds[si]; spd.textContent = speeds[si] + "x"; showBar(); });
      box.querySelector(".full").addEventListener("click", function () {
        if (document.fullscreenElement) document.exitFullscreen();
        else if (box.requestFullscreen) box.requestFullscreen();
        else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();
      });
      v.addEventListener("click", function () { if (box.classList.contains("show")) toggle(); else showBar(); });
    });
  };
})();
