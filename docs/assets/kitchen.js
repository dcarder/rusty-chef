/* ================================================================
   MY KITCHEN - track what you have and when it goes bad,
   then see what to cook first.
   Saved in this browser only (localStorage "rc_kitchen").
   Items added here are also ticked in the Pantry Tool.
   Each item is { k: key, d: use-by date, q: how many }.
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
    items.forEach(function (it) { it.q = Math.max(1, Math.min(99, parseInt(it.q, 10) || 1)); });
    function qtyOf(v) { return Math.max(1, Math.min(99, parseInt(v, 10) || 1)); }
    function earlier(a, b) { if (!a) return b || null; if (!b) return a; return a < b ? a : b; }
    var selEl = document.getElementById("k-item"), dateEl = document.getElementById("k-date"), hintEl = document.getElementById("k-hint");
    var qtyEl = document.getElementById("k-qty");
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
    // Adding something you already have adds to how many you have,
    // and keeps the sooner use-by date so it still gets cooked first.
    function putItem(k, d, q) {
      var old = items.filter(function (it) { return it.k === k; })[0];
      if (old) { old.q = Math.min(99, old.q + q); old.d = earlier(old.d, d || null); }
      else items.push({ k: k, d: d || null, q: q });
      syncPantry(k, true);
    }
    function addItem(k, d, q) {
      if (!labels[k]) return;
      putItem(k, d, qtyOf(q));
      save("rc_kitchen", items); render();
    }

    document.getElementById("k-add").addEventListener("click", function () {
      if (!selEl.value) { hintEl.textContent = "Pick an ingredient first."; return; }
      var nk = selEl.value, nd = dateEl.value, nq = qtyOf(qtyEl && qtyEl.value);
      addItem(nk, nd, nq); showAdded(nk, nd, nq);
      selEl.value = ""; dateEl.value = ""; hintEl.textContent = ""; if (qtyEl) qtyEl.value = 1;
    });
    quickEl.addEventListener("click", function (e) {
      var b = e.target.closest("[data-quick]"); if (!b) return;
      var k = b.getAttribute("data-quick"), n = SHELF[k];
      addItem(k, n ? plusDays(n) : null, 1); showAdded(k, n ? plusDays(n) : null, 1);
    });
    var addedEl = document.getElementById("k-added");
    var UA = navigator.userAgent || "";
    var isIOS = /iPhone|iPad|iPod/.test(UA) || (/Macintosh/.test(UA) && "ontouchend" in document);
    var isAndroid = /Android/.test(UA);
    var inApp = /FBAN|FBAV|Instagram|Line\/|Snapchat|TikTok|Twitter/i.test(UA);
    var STEPS_IOS = '<div class="ksteps" hidden><p><strong>Almost done! On iPhone, Safari saves the reminder first:</strong></p>' +
      '<svg viewBox="0 0 300 54" width="300" height="54" role="img" aria-label="Safari address bar with the downloads arrow on the left">' +
      '<rect x="1" y="7" width="298" height="40" rx="12" fill="#f1f1f3" stroke="#d0d0d5"/>' +
      '<circle cx="26" cy="27" r="14" fill="#c4532b"/><path d="M26 18v13m-6-6 6 6 6-6M19 35h14" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<text x="52" y="32" font-family="system-ui,sans-serif" font-size="14" fill="#555">therustychef.com</text>' +
      '</svg>' +
      '<ol><li>Tap the <strong>&#11015; downloads arrow</strong> on the left of Safari\'s address bar (it may be inside the <strong>&#7424;A</strong> menu).</li>' +
      '<li>Tap the file that starts with <strong>use-your-</strong>.</li><li>Tap <strong>Add to Calendar</strong>. Done!</li></ol>' +
      (inApp ? '<p class="muted small">Opened this page from Facebook, Instagram or another app? Open it in Safari first. Calendar files don\'t work inside those apps.</p>' : "") +
      "</div>";
    var STEPS_OTHER = '<div class="ksteps" hidden><p>The reminder file is in your downloads. Open it and choose <strong>Add to Calendar</strong> (or <strong>Save</strong>).</p></div>';
    function reminderHTML(k, d) {
      var when = remindDay(d).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
      var file = "data:text/calendar;charset=utf-8," + encodeURIComponent(icsFile(labels[k], d));
      var apple = '<a class="btn ksmall' + (isAndroid ? " btn-ghost" : "") + '" data-cal="apple" href="' + file + '" download="use-your-' + esc(k) + '.ics">' + (isIOS ? "Add to iPhone Calendar" : "Apple / Outlook calendar") + "</a> ";
      var google = '<a class="btn ksmall' + (isAndroid ? "" : " btn-ghost") + '" href="' + esc(googleLink(labels[k], d)) + '" target="_blank" rel="noopener">Google Calendar</a> ';
      return (isAndroid ? google + apple : apple + google) + (isIOS ? STEPS_IOS : STEPS_OTHER) +
        '<p class="muted small">Reminder on ' + esc(when) + ' at 9am. Your calendar sends the alert. We never see your phone number or calendar.</p>';
    }
    root.addEventListener("click", function (e) {
      var a = e.target.closest('[data-cal="apple"]'); if (!a) return;
      var box = a.parentNode.querySelector(".ksteps"); if (box) box.hidden = false;
    });
    function showAdded(k, d, q) {
      if (!addedEl) return;
      var n = daysLeft(d), cur = items.filter(function (it) { return it.k === k; })[0];
      var have = cur && cur.q > q ? " You now have <strong>" + cur.q + "</strong>." : "";
      if (n === null || n < 1) {
        addedEl.innerHTML = "<p>&#9989; Added " + (q > 1 ? q + " " : "") + "<strong>" + esc(labels[k]) + "</strong> to your kitchen." + have + "</p>";
      } else {
        addedEl.innerHTML = "<p>&#9989; Added " + (q > 1 ? q + " " : "") + "<strong>" + esc(labels[k]) + "</strong>." + have + " &#128276; <strong>Add a reminder to your calendar</strong> so you don't forget it:</p>" + reminderHTML(k, d);
      }
      addedEl.hidden = false;
    }

    // ---- receipt scanning (OCR runs in the browser with Tesseract.js; nothing is uploaded) ----
    var scanEl = document.getElementById("k-scan");
    var TESS = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
    function loadTess() {
      if (window.Tesseract) return Promise.resolve(window.Tesseract);
      return new Promise(function (ok, bad) {
        var s = document.createElement("script"); s.src = TESS;
        s.onload = function () { ok(window.Tesseract); }; s.onerror = bad; document.head.appendChild(s);
      });
    }
    function prepImage(file) { // grayscale, boost contrast, scale to ~1600px wide
      return new Promise(function (ok, bad) {
        var url = URL.createObjectURL(file), img = new Image();
        img.onload = function () {
          var w = img.naturalWidth, h = img.naturalHeight, sc = Math.min(2.5, Math.max(1, 1600 / w));
          if (w * sc * h * sc > 16e6) sc = Math.sqrt(16e6 / (w * h));
          var c = document.createElement("canvas"); c.width = Math.round(w * sc); c.height = Math.round(h * sc);
          var x = c.getContext("2d"); x.drawImage(img, 0, 0, c.width, c.height);
          var d = x.getImageData(0, 0, c.width, c.height), a = d.data, i, g;
          for (i = 0; i < a.length; i += 4) {
            g = 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2];
            g = Math.max(0, Math.min(255, (g - 128) * 1.5 + 140));
            a[i] = a[i + 1] = a[i + 2] = g;
          }
          x.putImageData(d, 0, 0); URL.revokeObjectURL(url); ok(c);
        };
        img.onerror = function () { URL.revokeObjectURL(url); bad(new Error("img")); };
        img.src = url;
      });
    }
    function scanMsg(html) { scanEl.innerHTML = html; scanEl.hidden = false; }
    function onReceipt(e) {
      var f = e.target.files && e.target.files[0]; e.target.value = "";
      if (!f) return;
      scanMsg('<p class="kscan-status">&#128269; Reading your receipt&hellip; <span id="k-pct">0%</span></p><div class="kbar"><span id="k-bar"></span></div>');
      var setPct = function (p) {
        var t = document.getElementById("k-pct"), b = document.getElementById("k-bar");
        if (t) t.textContent = Math.round(p * 100) + "%"; if (b) b.style.width = Math.round(p * 100) + "%";
      };
      var worker;
      Promise.all([loadTess(), prepImage(f)]).then(function (r) {
        return r[0].createWorker("eng", 1, {
          logger: function (m) { if (m.status === "recognizing text") setPct(m.progress); }
        }).then(function (w) {
          worker = w;
          return w.setParameters({ tessedit_pageseg_mode: "4" }).then(function () { return w.recognize(r[1]); });
        });
      }).then(function (res) {
        if (worker) worker.terminate();
        showScan(window.RC_RECEIPT.parse(res.data.text || ""));
      }).catch(function () {
        if (worker) worker.terminate();
        scanMsg('<p>&#128533; Sorry, the receipt reader didn\'t load. Check your connection and try again, or add items below.</p>');
      });
    }
    function showScan(res) {
      var found = res.found.filter(function (k) { return labels[k]; });
      if (!found.length) {
        scanMsg('<p>&#129300; We couldn\'t find any groceries on that one. Try again with the receipt flat, in good light, and filling the photo. Or add items below.</p>');
        return;
      }
      var rows = found.map(function (k) {
        var n = SHELF[k], d = n ? plusDays(n) : "", c = (res.counts && res.counts[k]) || 1;
        return '<li><label><input type="checkbox" checked data-scan="' + esc(k) + '"> <strong>' + esc(labels[k]) + "</strong></label>" +
          ' <label class="kqtylbl">&times; <input type="number" class="kqty-in" min="1" max="99" inputmode="numeric" aria-label="How many ' + esc(labels[k]) + '" data-scan-qty="' + esc(k) + '" value="' + c + '"></label>' +
          '<input type="date" aria-label="Use-by date for ' + esc(labels[k]) + '" data-scan-date="' + esc(k) + '" value="' + d + '"></li>';
      }).join("");
      var un = res.unmatched.length ? '<details class="kunmatched"><summary>' + res.unmatched.length + " line" + (res.unmatched.length === 1 ? "" : "s") +
        " we skipped</summary><p class=\"muted small\">" + res.unmatched.map(esc).join(" &middot; ") + '</p><p class="muted small">Add any of these yourself below if they\'re groceries.</p></details>' : "";
      scanMsg('<p>&#9989; Found <strong>' + found.length + "</strong> item" + (found.length === 1 ? "" : "s") + ". Untick anything that's wrong and check the dates:</p>" +
        '<ul class="kscan-list">' + rows + "</ul>" + un +
        '<p><button type="button" class="btn" id="k-scan-add">Add ' + found.length + ' to my kitchen</button> <button type="button" class="btn btn-ghost ksmall" id="k-scan-cancel">Cancel</button></p>');
    }
    document.getElementById("k-receipt-cam").addEventListener("change", onReceipt);
    document.getElementById("k-receipt-file").addEventListener("change", onReceipt);
    scanEl.addEventListener("change", function (e) {
      if (!e.target.matches("[data-scan]")) return;
      var n = scanEl.querySelectorAll("[data-scan]:checked").length, b = document.getElementById("k-scan-add");
      if (b) { b.textContent = "Add " + n + " to my kitchen"; b.disabled = !n; }
    });
    scanEl.addEventListener("click", function (e) {
      if (e.target.id === "k-scan-cancel") { scanEl.hidden = true; scanEl.innerHTML = ""; return; }
      if (e.target.id !== "k-scan-add") return;
      var added = [];
      scanEl.querySelectorAll("[data-scan]:checked").forEach(function (cb) {
        var k = cb.getAttribute("data-scan"), di = scanEl.querySelector('[data-scan-date="' + k + '"]');
        var d = di && di.value ? di.value : null, qi = scanEl.querySelector('[data-scan-qty="' + k + '"]');
        var q = qtyOf(qi && qi.value);
        putItem(k, d, q);
        added.push({ k: k, d: d, q: q });
      });
      save("rc_kitchen", items); render();
      var soon = added.filter(function (a) { var n = daysLeft(a.d); return n !== null && n >= 1 && n <= 7; })
        .sort(function (a, b) { return daysLeft(a.d) - daysLeft(b.d); });
      var total = added.reduce(function (t, a) { return t + a.q; }, 0);
      scanMsg("<p>&#127881; Added <strong>" + total + "</strong> item" + (total === 1 ? "" : "s") + " to your kitchen." +
        (soon.length ? " These go bad first. Tap <strong>&#128276; Remind me</strong> next to any of them in your list to add a calendar reminder: <strong>" +
          soon.map(function (a) { return esc(labels[a.k].toLowerCase()); }).join(", ") + "</strong>." : "") + "</p>" +
        '<p><a href="#k-first">See what to cook first &darr;</a></p>');
    });

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
      var qb = e.target.closest("[data-qty]");
      if (qb) {
        var qk = qb.getAttribute("data-qty"), step = +qb.getAttribute("data-step");
        items.forEach(function (it) { if (it.k === qk) it.q = Math.max(1, Math.min(99, it.q + step)); });
        save("rc_kitchen", items); render();
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
      var sorted = items.map(function (it) { return { k: it.k, d: it.d, q: it.q, n: daysLeft(it.d) }; })
        .sort(function (a, b) { var x = a.n === null ? 9999 : a.n, y = b.n === null ? 9999 : b.n; return x - y || labels[a.k].localeCompare(labels[b.k]); });

      listEl.innerHTML = sorted.length ? sorted.map(function (it) {
        var lbl = esc(labels[it.k]);
        return '<li class="krow"><div class="kname"><strong>' + lbl + "</strong>" + (it.q > 1 ? '<span class="kcount">&times;' + it.q + "</span>" : "") + badge(it.n) + "</div>" +
          '<div class="kactions"><span class="kstep" role="group" aria-label="How many ' + lbl + '">' +
          '<button type="button" class="kstep-btn" data-qty="' + esc(it.k) + '" data-step="-1" aria-label="One less ' + lbl + '"' + (it.q <= 1 ? " disabled" : "") + '>&minus;</button>' +
          '<span class="kstep-n" aria-live="polite">' + it.q + "</span>" +
          '<button type="button" class="kstep-btn" data-qty="' + esc(it.k) + '" data-step="1" aria-label="One more ' + lbl + '"' + (it.q >= 99 ? " disabled" : "") + ">+</button></span>" +
          '<input type="date" aria-label="Use-by date for ' + esc(labels[it.k]) + '" data-date="' + esc(it.k) + '" value="' + esc(it.d || "") + '">' +
          (it.n !== null && it.n >= 1 ? '<button type="button" class="btn btn-ghost ksmall" data-remind="' + esc(it.k) + '" aria-expanded="false">&#128276; Remind me</button>' : "") +
          '<button type="button" class="btn btn-ghost ksmall" data-used="' + esc(it.k) + '">&#10003; ' + (it.q > 1 ? "Used them all" : "Used it") + '</button></div>' +
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
