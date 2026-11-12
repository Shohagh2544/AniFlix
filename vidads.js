(function () {
  var C = window.VIDEO_ADS || {};
  var S = location.search;
  var TEST = /[?&]adtest\b/.test(S);
  var DEBUG = /[?&]addebug\b/.test(S);
  var SAMPLE = "https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/single_ad_samples&sz=640x480&cust_params=sample_ct%3Dlinear&ciu_szs=300x250%2C728x90&gdfp_req=1&output=vast&unviewed_position_start=1&env=vp&impl=s&correlator=";
  var TAG = /[?&]adtest=sample\b/.test(S) ? SAMPLE : (C.vast || (TEST ? SAMPLE : ""));
  if (!TAG) return;
  var app = document.getElementById("app");
  if (!app) return;

  var PRE_GAP = (C.prerollGapMin == null ? 10 : C.prerollGapMin) * 60000;
  var MID_GAP = (C.midrollGapMin == null ? 5 : C.midrollGapMin) * 60000;
  var MID_MIN = TEST ? 30 : (C.midrollMinVideoMin == null ? 20 : C.midrollMinVideoMin) * 60;
  var MID_CHANCE = TEST ? 1 : (C.midrollChance == null ? 0.7 : C.midrollChance);
  var SKIP = C.skipAfterSec == null ? 5 : C.skipAfterSec;
  var KEY = "aniflix-ad-last";

  var dbgBox = null;
  function dbg(msg) {
    if (!DEBUG) return;
    if (!dbgBox) {
      dbgBox = document.createElement("div");
      dbgBox.style.cssText = "position:fixed;left:8px;right:8px;top:8px;z-index:99999;background:rgba(0,0,0,.88);color:#9f9;font:11px/1.4 monospace;padding:8px;border-radius:10px;max-height:30vh;overflow:auto;white-space:pre-wrap";
      document.body.appendChild(dbgBox);
    }
    dbgBox.textContent += msg + "\n";
  }

  function last() { try { return Number(localStorage.getItem(KEY)) || 0; } catch (e) { return 0; } }
  function mark() { try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {} }
  function canPre() { return TEST || Date.now() - last() >= PRE_GAP; }
  function canMid() { return TEST || Date.now() - last() >= MID_GAP; }
  function rnd() { return String(Math.floor(100000000 + Math.random() * 900000000)); }
  function macros(u) {
    var now = String(Date.now()), r = rnd();
    return u.replace(/\[TIMESTAMP\]|%5BTIMESTAMP%5D/g, now)
      .replace(/\[CACHEBUSTING\]|%5BCACHEBUSTING%5D|\[CACHEBUSTER\]/g, r)
      .replace(/\[ERRORCODE\]/g, "900")
      .replace(/correlator=(&|$)/, "correlator=" + r + "$1");
  }
  function fire(list) {
    (list || []).forEach(function (u) { try { new Image().src = macros(u); } catch (e) {} });
  }

  // ---------- reading the VAST ad tag ----------
  function fetchText(url) {
    return fetch(macros(url)).then(function (r) {
      if (!r.ok) throw new Error("http " + r.status);
      return r.text();
    }).catch(function () {
      dbg("direct read of the ad tag was blocked, trying the Netlify helper");
      return fetch("/.netlify/functions/vast?u=" + encodeURIComponent(macros(url))).then(function (r) {
        if (!r.ok) throw new Error("helper " + r.status);
        return r.text();
      });
    });
  }
  function texts(el, sel) {
    var out = [];
    el.querySelectorAll(sel).forEach(function (n) {
      var t = (n.textContent || "").trim();
      if (t) out.push(t);
    });
    return out;
  }
  function secs(t) {
    var m = /^(\d+):(\d+):(\d+(?:\.\d+)?)$/.exec((t || "").trim());
    return m ? (+m[1]) * 3600 + (+m[2]) * 60 + Math.floor(+m[3]) : null;
  }
  function resolve(url, depth, imp, trk, clk) {
    if (depth > 5) return Promise.resolve(null);
    return fetchText(url).then(function (xml) {
      var doc = new DOMParser().parseFromString(xml, "text/xml");
      if (doc.querySelector("parsererror")) { dbg("ad tag answer is not valid XML"); return null; }
      var ad = doc.querySelector("Ad");
      if (!ad) { dbg("ad tag is empty: no ad offered right now"); return null; }
      var imps = imp.concat(texts(ad, "Impression"));
      var tr = {};
      Object.keys(trk).forEach(function (k) { tr[k] = trk[k].slice(); });
      ad.querySelectorAll("Tracking").forEach(function (e) {
        var ev = e.getAttribute("event"), u = (e.textContent || "").trim();
        if (ev && u) (tr[ev] = tr[ev] || []).push(u);
      });
      var clks = clk.concat(texts(ad, "ClickTracking"));
      var w = ad.querySelector("VASTAdTagURI");
      if (w) {
        var next = (w.textContent || "").trim();
        return next ? resolve(next, depth + 1, imps, tr, clks) : null;
      }
      var lin = ad.querySelector("Linear");
      if (!lin) return null;
      var dEl = lin.querySelector("Duration");
      var dur = secs(dEl && dEl.textContent) || 0;
      var so = lin.getAttribute("skipoffset") || "";
      var skip = null;
      if (so.indexOf("%") >= 0) {
        var pct = parseInt(so, 10);
        if (!isNaN(pct) && dur > 0) skip = Math.floor(dur * pct / 100);
      } else {
        skip = secs(so);
      }
      var best = null, bestScore = 1e9;
      lin.querySelectorAll("MediaFile").forEach(function (f) {
        var type = (f.getAttribute("type") || "").toLowerCase();
        var del = (f.getAttribute("delivery") || "").toLowerCase();
        if (type.indexOf("mp4") < 0) return;
        if (del && del !== "progressive") return;
        var width = parseInt(f.getAttribute("width"), 10) || 640;
        var score = Math.abs(width - 720);
        if (score < bestScore) { best = f; bestScore = score; }
      });
      var media = best && (best.textContent || "").trim();
      if (!media) { dbg("ad has no mp4 video file"); return null; }
      var cEl = lin.querySelector("ClickThrough");
      var click = cEl && (cEl.textContent || "").trim();
      return { media: media, dur: dur, skip: skip, click: click || null, imps: imps, tr: tr, clks: clks };
    });
  }
  function loadAd() {
    return Promise.race([
      resolve(TAG, 0, [], {}, []).catch(function (e) { dbg("could not read the ad tag: " + e.message); return null; }),
      new Promise(function (res) { setTimeout(function () { res(null); }, 5000); })
    ]).then(function (ad) { if (ad) dbg("ad found: " + ad.media); return ad; });
  }

  // ---------- showing the ad over the player ----------
  function el(tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html) d.innerHTML = html;
    return d;
  }
  function cover(p) {
    var d = el("div", "vadbox", '<div class="vadspin"></div>');
    p.appendChild(d);
    return d;
  }
  function playAd(p, ad, done) {
    var fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (fsEl && document.exitFullscreen) { try { document.exitFullscreen(); } catch (e) {} }
    var box = el("div", "vadbox");
    var v = el("video", "advid");
    v.setAttribute("playsinline", "");
    v.preload = "auto";
    v.src = ad.media;
    var tag = el("div", "vadtag", "Ad");
    var wait = el("div", "vadwait");
    var skipBtn = el("button", "vadskip", "Skip ad &rsaquo;");
    skipBtn.style.display = "none";
    var more = null;
    box.appendChild(v);
    box.appendChild(tag);
    box.appendChild(wait);
    box.appendChild(skipBtn);
    if (ad.click) {
      more = el("button", "vadmore", "Learn more");
      more.style.display = "none";
      box.appendChild(more);
    }
    p.appendChild(box);

    var started = false, finished = false, sent = {}, tick = 0, guard = 0;
    var skipAt = ad.skip != null ? ad.skip : SKIP;
    function once(ev) { if (!sent[ev]) { sent[ev] = 1; fire(ad.tr[ev]); } }
    function finish() {
      if (finished) return;
      finished = true;
      clearInterval(tick);
      clearTimeout(guard);
      try { v.pause(); } catch (e) {}
      if (box.parentNode) box.parentNode.removeChild(box);
      done();
    }
    v.addEventListener("playing", function () {
      if (started) return;
      started = true;
      dbg("ad started playing");
      mark();
      if (!sent.imp) { sent.imp = 1; fire(ad.imps); }
      once("creativeView");
      once("start");
      if (more) more.style.display = "";
    });
    v.addEventListener("ended", function () { once("complete"); finish(); });
    v.addEventListener("error", function () { dbg("ad video could not be played"); finish(); });
    skipBtn.addEventListener("click", function () { once("skip"); finish(); });
    if (more) {
      more.addEventListener("click", function () {
        fire(ad.clks);
        try { v.pause(); } catch (e) {}
        window.open(ad.click, "_blank", "noopener");
      });
    }
    tick = setInterval(function () {
      var d = v.duration, t = v.currentTime || 0;
      var total = ad.dur || (isFinite(d) ? Math.floor(d) : 0);
      tag.textContent = total ? "Ad \u00b7 " + Math.max(0, Math.ceil(total - t)) + "s" : "Ad";
      if (started && t >= skipAt) {
        skipBtn.style.display = "";
        wait.style.display = "none";
      } else if (started) {
        wait.textContent = "Skip in " + Math.max(0, Math.ceil(skipAt - t));
      }
      if (d > 0 && isFinite(d)) {
        var f = t / d;
        if (f >= 0.25) once("firstQuartile");
        if (f >= 0.5) once("midpoint");
        if (f >= 0.75) once("thirdQuartile");
      }
    }, 250);
    guard = setTimeout(function () { if (!started) { dbg("ad did not start in time, skipped"); finish(); } }, 8000);
    var pr = v.play();
    if (pr && pr.catch) {
      pr.catch(function () {
        v.muted = true;
        var again = v.play();
        if (again && again.catch) again.catch(function () {});
      });
    }
  }

  // ---------- when to show ads ----------
  function hold(p) {
    var frames = [];
    p.querySelectorAll("iframe").forEach(function (f) {
      frames.push({ f: f, src: f.src });
      f.src = "about:blank";
    });
    p.querySelectorAll("video:not(.advid)").forEach(function (v) { try { v.pause(); } catch (e) {} });
    return function () { frames.forEach(function (x) { x.f.src = x.src; }); };
  }

  function midroll(p) {
    var v = p.querySelector("video:not(.advid)");
    if (!v) return; // embedded players cannot be paused from outside
    var at = null, decided = false, fired = false;
    v.addEventListener("timeupdate", function () {
      if (!decided && v.duration > 0 && isFinite(v.duration)) {
        decided = true;
        if (v.duration >= MID_MIN && Math.random() < MID_CHANCE) at = v.duration * (0.3 + Math.random() * 0.4);
      }
      if (at != null && !fired && !v.paused && v.currentTime >= at) {
        fired = true;
        if (!canMid()) return;
        v.pause();
        loadAd().then(function (ad) {
          if (!ad) { v.play().catch(function () {}); return; }
          playAd(p, ad, function () { v.play().catch(function () {}); });
        });
      }
    });
  }

  var timer = 0;
  function check() {
    if (!/^#(watch|webwatch|playmovie)-\d+/.test(location.hash)) return;
    var p = app.querySelector(".player");
    if (!p || p.__ad || p.classList.contains("skel")) return;
    p.__ad = true;
    if (!canPre()) { dbg("no pre-roll: an ad was shown recently"); midroll(p); return; }
    dbg("asking for a pre-roll ad");
    var c = cover(p);
    loadAd().then(function (ad) {
      if (!ad) { c.parentNode && c.parentNode.removeChild(c); midroll(p); return; }
      var restore = hold(p);
      c.parentNode && c.parentNode.removeChild(c);
      playAd(p, ad, function () { restore(); midroll(p); });
    });
  }
  new MutationObserver(function () {
    clearTimeout(timer);
    timer = setTimeout(check, 120);
  }).observe(app, { childList: true, subtree: true });
  check();
})();
