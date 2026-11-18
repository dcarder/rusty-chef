/* The Rusty Chef - site scripts. Data is stored only in the visitor's browser. */
(function () {
  "use strict";

  // ---------- storage (safe if blocked) ----------
  function load(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ---------- toast ----------
  var toastEl;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "toast"; document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add("show");
    clearTimeout(toastEl._t); toastEl._t = setTimeout(function () { toastEl.classList.remove("show"); }, 1800);
  }

  // ---------- cookie settings link (opens Google's consent message again) ----------
  document.querySelectorAll("[data-consent-settings]").forEach(function (link) {
    link.addEventListener("click", function (ev) {
      var fc = window.googlefc;
      if (fc && typeof fc.showRevocationMessage === "function") {
        ev.preventDefault();
        fc.callbackQueue = fc.callbackQueue || [];
        fc.callbackQueue.push(fc.showRevocationMessage);
      }
    });
  });

  // ---------- mobile menu ----------
  var toggle = document.querySelector(".menu-toggle"), nav = document.getElementById("site-nav");
  if (toggle && nav) toggle.addEventListener("click", function () {
    var open = nav.classList.toggle("open"); toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });

  // ---------- saved recipes ----------
  function getSaved() { return load("rc_saved", []); }
  function updateSavedCount() {
    var n = getSaved().length;
    document.querySelectorAll('.site-nav a[href="/saved.html"], .site-nav a[href$="saved.html"]').forEach(function (a) {
      var badge = a.querySelector(".nav-count");
      if (!badge) { badge = document.createElement("span"); badge.className = "nav-count"; a.appendChild(badge); }
      badge.textContent = n; badge.hidden = !n;
    });
  }
  updateSavedCount();
  function setSaveButton(btn, on) {
    btn.classList.toggle("saved", on);
    btn.innerHTML = on ? "&#9829; Saved" : "&#9825; Save";
  }
  document.querySelectorAll("[data-save]").forEach(function (btn) {
    var slug = btn.getAttribute("data-save");
    setSaveButton(btn, getSaved().indexOf(slug) !== -1);
    btn.addEventListener("click", function () {
      var s = getSaved(), i = s.indexOf(slug);
      if (i === -1) { s.push(slug); toast("Saved! Find it under Saved in the menu"); } else { s.splice(i, 1); toast("Removed from saved"); }
      save("rc_saved", s);
      document.querySelectorAll('[data-save="' + slug + '"]').forEach(function (b) { setSaveButton(b, i === -1); });
      updateSavedCount();
    });
  });

  // ---------- Walmart ordering ----------
  // Builds one Walmart add-to-cart link for items that have a Walmart item ID,
  // and Walmart search links for the rest. Tapping the link on a phone opens the Walmart app.
  function walmartPanel(panel, items) {
    var map = window.RC_WALMART || {}, cfg = window.RC_WALMART_CONFIG || {};
    var ids = {}, order = [], search = [], seen = {};
    items.forEach(function (it) {
      var w = it.k && map[it.k];
      if (w && /^\d+$/.test(String(w.id).trim())) {
        var id = String(w.id).trim();
        if (!ids[id]) { ids[id] = Math.max(1, parseInt(w.qty, 10) || 1); order.push(id); }
      } else {
        var term = (w && w.search) || it.t;
        if (!seen[term.toLowerCase()]) { seen[term.toLowerCase()] = 1; search.push(term); }
      }
    });
    var html = "";
    if (!items.length) {
      html = '<p class="muted">Nothing missing - you have everything for this one!</p>';
    }
    if (order.length) {
      var cart = "https://affil.walmart.com/cart/addToCart?items=" + order.map(function (id) { return id + "|" + ids[id]; }).join(",");
      if (cfg.affiliatePrefix) cart = cfg.affiliatePrefix + encodeURIComponent(cart);
      html += '<a class="btn btn-walmart" href="' + esc(cart) + '" target="_blank" rel="noopener sponsored">Open Walmart cart (' +
        order.length + " item" + (order.length > 1 ? "s" : "") + ") &rarr;</a>";
    }
    if (search.length) {
      html += "<p><strong>" + (order.length ? "Also find at Walmart:" : "Find at Walmart:") + "</strong></p><ul class=\"wm-search\">" +
        search.map(function (t) {
          return '<li><a href="https://www.walmart.com/search?q=' + encodeURIComponent(t) + '" target="_blank" rel="noopener sponsored">' +
            esc(t) + " &rarr;</a></li>";
        }).join("") + "</ul>";
    }
    if (items.length) html += '<p class="muted small">Opens the Walmart app or walmart.com. You review your cart and check out with Walmart; prices and availability are set by Walmart.</p>';
    panel.innerHTML = html;
    panel.hidden = false;
  }

  // Recipe pages: skip what the visitor ticked in the Pantry Tool
  document.querySelectorAll("[data-walmart-recipe]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var have = load("rc_pantry", []);
      var items = JSON.parse(btn.getAttribute("data-walmart-recipe")).filter(function (x) { return have.indexOf(x.k) === -1; });
      var panel = btn.closest(".recipe-card").querySelector(".walmart-panel");
      walmartPanel(panel, items);
      if (have.length) panel.insertAdjacentHTML("afterbegin", '<p class="muted small">Skipping items you ticked in the <a href="/pantry.html">Pantry Tool</a>.</p>');
      panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });


  // ---------- Share recipe ----------
  function shareInfo() {
    var c = document.querySelector('link[rel="canonical"]');
    var url = c ? c.href : location.href;
    var title = (document.querySelector("h1") || {}).textContent || document.title;
    var img = document.querySelector('meta[property="og:image"]');
    return { url: url, title: title.trim(), text: title.trim() + " - an easy pantry recipe from The Rusty Chef", img: img ? img.content : "" };
  }
  function sharePanel(panel) {
    var s = shareInfo(), u = encodeURIComponent(s.url), t = encodeURIComponent(s.text);
    var links = [
      ["Text message", "sms:?&body=" + encodeURIComponent(s.text + " " + s.url), "sms"],
      ["Facebook", "https://www.facebook.com/sharer/sharer.php?u=" + u, "fb"],
      ["Pinterest", "https://pinterest.com/pin/create/button/?url=" + u + "&description=" + t + (s.img ? "&media=" + encodeURIComponent(s.img) : ""), "pin"],
      ["X (Twitter)", "https://twitter.com/intent/tweet?url=" + u + "&text=" + t, "x"],
      ["WhatsApp", "https://wa.me/?text=" + encodeURIComponent(s.text + " " + s.url), "wa"],
      ["Email", "mailto:?subject=" + encodeURIComponent(s.title) + "&body=" + encodeURIComponent(s.text + "\n\n" + s.url), "mail"]
    ];
    panel.innerHTML = '<p class="share-title">Share this recipe</p><div class="share-links">' +
      links.map(function (l) {
        return '<a class="share-link share-' + l[2] + '" href="' + esc(l[1]) + '" target="_blank" rel="noopener">' + l[0] + "</a>";
      }).join("") +
      '<button type="button" class="share-link share-copy">Copy link</button></div>' +
      '<p class="muted small">Instagram doesn\'t allow sharing links from websites. Copy the link and paste it in your story or bio.</p>';
    panel.hidden = false;
    panel.querySelector(".share-copy").addEventListener("click", function () {
      var done = function () { toast("Link copied"); };
      if (navigator.clipboard) navigator.clipboard.writeText(s.url).then(done, function () { prompt("Copy this link:", s.url); });
      else prompt("Copy this link:", s.url);
    });
  }
  document.querySelectorAll("[data-share]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var s = shareInfo();
      var panel = btn.parentNode.querySelector(".share-panel") || btn.parentNode.parentNode.querySelector(".share-panel");
      if (navigator.share) {
        navigator.share({ title: s.title, text: s.text, url: s.url }).catch(function (err) {
          if (!err || err.name !== "AbortError") sharePanel(panel);
        });
      } else {
        if (panel.hidden) sharePanel(panel); else panel.hidden = true;
      }
    });
  });

  // ---------- recipe search (recipes index) ----------
  var search = document.getElementById("recipe-search");
  if (search) search.addEventListener("input", function () {
    var q = search.value.trim().toLowerCase();
    document.querySelectorAll(".cards .card").forEach(function (c) {
      c.style.display = !q || c.textContent.toLowerCase().indexOf(q) !== -1 ? "" : "none";
    });
    document.querySelectorAll("main section[id]").forEach(function (sec) {
      var any = Array.prototype.some.call(sec.querySelectorAll(".card"), function (c) { return c.style.display !== "none"; });
      sec.style.display = any ? "" : "none";
    });
  });


  // ---------- Cooking timers (recipe pages) ----------
  // Finds times in the steps ("8 to 10 minutes", "30 seconds") and adds a tap-to-start timer.
  var steps = document.querySelectorAll(".steps li");
  if (steps.length) {
    var TIME_RE = /(\d+)(\s*(?:½|1\/2))?(?:\s*(?:to|-|–)\s*(\d+))?\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)\b/gi;
    var unitSecs = function (u) { u = u.toLowerCase(); return u[0] === "s" ? 1 : u[0] === "h" ? 3600 : 60; };
    var short = function (u) { u = u.toLowerCase(); return u[0] === "s" ? "sec" : u[0] === "h" ? "hr" : "min"; };
    var found = 0;
    steps.forEach(function (li, i) {
      li.innerHTML = li.innerHTML.replace(TIME_RE, function (m, a, half, b, u) {
        var secs = Math.round((parseInt(a, 10) + (half ? 0.5 : 0)) * unitSecs(u));
        if (!secs || secs > 12 * 3600) return m;
        found++;
        var label = a + (half ? "½" : "") + (b ? "–" + b : "") + " " + short(u);
        return m + ' <button type="button" class="timer-chip" data-secs="' + secs + '" data-step="' + (i + 1) +
          '" data-label="' + label + '" aria-label="Start ' + label + ' timer for step ' + (i + 1) + '">&#9201; ' + label + "</button>";
      });
    });
    if (found) {
      var list = document.querySelector(".steps");
      list.insertAdjacentHTML("beforebegin", '<p class="timer-hint">&#9201; Tap a time to start a timer. Ranges start at the shorter time, so check for doneness.</p>');
      var dock = document.createElement("div");
      dock.className = "timer-dock"; dock.hidden = true; dock.setAttribute("aria-live", "polite");
      document.body.appendChild(dock);

      var timers = [], nextId = 1, audioCtx = null, wakeLock = null, tick = null;
      var fmt = function (s) {
        s = Math.max(0, Math.ceil(s)); var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
        return (h ? h + ":" + (m < 10 ? "0" : "") : "") + m + ":" + (sec < 10 ? "0" : "") + sec;
      };
      var remaining = function (t) { return t.paused ? t.left : (t.end - Date.now()) / 1000; };

      function beep() {
        try {
          audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
          [0, 0.3, 0.6].forEach(function (d) {
            var o = audioCtx.createOscillator(), g = audioCtx.createGain();
            o.type = "square"; o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
            var t0 = audioCtx.currentTime + d;
            g.gain.setValueAtTime(0.15, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.25);
            o.start(t0); o.stop(t0 + 0.26);
          });
        } catch (e) {}
        try { if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]); } catch (e) {}
      }
      function keepAwake(on) {
        try {
          if (on && !wakeLock && navigator.wakeLock) navigator.wakeLock.request("screen").then(function (l) { wakeLock = l; }, function () {});
          if (!on && wakeLock) { wakeLock.release(); wakeLock = null; }
        } catch (e) {}
      }
      function render() {
        dock.hidden = !timers.length;
        dock.innerHTML = timers.map(function (t) {
          var left = remaining(t), done = t.done;
          return '<div class="timer' + (done ? " done" : "") + (t.paused ? " paused" : "") + '">' +
            '<span class="timer-name">Step ' + t.step + "</span>" +
            '<span class="timer-time">' + (done ? "Done!" : fmt(left)) + "</span>" +
            (done ? '<button data-act="add" data-id="' + t.id + '" aria-label="Add one minute">+1 min</button>'
                  : '<button data-act="toggle" data-id="' + t.id + '">' + (t.paused ? "Resume" : "Pause") + "</button>") +
            '<button data-act="close" data-id="' + t.id + '" aria-label="' + (done ? "Dismiss" : "Cancel") + ' timer">&times;</button></div>';
        }).join("");
        document.querySelectorAll(".timer-chip").forEach(function (c) {
          var t = timers.filter(function (x) { return x.chip === c; })[0];
          c.classList.toggle("running", !!t && !t.done);
          c.innerHTML = "&#9201; " + (t && !t.done ? fmt(remaining(t)) : c.getAttribute("data-label"));
        });
      }
      function loop() {
        var ringing = false;
        timers.forEach(function (t) {
          if (!t.done && !t.paused && remaining(t) <= 0) {
            t.done = true; t.lastBeep = 0;
            toast("Step " + t.step + " timer is done!");
          }
          if (t.done && Date.now() - t.lastBeep > 4000) { t.lastBeep = Date.now(); beep(); }
          if (t.done) ringing = true;
        });
        document.title = ringing ? "⏰ Timer done! | The Rusty Chef" : document.title.replace(/^⏰ Timer done! \| /, "");
        render();
        var active = timers.some(function (t) { return !t.paused || t.done; });
        if (!timers.length) { clearInterval(tick); tick = null; keepAwake(false); }
        else if (active) keepAwake(true);
      }
      function start(chip) {
        var existing = timers.filter(function (x) { return x.chip === chip; })[0];
        if (existing && !existing.done) { dock.querySelector('[data-id="' + existing.id + '"]').focus(); return; }
        if (existing) timers.splice(timers.indexOf(existing), 1);
        var secs = +chip.getAttribute("data-secs");
        timers.push({ id: nextId++, chip: chip, step: chip.getAttribute("data-step"), end: Date.now() + secs * 1000, left: secs, paused: false, done: false });
        try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.resume) audioCtx.resume(); } catch (e) {}
        if (!tick) tick = setInterval(loop, 250);
        loop();
      }
      document.addEventListener("click", function (ev) {
        var chip = ev.target.closest && ev.target.closest(".timer-chip");
        if (chip) { start(chip); return; }
        var b = ev.target.closest && ev.target.closest(".timer-dock button");
        if (!b) return;
        var t = timers.filter(function (x) { return x.id === +b.getAttribute("data-id"); })[0];
        if (!t) return;
        var act = b.getAttribute("data-act");
        if (act === "toggle") {
          if (t.paused) { t.end = Date.now() + t.left * 1000; t.paused = false; } else { t.left = remaining(t); t.paused = true; }
        } else if (act === "add") {
          t.done = false; t.paused = false; t.end = Date.now() + 60000;
        } else if (act === "close") {
          timers.splice(timers.indexOf(t), 1);
        }
        loop();
      });
      document.addEventListener("visibilitychange", function () { if (!document.hidden && timers.length) { wakeLock = null; loop(); } });
      window.addEventListener("beforeunload", function (ev) {
        if (timers.some(function (t) { return !t.done; })) { ev.preventDefault(); ev.returnValue = ""; }
      });
    }
  }

  var RC = window.RC = {};

  // ---------- Pantry Tool ----------
  RC.initPantry = function () {
    var groupsEl = document.getElementById("pantry-groups"), resultsEl = document.getElementById("pantry-results");
    var have = load("rc_pantry", []), groups = {}, order = [];
    window.RC_PANTRY.forEach(function (p) { if (!groups[p.g]) { groups[p.g] = []; order.push(p.g); } groups[p.g].push(p); });
    var labels = {}; window.RC_PANTRY.forEach(function (p) { labels[p.k] = p.l; });

    groupsEl.innerHTML = order.map(function (g) {
      return '<div class="pantry-group"><h3>' + esc(g) + "</h3>" + groups[g].map(function (p) {
        return '<label data-label="' + esc(p.l.toLowerCase()) + '"><input type="checkbox" value="' + esc(p.k) + '"' +
          (have.indexOf(p.k) !== -1 ? " checked" : "") + "> " + esc(p.l) + "</label>";
      }).join("") + "</div>";
    }).join("");

    // quick filters
    var chipsEl = document.getElementById("pantry-filters"), filters = load("rc_pantry_filters", []);
    try { localStorage.removeItem("rc_pantry_useup"); } catch (e) {}
    var FILTERS = {
      quick: function (r) { return r.m <= 20; },
      veg: function (r) { return r.v; },
      kids: function (r) { return r.kf; },
      cheap: function (r) { return r.p <= 1; }
    };
    if (chipsEl) {
      chipsEl.querySelectorAll("[data-filter]").forEach(function (b) {
        var f = b.getAttribute("data-filter");
        b.setAttribute("aria-pressed", filters.indexOf(f) !== -1 ? "true" : "false");
        b.addEventListener("click", function () {
          var i = filters.indexOf(f);
          if (i === -1) filters.push(f); else filters.splice(i, 1);
          b.setAttribute("aria-pressed", i === -1 ? "true" : "false");
          save("rc_pantry_filters", filters); render();
        });
      });
    }

    function render() {
      if (!have.length) { resultsEl.innerHTML = '<p class="muted">Select a few ingredients to see matches.</p>'; return; }
      var pool = window.RC_RECIPES.filter(function (r) {
        for (var i = 0; i < filters.length; i++) if (FILTERS[filters[i]] && !FILTERS[filters[i]](r)) return false;
        return true;
      });
      var mine = have;
      var scored = pool.map(function (r) {
        var req = r.i.filter(function (x) { return !x.o; });
        var keys = []; req.forEach(function (x) { if (keys.indexOf(x.k) === -1) keys.push(x.k); });
        var got = keys.filter(function (k) { return mine.indexOf(k) !== -1; });
        var miss = req.filter(function (x) { return mine.indexOf(x.k) === -1; });
        return { r: r, pct: keys.length ? got.length / keys.length : 0, miss: miss };
      }).filter(function (s) { return s.pct > 0; })
        .sort(function (a, b) { return b.pct - a.pct || a.miss.length - b.miss.length; }).slice(0, 20);

      if (!scored.length) {
        resultsEl.innerHTML = '<p class="muted">' + (filters.length ? "No recipes match those filters. Try turning one off." :
          "No matches yet. Try adding a few more staples.") + "</p>";
        return;
      }
      resultsEl.innerHTML = scored.map(function (s, idx) {
        var pct = Math.round(s.pct * 100);
        var missTxt = s.miss.length
          ? '<p class="missing">Missing: ' + s.miss.map(function (x) { return esc(labels[x.k] || x.k); })
              .filter(function (v, i, a) { return a.indexOf(v) === i; }).join(", ") +
            '</p>' +
            '<p><button class="btn btn-walmart btn-sm" data-wm-missing="' + idx + '">&#128722; Order missing at Walmart</button></p>' +
            '<div class="walmart-panel" hidden></div>'
          : '<p class="missing ready">You have everything you need!</p>';
        return '<div class="result"><h3><a href="/recipes/' + esc(s.r.s) + '.html">' + esc(s.r.t) + "</a></h3>" +
          '<p class="meta">' + esc(s.r.c) + " &middot; " + s.r.m + " min" + (s.r.p ? " &middot; about $" + s.r.p.toFixed(2) + "/serving" : "") +
            " &middot; " + pct + "% match</p>" +
          '<div class="bar"><span style="width:' + pct + '%"></span></div>' + missTxt + "</div>";
      }).join("");
      resultsEl.querySelectorAll("[data-wm-missing]").forEach(function (b) {
        b.addEventListener("click", function () {
          var s = scored[+b.getAttribute("data-wm-missing")];
          walmartPanel(b.closest(".result").querySelector(".walmart-panel"), s.miss.map(function (x) { return { t: x.t, k: x.k }; }));
        });
      });
    }

    groupsEl.addEventListener("change", function (ev) {
      var k = ev.target.value, i = have.indexOf(k);
      if (ev.target.checked && i === -1) have.push(k);
      if (!ev.target.checked && i !== -1) have.splice(i, 1);
      save("rc_pantry", have); render();
    });
    document.getElementById("pantry-filter").addEventListener("input", function (ev) {
      var q = ev.target.value.trim().toLowerCase();
      groupsEl.querySelectorAll("label").forEach(function (l) {
        l.style.display = !q || l.getAttribute("data-label").indexOf(q) !== -1 ? "" : "none";
      });
    });
    document.getElementById("pantry-clear").addEventListener("click", function () {
      have = []; save("rc_pantry", have);
      groupsEl.querySelectorAll("input").forEach(function (c) { c.checked = false; }); render();
    });
    render();
  };

  // ---------- Saved page ----------
  RC.initSaved = function () {
    var el = document.getElementById("saved-list"), s = getSaved();
    var list = window.RC_RECIPES.filter(function (r) { return s.indexOf(r.s) !== -1; });
    if (!list.length) {
      el.innerHTML = '<p class="muted">You haven\'t saved any recipes yet. Tap <strong>&#9825; Save</strong> on any recipe to keep it here.</p>' +
        '<p><a class="btn" href="/recipes/">Browse recipes</a></p>';
      return;
    }
    el.innerHTML = '<ul class="cards">' + list.map(function (r) {
      return '<li class="card"><a href="/recipes/' + esc(r.s) + '.html">' +
        (r.ph ? '<img class="card-photo" src="https://images.unsplash.com/' + esc(r.ph) + '?auto=format&amp;fit=crop&amp;w=400&amp;h=300&amp;q=70" alt="" width="400" height="300" loading="lazy">' : "") +
        '<span class="tag">' + esc(r.c) + "</span><h3>" + esc(r.t) +
        "</h3><p>" + esc(r.d) + '</p><span class="meta">' + r.m + " min</span></a></li>";
    }).join("") + "</ul>";
  };

})();
