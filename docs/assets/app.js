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

  // ---------- Cost per serving (same estimates as recipes-data.js; recipe pages use their own "Est. cost") ----------
  var RC_COST = {
    "baked-oatmeal": 0.39, "baked-ravioli": 2.12, "banana-oat-pancakes": 0.55, "bean-quesadillas": 1.51,
    "beef-enchilada-skillet": 3.02, "black-bean-burgers": 0.95, "black-bean-rice-bowls": 1.18, "black-bean-soup": 1.10,
    "black-bean-tacos": 0.82, "breakfast-burritos": 1.40, "breakfast-egg-sandwich": 1.46, "breakfast-fried-rice": 1.50,
    "cabbage-stir-fry": 0.41, "canned-tomato-soup": 1.05, "cheese-omelette": 1.30, "cheesy-baked-pasta": 1.53,
    "chicken-salad-sandwich": 1.23, "chicken-stir-fry-noodles": 1.73, "chicken-tacos": 1.69, "chickpea-curry": 1.34,
    "chickpea-salad-sandwich": 0.94, "chocolate-mug-cake": 0.51, "coconut-rice": 0.56,
    "coffee-shop-banana-bread": 0.24, "congee": 1.12, "creamy-mashed-potatoes": 0.60, "crispy-chicken-sandwich": 2.65,
    "crispy-fried-eggs": 0.75, "crispy-smashed-potatoes": 0.60, "diner-smash-burgers": 2.27, "drop-biscuits": 0.24,
    "easy-ramen-noodles": 0.85, "easy-weeknight-lasagna": 1.69, "egg-drop-soup": 1.55, "egg-muffin-cups": 1.28,
    "egg-salad-sandwich": 1.04, "fast-food-chicken-nuggets": 1.88, "french-onion-soup": 1.70, "french-toast": 0.77,
    "fried-ravioli": 1.96, "garlic-bread": 0.68, "garlic-butter-noodles": 1.12, "ground-beef-tacos": 2.05,
    "ham-and-cheese-quiche": 1.03, "ham-and-cheese-strata": 1.74, "ham-cheese-pinwheels": 1.64,
    "ham-cheese-sliders": 1.60, "homemade-hummus": 0.33, "honey-bbq-wings": 4.00, "honey-garlic-chicken": 1.79,
    "huevos-rancheros": 2.17, "italian-pasta-salad": 0.36, "lentil-sloppy-joes": 1.06, "lentil-soup": 1.14,
    "loaded-baked-potatoes": 1.20, "mediterranean-chickpea-salad": 1.00, "one-pot-mac-and-cheese": 0.97,
    "overnight-oats": 0.35, "pantry-chili": 1.03, "pantry-fried-rice": 0.95, "pantry-frittata": 1.10,
    "pantry-minestrone": 1.42, "pantry-pancakes": 0.36, "pasta-aglio-e-olio": 1.18, "pasta-e-fagioli": 1.55,
    "pasta-puttanesca": 1.74, "peanut-butter-banana-oatmeal": 0.57, "peanut-butter-cookies": 0.16,
    "peanut-butter-noodles": 0.71, "perfect-grilled-cheese": 0.95, "pizza-toast": 1.15, "pizzeria-garlic-knots": 0.37,
    "pizzeria-pepperoni-pizza": 1.94, "potato-hash": 1.12, "potato-soup": 1.39, "red-lentil-coconut-dal": 1.21,
    "restaurant-style-salsa": 0.37, "restaurant-white-queso": 1.51, "rice-and-beans": 0.56, "rice-pudding": 0.26,
    "roasted-chickpeas": 0.31, "sausage-egg-breakfast-plate": 2.40, "shakshuka": 1.53,
    "sheet-pan-chicken-fajitas": 2.10, "shepherds-pie": 1.90, "skillet-cornbread": 0.23, "skillet-flatbread": 0.33,
    "smokestack-flatbread": 2.92, "spaghetti-marinara": 1.12, "spanish-rice": 0.61, "spinach-pesto-pasta": 1.10,
    "sweet-potato-black-bean-hash": 1.43, "takeout-lo-mein": 0.78, "takeout-orange-chicken": 1.70,
    "teriyaki-chicken-rice-bowls": 1.65, "tuna-melt": 1.43, "tuna-pasta": 1.68, "veggie-fried-noodles": 1.02,
    "white-bean-garlic-soup": 1.52, "white-bean-tuna-salad": 1.57, "zuppa-toscana": 2.12
  };
  window.RC_COST = RC_COST;
  function money(n) { return n < 1 ? Math.round(n * 100) + "¢" : "$" + n.toFixed(2); }
  function slugFromHref(h) { var m = /([a-z0-9-]+)\.html(?:[#?].*)?$/.exec(h || ""); return m ? m[1] : ""; }

  // Recipe cards anywhere on the site: add "~$x a serving" to the meta line
  document.querySelectorAll(".card a").forEach(function (a) {
    var c = RC_COST[slugFromHref(a.getAttribute("href"))], meta = a.querySelector(".meta");
    if (c && meta && !meta.querySelector(".cost-chip")) meta.insertAdjacentHTML("beforeend", ' &middot; <span class="cost-chip">~' + money(c) + "/serving</span>");
  });

  // ---------- Servings scaler + cost (recipe pages) ----------
  var card = document.querySelector(".recipe-card");
  var ingList = card && card.querySelector(".ingredients");
  var pageSlug = slugFromHref((document.querySelector('link[rel="canonical"]') || {}).href || location.pathname);
  var baseServes = 0, curServes = 0;
  if (card) card.querySelectorAll(".recipe-facts li").forEach(function (li) {
    var st = li.querySelector("strong");
    if (st && /serves/i.test(st.textContent)) { baseServes = parseInt(li.textContent.replace(st.textContent, ""), 10) || 0; li.classList.add("fact-serves"); }
  });
  curServes = baseServes;

  var FRACS = [[0, ""], [0.125, "⅛"], [0.25, "¼"], [1 / 3, "⅓"], [0.5, "½"], [2 / 3, "⅔"], [0.75, "¾"], [1, ""]];
  function parseQty(s) {
    s = s.trim().replace(/½/g, " 1/2").replace(/¼/g, " 1/4").replace(/¾/g, " 3/4").replace(/⅓/g, " 1/3").replace(/⅔/g, " 2/3").trim();
    return s.split(/\s+/).reduce(function (t, p) { var f = p.split("/"); return t + (f.length === 2 ? (+f[0] / +f[1]) : +p); }, 0);
  }
  function fmtQty(n) {
    if (n >= 10) return String(Math.round(n));
    var whole = Math.floor(n), rest = n - whole, best = FRACS[0];
    FRACS.forEach(function (f) { if (Math.abs(rest - f[0]) < Math.abs(rest - best[0])) best = f; });
    if (best[0] === 1) { whole += 1; best = FRACS[0]; }
    if (!whole && !best[1]) return "⅛";
    return (whole ? String(whole) : "") + best[1];
  }
  var NOUNS = { cup: "cups", can: "cans", clove: "cloves", egg: "eggs", onion: "onions", slice: "slices", potato: "potatoes",
    tortilla: "tortillas", banana: "bananas", lime: "limes", lemon: "lemons", carrot: "carrots", bun: "buns", stalk: "stalks",
    packet: "packets", head: "heads", bag: "bags", loaf: "loaves", handful: "handfuls", jalapeño: "jalapeños", pepper: "peppers",
    muffin: "muffins", roll: "rolls", breast: "breasts", knot: "knots",
    tablespoon: "tablespoons", teaspoon: "teaspoons", lb: "lbs" };
  var SING = {}; Object.keys(NOUNS).forEach(function (k) { SING[NOUNS[k]] = k; });
  function fixNoun(after, n) {
    // find the first countable noun in the next few words and match it to the new amount
    var re = /(\s+)(\([^)]*\)|[A-Za-zñé-]+)/g, m, pos = 0, seen = 0;
    while (seen < 4) {
      re.lastIndex = pos; m = re.exec(after);
      if (!m || m.index !== pos) break;
      pos = re.lastIndex; seen++;
      var w = m[2], lw = w.toLowerCase(), rep = n > 1 ? NOUNS[lw] : SING[lw];
      if (NOUNS[lw] || SING[lw]) {
        if (!rep) return after;
        var at = m.index + m[1].length;
        return after.slice(0, at) + rep + after.slice(at + w.length);
      }
    }
    return after;
  }
  var QTY_RE = /(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?|[½¼¾⅓⅔])(\s*(?:to|-|–)\s*(\d+\/\d+|\d+(?:\.\d+)?))?/g;
  function scaleText(text, f, depth) {
    // scales every amount outside parentheses; returns [newText, newDepth]
    var out = "", i = 0;
    while (i < text.length) {
      var ch = text[i];
      if (ch === "(") { depth++; out += ch; i++; continue; }
      if (ch === ")") { depth = Math.max(0, depth - 1); out += ch; i++; continue; }
      if (depth > 0) { out += ch; i++; continue; }
      QTY_RE.lastIndex = i;
      var m = QTY_RE.exec(text);
      if (m && m.index === i && !/[\w/]/.test(text[i - 1] || "")) {
        var a = parseQty(m[1]) * f, b = m[3] ? parseQty(m[3]) * f : 0;
        out += fmtQty(a) + (m[3] ? " to " + fmtQty(b) : "");
        i += m[0].length;
        var rest = fixNoun(text.slice(i), b || a);
        text = text.slice(0, i) + rest;
        continue;
      }
      out += ch; i++;
    }
    return [out, depth];
  }
  function scaleHTML(html, f) {
    if (f === 1) return html;
    var depth = 0;
    return html.split(/(<[^>]+>)/).map(function (part) {
      if (!part || part[0] === "<") return part;
      var r = scaleText(part, f, depth); depth = r[1]; return r[0];
    }).join("");
  }
  var ingItems = ingList ? Array.prototype.slice.call(ingList.children) : [];
  ingItems.forEach(function (li) { li.setAttribute("data-orig", li.innerHTML); });
  function scaledIngredients() {
    var f = baseServes ? curServes / baseServes : 1;
    return ingItems.map(function (li) { return scaleHTML(li.getAttribute("data-orig"), f); });
  }

  var costPer = RC_COST[pageSlug], costFact = null;
  if (card) card.querySelectorAll(".recipe-facts li").forEach(function (li) {
    var st = li.querySelector("strong");
    if (st && /cost/i.test(st.textContent)) { costFact = li; var m = /\$\s*(\d+(?:\.\d+)?)/.exec(li.textContent); if (m) costPer = +m[1]; }
  });
  if (card && ingList && baseServes) {
    var facts = card.querySelector(".recipe-facts");
    if (costPer && facts && !costFact) facts.insertAdjacentHTML("beforeend", '<li class="fact-cost"><strong>Est. cost</strong>$' + costPer.toFixed(2) + "/serving</li>");
    var box = document.createElement("div");
    box.className = "scaler";
    box.innerHTML =
      '<div class="scaler-row"><span class="scaler-label">Servings</span>' +
      '<button type="button" class="scaler-btn" data-step="-1" aria-label="Fewer servings">&minus;</button>' +
      '<output class="scaler-num" aria-live="polite">' + baseServes + "</output>" +
      '<button type="button" class="scaler-btn" data-step="1" aria-label="More servings">+</button>' +
      '<span class="scaler-quick">' + [0.5, 1, 2, 3].map(function (x) {
        return '<button type="button" data-mult="' + x + '"' + (x === 1 ? ' class="on"' : "") + ">" + (x === 0.5 ? "½" : x) + "×</button>";
      }).join("") + "</span></div>" +
      (costPer ? '<p class="scaler-cost"></p>' : "") +
      '<p class="scaler-note" hidden>Amounts are adjusted above. Cook times and the amounts written in the steps are for the original ' + baseServes + " servings, and pan size may need to change.</p>";
    ingList.parentNode.insertBefore(box, ingList);
    var updateScale = function () {
      var lines = scaledIngredients();
      ingItems.forEach(function (li, i) { li.innerHTML = lines[i]; });
      box.querySelector(".scaler-num").textContent = curServes;
      var serveFact = card.querySelector(".fact-serves");
      if (serveFact) serveFact.innerHTML = "<strong>Serves</strong>" + curServes;
      box.querySelectorAll("[data-mult]").forEach(function (b) { b.classList.toggle("on", +b.getAttribute("data-mult") * baseServes === curServes); });
      box.querySelector(".scaler-note").hidden = curServes === baseServes;
      var costEl = box.querySelector(".scaler-cost");
      if (costEl) costEl.innerHTML = "&#128176; About <strong>" + money(costPer * curServes) + "</strong> for " + curServes +
        " serving" + (curServes > 1 ? "s" : "") + " (~" + money(costPer) + ' each). <span class="muted small">Rough estimate at typical US grocery prices; leaves out salt, spices and optional extras.</span>';
      document.dispatchEvent(new CustomEvent("rc:scaled"));
    };
    box.addEventListener("click", function (ev) {
      var b = ev.target.closest("button"); if (!b) return;
      if (b.hasAttribute("data-step")) curServes = Math.max(1, Math.min(99, curServes + +b.getAttribute("data-step")));
      else curServes = Math.max(1, Math.round(baseServes * +b.getAttribute("data-mult")));
      updateScale();
    });
    updateScale();
  }

  // ---------- Cook mode (recipe pages) ----------
  var stepEls = card ? card.querySelectorAll(".steps li") : [];
  if (card && stepEls.length) {
    var title = (card.querySelector("h2") || document.querySelector("h1") || {}).textContent || "Recipe";
    var openBtnHTML = '<button type="button" class="btn btn-cook" data-cook>&#128104;&#8205;&#127859; Cook mode</button>';
    var actions = document.querySelector(".actions");
    if (actions) actions.insertAdjacentHTML("afterbegin", openBtnHTML);
    var stepsHead = Array.prototype.filter.call(card.querySelectorAll("h3"), function (h) { return /instructions/i.test(h.textContent); })[0];
    if (stepsHead) stepsHead.insertAdjacentHTML("afterend", '<p>' + openBtnHTML.replace("btn btn-cook", "btn btn-cook btn-sm") + ' <span class="muted small">Big text, one step at a time, screen stays on.</span></p>');

    var cm = document.createElement("div");
    cm.className = "cook-mode"; cm.hidden = true;
    cm.setAttribute("role", "dialog"); cm.setAttribute("aria-modal", "true"); cm.setAttribute("aria-label", "Cook mode: " + title);
    document.body.appendChild(cm);
    var cmPage = 0, cmLock = null, cmChecked = {};
    var total = stepEls.length + 1; // page 0 = ingredients

    var lockScreen = function (on) {
      try {
        if (on && !cmLock && navigator.wakeLock) navigator.wakeLock.request("screen").then(function (l) { cmLock = l; l.addEventListener("release", function () { if (cmLock === l) cmLock = null; }); }, function () {});
        if (!on && cmLock) { cmLock.release(); cmLock = null; }
      } catch (e) {}
    };
    var renderCook = function () {
      var body;
      if (cmPage === 0) {
        body = '<p class="cm-kicker">Gather your ingredients' + (baseServes ? " &middot; " + curServes + " serving" + (curServes > 1 ? "s" : "") : "") + "</p>" +
          '<ul class="cm-ings">' + scaledIngredients().map(function (h, i) {
            return '<li><label><input type="checkbox" data-ing="' + i + '"' + (cmChecked[i] ? " checked" : "") + "> <span>" + h + "</span></label></li>";
          }).join("") + "</ul>";
      } else {
        body = '<p class="cm-kicker">Step ' + cmPage + " of " + stepEls.length + "</p>" +
          '<div class="cm-step">' + stepEls[cmPage - 1].innerHTML + "</div>";
      }
      cm.innerHTML =
        '<div class="cm-top"><span class="cm-title">' + esc(title.trim()) + '</span><button type="button" class="cm-close" data-cm="close" aria-label="Exit cook mode">&times; Exit</button></div>' +
        '<div class="cm-progress"><span style="width:' + Math.round(cmPage / (total - 1) * 100) + '%"></span></div>' +
        '<div class="cm-body">' + body + "</div>" +
        '<div class="cm-nav"><button type="button" class="btn btn-ghost" data-cm="prev"' + (cmPage === 0 ? " disabled" : "") + '>&larr; Back</button>' +
        (cmPage < total - 1
          ? '<button type="button" class="btn" data-cm="next">' + (cmPage === 0 ? "Start cooking" : "Next step") + " &rarr;</button>"
          : '<button type="button" class="btn" data-cm="close">Done! &#127881;</button>') + "</div>";
      cm.querySelector(".cm-body").scrollTop = 0;
    };
    var go = function (d) { var p = Math.max(0, Math.min(total - 1, cmPage + d)); if (p !== cmPage) { cmPage = p; renderCook(); } };
    var openCook = function () {
      cmPage = 0; renderCook(); cm.hidden = false;
      document.documentElement.classList.add("cook-open");
      lockScreen(true);
      try { history.pushState({ rcCook: 1 }, ""); } catch (e) {}
      var c = cm.querySelector("[data-cm=next]"); if (c) c.focus();
    };
    var closeCook = function (fromHistory) {
      if (cm.hidden) return;
      cm.hidden = true; document.documentElement.classList.remove("cook-open"); lockScreen(false);
      if (!fromHistory) { try { if (history.state && history.state.rcCook) history.back(); } catch (e) {} }
    };
    document.addEventListener("click", function (ev) {
      if (ev.target.closest && ev.target.closest("[data-cook]")) { openCook(); return; }
      var b = ev.target.closest && ev.target.closest("[data-cm]");
      if (!b || !cm.contains(b)) return;
      var a = b.getAttribute("data-cm");
      if (a === "next") go(1); else if (a === "prev") go(-1); else if (a === "close") closeCook();
    });
    cm.addEventListener("change", function (ev) {
      var i = ev.target.getAttribute("data-ing"); if (i !== null) cmChecked[i] = ev.target.checked;
    });
    window.addEventListener("popstate", function () { closeCook(true); });
    document.addEventListener("keydown", function (ev) {
      if (cm.hidden) return;
      if (ev.key === "ArrowRight") go(1); else if (ev.key === "ArrowLeft") go(-1); else if (ev.key === "Escape") closeCook();
    });
    var sx = null, sy = null;
    cm.addEventListener("touchstart", function (ev) { if (ev.touches.length === 1) { sx = ev.touches[0].clientX; sy = ev.touches[0].clientY; } }, { passive: true });
    cm.addEventListener("touchend", function (ev) {
      if (sx === null) return;
      var dx = ev.changedTouches[0].clientX - sx, dy = ev.changedTouches[0].clientY - sy; sx = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && !(ev.target.closest && ev.target.closest(".timer-chip"))) go(dx < 0 ? 1 : -1);
    });
    document.addEventListener("visibilitychange", function () { if (!document.hidden && !cm.hidden) lockScreen(true); });
    document.addEventListener("rc:scaled", function () { if (!cm.hidden && cmPage === 0) renderCook(); });
  }


  // ---------- App install support (service worker shows an offline page when there's no connection) ----------
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("/service-worker.js").catch(function () {}); });
  }

  var RC = window.RC = {};

  // ---------- Pantry Tool ----------
  RC.initPantry = function () {
    var groupsEl = document.getElementById("pantry-groups"), resultsEl = document.getElementById("pantry-results");
    var have = load("rc_pantry", []), groups = {}, order = [];
    window.RC_PANTRY.forEach(function (p) { if (!groups[p.g]) { groups[p.g] = []; order.push(p.g); } groups[p.g].push(p); });
    var labels = {}; window.RC_PANTRY.forEach(function (p) { labels[p.k] = p.l; });

    // How many of each ticked item. Items in My Kitchen keep their count there
    // (rc_kitchen) so both pages always show the same number; others use rc_pantry_qty.
    function getQty(k) {
      var kit = load("rc_kitchen", []), it = kit.filter(function (x) { return x && x.k === k; })[0];
      if (it) return Math.max(1, parseInt(it.q, 10) || 1);
      return Math.max(1, parseInt(load("rc_pantry_qty", {})[k], 10) || 1);
    }
    function setQty(k, n) {
      n = Math.max(1, Math.min(99, n));
      var kit = load("rc_kitchen", []), inKit = false;
      kit.forEach(function (x) { if (x && x.k === k) { x.q = n; inKit = true; } });
      if (inKit) save("rc_kitchen", kit);
      var m = load("rc_pantry_qty", {});
      if (n > 1) m[k] = n; else delete m[k];
      save("rc_pantry_qty", m);
    }
    function stepHTML(k, l) {
      var n = getQty(k);
      return '<button type="button" class="kstep-btn" data-pq="' + esc(k) + '" data-step="-1" aria-label="One less ' + esc(l) + '"' + (n <= 1 ? " disabled" : "") + '>&minus;</button>' +
        '<span class="kstep-n" aria-live="polite">' + n + "</span>" +
        '<button type="button" class="kstep-btn" data-pq="' + esc(k) + '" data-step="1" aria-label="One more ' + esc(l) + '"' + (n >= 99 ? " disabled" : "") + ">+</button>";
    }
    groupsEl.innerHTML = order.map(function (g) {
      return '<div class="pantry-group"><h3>' + esc(g) + "</h3>" + groups[g].map(function (p) {
        var on = have.indexOf(p.k) !== -1;
        return '<div class="pantry-item" data-label="' + esc(p.l.toLowerCase()) + '"><label><input type="checkbox" value="' + esc(p.k) + '"' +
          (on ? " checked" : "") + "> " + esc(p.l) + "</label>" +
          '<span class="kstep pstep" role="group" aria-label="How many ' + esc(p.l) + '" data-pstep="' + esc(p.k) + '"' + (on ? "" : " hidden") + ">" +
          (on ? stepHTML(p.k, p.l) : "") + "</span></div>";
      }).join("") + "</div>";
    }).join("");
    groupsEl.addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-pq]"); if (!b) return;
      var k = b.getAttribute("data-pq");
      setQty(k, getQty(k) + (+b.getAttribute("data-step")));
      b.parentNode.innerHTML = stepHTML(k, labels[k]);
    });

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
      var st = groupsEl.querySelector('[data-pstep="' + k + '"]');
      if (st) { st.hidden = !ev.target.checked; st.innerHTML = ev.target.checked ? stepHTML(k, labels[k]) : ""; }
      save("rc_pantry", have); render();
    });
    document.getElementById("pantry-filter").addEventListener("input", function (ev) {
      var q = ev.target.value.trim().toLowerCase();
      groupsEl.querySelectorAll(".pantry-item").forEach(function (l) {
        l.style.display = !q || l.getAttribute("data-label").indexOf(q) !== -1 ? "" : "none";
      });
    });
    document.getElementById("pantry-clear").addEventListener("click", function () {
      have = []; save("rc_pantry", have); save("rc_pantry_qty", {});
      groupsEl.querySelectorAll("input").forEach(function (c) { c.checked = false; });
      groupsEl.querySelectorAll("[data-pstep]").forEach(function (st) { st.hidden = true; st.innerHTML = ""; }); render();
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
