/* ================================================================
   MY KITCHEN - track what you have and when it goes bad,
   then see what to cook first.
   Saved in this browser only (localStorage "rc_kitchen").
   Items added here are also ticked in the Pantry Tool.
   ================================================================ */
(function () {
  "use strict";

  // Typical days before these go bad (fridge, once bought/opened).
  // Anything not listed is a staple with no use-by date by default.
  var SHELF = {
    "chicken": 2, "ground-beef": 2, "ham": 5, "sausage": 5, "bacon": 7, "canned-tuna": 0,
    "milk": 7, "eggs": 21, "butter": 30, "cheese": 21, "parmesan": 30, "yogurt": 14,
    "sour-cream": 14, "cream-cheese": 14, "orange-juice": 7, "salsa": 7,
    "spinach": 5, "parsley": 7, "green-onion": 7, "bell-pepper": 7, "banana": 5,
    "carrot": 21, "celery": 14, "cabbage": 21, "potatoes": 30, "sweet-potato": 21,
    "onion": 30, "garlic": 60, "ginger": 21, "bread": 5, "tortillas": 14
  };
  var QUICK = ["eggs", "milk", "chicken", "ground-beef", "bacon", "spinach", "bread", "cheese", "banana", "bell-pepper", "tortillas", "sour-cream"];
  var URGENT_DAYS = 4;

  function load(k, f) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? f : v; } catch (e) { return f; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function iso(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function plusDays(n) { var d = today(); d.setDate(d.getDate() + n); return iso(d); }
  function daysLeft(dstr) {
    if (!dstr) return null;
    var p = dstr.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2]);
    return Math.round((d - today()) / 86400000);
  }

  // ---- calendar reminders (no server: the visitor's own calendar sends the alert) ----
  function pad(n) { return ("0" + n).slice(-2); }
  function remindDay(dstr) { // morning before the use-by date, or that morning if it's tomorrow
    var p = dstr.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2]);
    d.setDate(d.getDate() - 1);
    if (d < today()) d = today();
    return d;
  }
  function stamp(d, h, m) { return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "T" + pad(h) + pad(m) + "00"; }
  function niceDate(dstr) { var p = dstr.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); }
  function reminderText(label, dstr) {
    return { title: "Use your " + label.toLowerCase() + " soon (The Rusty Chef)",
             details: "Your " + label.toLowerCase() + " is good until " + niceDate(dstr) + ". See what to cook with it: https://therustychef.com/kitchen.html" };
  }
  function icsFile(label, dstr) {
    var d = remindDay(dstr), t = reminderText(label, dstr);
    var escI = function (s) { return s.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1"); };
    var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//The Rusty Chef//My Kitchen//EN", "BEGIN:VEVENT",
      "UID:" + Date.now() + "-" + Math.random().toString(36).slice(2) + "@therustychef.com",
      "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, ""),
      "DTSTART:" + stamp(d, 9, 0), "DTEND:" + stamp(d, 9, 15),
      "SUMMARY:" + escI(t.title), "DESCRIPTION:" + escI(t.details), "URL:https://therustychef.com/kitchen.html",
      "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + escI(t.title), "TRIGGER:PT0M", "END:VALARM",
      "END:VEVENT", "END:VCALENDAR"];
    return lines.join("\r\n");
  }
  function googleLink(label, dstr) {
    var d = remindDay(dstr), t = reminderText(label, dstr);
    return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(t.title) +
      "&dates=" + stamp(d, 9, 0) + "/" + stamp(d, 9, 15) + "&details=" + encodeURIComponent(t.details);
  }

  window.RC_KITCHEN_init = function () {
    var root = document.getElementById("kitchen");
    if (!root || !window.RC_PANTRY) return;
    var P = window.RC_PANTRY, R = window.RC_RECIPES || [];
    var labels = {}, groups = {}, order = [];
    P.forEach(function (p) { labels[p.k] = p.l; if (!groups[p.g]) { groups[p.g] = []; order.push(p.g); } groups[p.g].push(p); });

    var items = load("rc_kitchen", []).filter(function (it) { return it && labels[it.k]; });
    var selEl = document.getElementById("k-item"), dateEl = document.getElementById("k-date"), hintEl = document.getElementById("k-hint");
    var listEl = document.getElementById("k-list"), firstEl = document.getElementById("k-first"), quickEl = document.getElementById("k-quick");

    selEl.innerHTML = '<option value="">Pick an ingredient&hellip;</option>' + order.map(function (g) {
      return '<optgroup label="' + esc(g) + '">' + groups[g].map(function (p) { return '<option value="' + esc(p.k) + '">' + esc(p.l) + "</option>"; }).join("") + "</optgroup>";
    }).join("");
    quickEl.innerHTML = QUICK.filter(function (k) { return labels[k]; }).map(function (k) {
      return '<button type="button" class="chip" data-quick="' + esc(k) + '">+ ' + esc(labels[k]) + "</button>";
    }).join("");

    selEl.addEventListener("change", function () {
      var k = selEl.value, n = SHELF[k];
      if (!k) { hintEl.textContent = ""; dateEl.value = ""; return; }
      if (n === undefined || n === 0) { dateEl.value = ""; hintEl.textContent = "Keeps a long time. Leave the date blank, or set one if it's opened."; }
      else { dateEl.value = plusDays(n); hintEl.textContent = "Usually good for about " + n + " day" + (n === 1 ? "" : "s") + ". Change the date if yours says otherwise."; }
    });

    function syncPantry(k, add) {
      var have = load("rc_pantry", []);
      var i = have.indexOf(k);
      if (add && i === -1) have.push(k);
      if (!add && i !== -1) have.splice(i, 1);
      save("rc_pantry", have);
    }
    function addItem(k, d) {
      if (!labels[k]) return;
      items = items.filter(function (it) { return it.k !== k; });
      items.push({ k: k, d: d || null });
      save("rc_kitchen", items); syncPantry(k, true); render();
    }

    document.getElementById("k-add").addEventListener("click", function () {
      if (!selEl.value) { hintEl.textContent = "Pick an ingredient first."; return; }
      var nk = selEl.value, nd = dateEl.value;
      addItem(nk, nd); showAdded(nk, nd);
      selEl.value = ""; dateEl.value = ""; hintEl.textContent = "";
    });
    quickEl.addEventListener("click", function (e) {
      var b = e.target.closest("[data-quick]"); if (!b) return;
      var k = b.getAttribute("data-quick"), n = SHELF[k];
      addItem(k, n ? plusDays(n) : null); showAdded(k, n ? plusDays(n) : null);
    });
    var addedEl = document.getElementById("k-added");
    function reminderHTML(k, d) {
      var when = remindDay(d).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
      var file = "data:text/calendar;charset=utf-8," + encodeURIComponent(icsFile(labels[k], d));
      return '<a class="btn ksmall" href="' + file + '" download="use-your-' + esc(k) + '.ics">Apple / Outlook calendar</a> ' +
        '<a class="btn ksmall" href="' + esc(googleLink(labels[k], d)) + '" target="_blank" rel="noopener">Google Calendar</a>' +
        '<p class="muted small">Reminder on ' + esc(when) + ' at 9am. Your calendar sends the alert. We never see your phone number or calendar.</p>';
    }
    function showAdded(k, d) {
      if (!addedEl) return;
      var n = daysLeft(d);
      if (n === null || n < 1) {
        addedEl.innerHTML = "<p>&#9989; Added <strong>" + esc(labels[k]) + "</strong> to your kitchen.</p>";
      } else {
        addedEl.innerHTML = "<p>&#9989; Added <strong>" + esc(labels[k]) + "</strong>. &#128276; <strong>Add a reminder to your calendar</strong> so you don't forget it:</p>" + reminderHTML(k, d);
      }
      addedEl.hidden = false;
    }

    listEl.addEventListener("click", function (e) {
      var rb = e.target.closest("[data-remind]");
      if (rb) {
        var rk = rb.getAttribute("data-remind"), it = items.filter(function (x) { return x.k === rk; })[0];
        var panel = document.getElementById("kr-" + rk);
        if (!it || !it.d || !panel) return;
        if (!panel.hidden) { panel.hidden = true; rb.setAttribute("aria-expanded", "false"); return; }
        panel.innerHTML = '<p>&#128276; Add a reminder to your phone\'s calendar:</p>' + reminderHTML(rk, it.d);
        panel.hidden = false; rb.setAttribute("aria-expanded", "true");
        return;
      }
      var b = e.target.closest("[data-used]"); if (!b) return;
      var k = b.getAttribute("data-used");
      items = items.filter(function (it) { return it.k !== k; });
      save("rc_kitchen", items); syncPantry(k, false); render();
    });
    listEl.addEventListener("change", function (e) {
      var inp = e.target.closest("[data-date]"); if (!inp) return;
      var k = inp.getAttribute("data-date");
      items.forEach(function (it) { if (it.k === k) it.d = inp.value || null; });
      save("rc_kitchen", items); render();
    });
    document.getElementById("k-clear").addEventListener("click", function () {
      if (!items.length) return;
      items.forEach(function (it) { syncPantry(it.k, false); });
      items = []; save("rc_kitchen", items); render();
    });

    function badge(n) {
      if (n === null) return '<span class="kbadge k-ok">No rush</span>';
      if (n < 0) return '<span class="kbadge k-bad">' + (n === -1 ? "Past date yesterday" : "Past date " + (-n) + " days ago") + "</span>";
      if (n === 0) return '<span class="kbadge k-bad">Use today</span>';
      if (n <= 2) return '<span class="kbadge k-bad">' + n + " day" + (n === 1 ? "" : "s") + " left</span>";
      if (n <= URGENT_DAYS) return '<span class="kbadge k-warn">' + n + " days left</span>";
      return '<span class="kbadge k-ok">' + n + " days left</span>";
    }

    function render() {
      var sorted = items.map(function (it) { return { k: it.k, d: it.d, n: daysLeft(it.d) }; })
        .sort(function (a, b) { var x = a.n === null ? 9999 : a.n, y = b.n === null ? 9999 : b.n; return x - y || labels[a.k].localeCompare(labels[b.k]); });

      listEl.innerHTML = sorted.length ? sorted.map(function (it) {
        return '<li class="krow"><div class="kname"><strong>' + esc(labels[it.k]) + "</strong>" + badge(it.n) + "</div>" +
          '<div class="kactions"><input type="date" aria-label="Use-by date for ' + esc(labels[it.k]) + '" data-date="' + esc(it.k) + '" value="' + esc(it.d || "") + '">' +
          (it.n !== null && it.n >= 1 ? '<button type="button" class="btn btn-ghost ksmall" data-remind="' + esc(it.k) + '" aria-expanded="false">&#128276; Remind me</button>' : "") +
          '<button type="button" class="btn btn-ghost ksmall" data-used="' + esc(it.k) + '">&#10003; Used it</button></div>' +
          '<div class="kremind" id="kr-' + esc(it.k) + '" hidden></div></li>';
      }).join("") : '<li class="muted">Nothing here yet. Add what you just bought, or tap a quick-add button.</li>';

      // ---- Cook these first ----
      var have = {}, urgent = {};
      sorted.forEach(function (it) { have[it.k] = it; if (it.n !== null && it.n <= URGENT_DAYS) urgent[it.k] = it; });
      load("rc_pantry", []).forEach(function (k) { if (!have[k]) have[k] = { k: k, n: null }; });
      var urgentKeys = Object.keys(urgent);
      if (!items.length) { firstEl.innerHTML = '<p class="muted">Add a few things to your kitchen and Rusty will tell you what to cook first.</p>'; return; }

      var scored = R.map(function (r) {
        var req = r.i.filter(function (x) { return !x.o; });
        var got = req.filter(function (x) { return have[x.k]; });
        var miss = req.filter(function (x) { return !have[x.k]; });
        var uses = {}, pts = 0;
        r.i.forEach(function (x) { var u = urgent[x.k]; if (u && !uses[x.k]) { uses[x.k] = u; pts += (URGENT_DAYS + 1 - Math.max(u.n, 0)); } });
        var usesList = Object.keys(uses).map(function (k) { return uses[k]; });
        return { r: r, pts: pts, uses: usesList, miss: miss, pct: req.length ? got.length / req.length : 0 };
      });
      var pick = urgentKeys.length ? scored.filter(function (s) { return s.pts > 0; }) : scored.filter(function (s) { return s.pct > 0; });
      pick.sort(function (a, b) { return (b.pts - a.pts) || (b.pct - a.pct) || (a.miss.length - b.miss.length); });
      pick = pick.slice(0, 6);

      var intro = urgentKeys.length ?
        '<p class="kintro">&#9888;&#65039; Use these soon: <strong>' + urgentKeys.map(function (k) { return esc(labels[k].toLowerCase()); }).join(", ") + "</strong>. Here's what to make with them:</p>" :
        '<p class="kintro">&#127881; Nothing is about to go bad. Here are good matches for what you have:</p>';
      if (!pick.length) { firstEl.innerHTML = intro + '<p class="muted">We don\'t have a recipe that uses those yet.</p>'; return; }

      firstEl.innerHTML = intro + '<ul class="cards">' + pick.map(function (s) {
        var r = s.r;
        var img = r.ph ? '<img class="card-photo" src="https://images.unsplash.com/' + esc(r.ph) + '?auto=format&amp;fit=crop&amp;w=400&amp;h=300&amp;q=70" alt="" width="400" height="300" loading="lazy">' : "";
        var uses = s.uses.length ? '<p class="kuses">Uses your ' + s.uses.map(function (u) {
          return esc(labels[u.k].toLowerCase()) + " <span>(" + (u.n < 0 ? "past date" : u.n === 0 ? "today" : u.n + "d") + ")</span>";
        }).join(", ") + "</p>" : "";
        var miss = s.miss.length ? '<p class="kmiss">Still need: ' + s.miss.map(function (x) { return esc(labels[x.k] || x.t); }).join(", ") + "</p>" : '<p class="kmiss k-have">You have everything!</p>';
        return '<li class="card"><a href="/recipes/' + esc(r.s) + '.html">' + img + '<span class="tag">' + esc(r.c) + "</span><h3>" + esc(r.t) + "</h3>" + uses + miss +
          '<span class="meta">' + r.m + " min" + (r.p ? " &middot; about $" + r.p.toFixed(2) + "/serving" : "") + "</span></a></li>";
      }).join("") + "</ul>";
    }
    render();
  };
})();
