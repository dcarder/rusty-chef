/* ================================================================
   PANTRY SCANNER  -  "Rusty's robot eyes"
   ================================================================
   Take a photo of a pantry shelf (or one item) and Rusty tries to
   work out what's in it, then ticks those boxes in the Pantry Tool.

   It runs 100% in the visitor's browser - no API key, no server,
   and the photo is never uploaded anywhere:
     1. Tesseract.js reads the words on labels (OCR).
     2. MobileNet (TensorFlow.js) recognises loose produce/bread.
     3. The words are matched against the Pantry Tool ingredients.

   To teach it a new word, add it to WORDS below under the right
   ingredient key (keys come from RC_PANTRY in recipes-data.js).
   ================================================================ */
(function () {
  "use strict";

  var TESSERACT_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
  var TFJS_URL = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0";
  var MOBILENET_URL = "https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1";

  // Order matters: more specific phrases come first and "use up" the text,
  // so "peanut butter" isn't also counted as "butter", etc.
  var WORDS = [
    [null, ["zero sugar", "sugar free", "no sugar", "no added sugar", "low sodium", "no salt", "salt free", "fat free", "oil free"]], // labels, not ingredients
    ["peanut-butter", ["peanut butter", "jif", "skippy"]],
    ["tortilla-chips", ["tortilla chips", "tostitos", "corn chips"]],
    ["coconut-milk", ["coconut milk", "coconut cream"]],
    ["sesame-oil", ["sesame oil", "toasted sesame"]],
    ["olive-oil", ["olive oil", "extra virgin"]],
    ["sour-cream", ["sour cream"]],
    ["orange-juice", ["orange juice", "tropicana", "simply orange"]],
    ["sweet-potato", ["sweet potatoes", "sweet potato", "yams"]],
    ["green-onion", ["green onions", "green onion", "scallions", "scallion"]],
    ["black-beans", ["black beans"]],
    ["white-beans", ["white beans", "cannellini", "great northern", "navy beans"]],
    ["kidney-beans", ["kidney beans"]],
    ["chickpeas", ["chickpeas", "chickpea", "garbanzo"]],
    ["canned-tuna", ["tuna", "starkist", "bumble bee", "chicken of the sea"]],
    ["stock", ["chicken broth", "beef broth", "vegetable broth", "chicken stock", "beef stock", "vegetable stock", "bone broth", "broth", "stock", "bouillon", "swanson"]],
    ["canned-tomatoes", ["diced tomatoes", "crushed tomatoes", "whole tomatoes", "stewed tomatoes", "tomato sauce", "tomato paste", "petite diced", "san marzano", "rotel", "pasta sauce", "spaghetti sauce", "marinara", "tomatoes"]],
    ["ground-beef", ["ground beef", "ground chuck", "ground round"]],
    ["chili-powder", ["chili powder", "chile powder"]],
    ["chili-flakes", ["red pepper flakes", "crushed red pepper", "chili flakes", "chile flakes"]],
    ["curry-powder", ["curry powder", "curry"]],
    ["baking-powder", ["baking powder", "clabber girl"]],
    ["cornstarch", ["corn starch", "cornstarch", "argo"]],
    ["cornmeal", ["corn meal", "cornmeal", "polenta", "masa"]],
    ["breadcrumbs", ["bread crumbs", "breadcrumbs", "panko"]],
    ["dried-herbs", ["italian seasoning", "oregano", "basil", "thyme", "herbes"]],
    ["frozen-veg", ["mixed vegetables", "frozen vegetables", "vegetable blend", "stir fry vegetables", "green beans", "sweet peas", "peas", "sweet corn", "broccoli"]],
    ["ramen", ["ramen", "cup noodles", "maruchan", "top ramen", "nissin"]],
    ["ravioli", ["ravioli", "tortellini"]],
    ["pasta", ["pasta", "spaghetti", "penne", "macaroni", "rotini", "linguine", "fettuccine", "farfalle", "rigatoni", "ziti", "elbows", "egg noodles", "noodles", "barilla", "ronzoni"]],
    ["rice", ["jasmine rice", "basmati", "long grain", "rice"]],
    ["tortillas", ["flour tortillas", "corn tortillas", "tortillas", "tortilla"]],
    ["flour", ["all purpose", "flour", "gold medal"]],
    ["bread", ["bread", "buns", "bagels", "bagel", "loaf", "rolls"]],
    ["lentils", ["lentils", "lentil"]],
    ["oats", ["rolled oats", "old fashioned oats", "oatmeal", "oats", "quaker"]],
    ["soy-sauce", ["soy sauce", "kikkoman", "tamari"]],
    ["mayo", ["mayonnaise", "mayo", "hellmann", "hellmanns", "dukes"]],
    ["ketchup", ["ketchup", "catsup"]],
    ["mustard", ["mustard", "dijon"]],
    ["honey", ["honey"]],
    ["vinegar", ["vinegar", "lime juice", "limes", "lime"]],
    ["salsa", ["salsa", "picante"]],
    ["tahini", ["tahini"]],
    ["raisins", ["raisins", "sun maid"]],
    ["olives", ["olives", "kalamata"]],
    ["capers", ["capers"]],
    ["parmesan", ["parmesan", "parmigiano", "romano"]],
    ["cheese", ["cheddar", "mozzarella", "monterey jack", "colby", "provolone", "american cheese", "cheese"]],
    ["yogurt", ["greek yogurt", "yogurt", "yoghurt"]],
    ["butter", ["butter"]],
    ["milk", ["half and half", "heavy cream", "whipping cream", "milk", "cream"]],
    ["eggs", ["large eggs", "eggs", "dozen"]],
    ["sausage", ["sausage", "pepperoni", "kielbasa", "chorizo", "bratwurst"]],
    ["ham", ["ham"]],
    ["chicken", ["chicken breast", "chicken thighs", "rotisserie", "chicken"]],
    ["spinach", ["spinach"]],
    ["parsley", ["parsley", "cilantro"]],
    ["garlic", ["garlic"]],
    ["onion", ["onions", "onion"]],
    ["carrot", ["carrots", "carrot"]],
    ["celery", ["celery"]],
    ["bell-pepper", ["bell peppers", "bell pepper"]],
    ["cabbage", ["cabbage", "coleslaw"]],
    ["potatoes", ["potatoes", "potato", "russet", "yukon"]],
    ["banana", ["bananas", "banana"]],
    ["cocoa", ["cocoa"]],
    ["cinnamon", ["cinnamon"]],
    ["cumin", ["cumin"]],
    ["paprika", ["paprika"]],
    ["ginger", ["ginger"]],
    ["sugar", ["brown sugar", "powdered sugar", "cane sugar", "granulated", "sugar", "domino"]],
    ["salt", ["sea salt", "kosher salt", "iodized", "morton", "salt"]],
    ["oil", ["vegetable oil", "canola oil", "cooking oil", "avocado oil", "crisco", "wesson", "canola", "oil"]]
  ];

  // MobileNet (ImageNet) labels that mean a pantry ingredient.
  var VISION = {
    "banana": "banana", "bell pepper": "bell-pepper", "head cabbage": "cabbage",
    "french loaf": "bread", "bagel": "bread", "broccoli": "frozen-veg"
  };

  // Common things that aren't recipe ingredients - Rusty still names them.
  var EXTRAS = [
    ["Pepsi (soda)", ["pepsi"]], ["Coca-Cola (soda)", ["coca cola", "coke"]], ["Sprite (soda)", ["sprite"]],
    ["Mountain Dew (soda)", ["mountain dew", "mtn dew"]], ["Dr Pepper (soda)", ["dr pepper"]], ["Fanta (soda)", ["fanta"]],
    ["Gatorade", ["gatorade"]], ["Red Bull", ["red bull"]], ["Monster Energy", ["monster"]],
    ["Soda", ["soda", "cola", "diet", "zero sugar", "caffeine free"]], ["Water", ["spring water", "water"]],
    ["Coffee", ["coffee", "folgers", "maxwell house", "starbucks", "k cup"]], ["Tea", ["tea", "lipton"]],
    ["Juice", ["juice"]], ["Beer", ["beer", "lager"]], ["Wine", ["wine"]],
    ["Cereal", ["cereal", "cheerios", "frosted flakes", "corn flakes", "froot loops", "lucky charms", "cinnamon toast crunch", "raisin bran", "kelloggs", "general mills"]],
    ["Chips", ["chips", "doritos", "lays", "pringles", "cheetos", "fritos", "ruffles"]],
    ["Cookies", ["cookies", "oreo", "chips ahoy", "nutter butter"]], ["Crackers", ["crackers", "ritz", "goldfish", "cheez it", "triscuit", "saltines"]],
    ["Popcorn", ["popcorn"]], ["Granola bars", ["granola", "nature valley", "clif"]], ["Candy", ["candy", "skittles", "m ms", "snickers", "reeses", "hershey"]],
    ["Soup", ["soup", "campbells", "progresso"]], ["Mac and cheese box", ["kraft", "easy mac"]], ["Baked beans", ["baked beans", "bushs"]],
    ["Corn (canned)", ["whole kernel", "golden corn", "cream style"]], ["Applesauce", ["applesauce", "apple sauce"]], ["Jelly / jam", ["jelly", "jam", "preserves", "smuckers"]],
    ["Syrup", ["syrup", "maple"]], ["Vanilla extract", ["vanilla"]], ["Pickles", ["pickles", "pickle"]], ["Hot sauce", ["hot sauce", "tabasco", "sriracha", "franks"]],
    ["BBQ sauce", ["bbq", "barbecue"]], ["Ranch dressing", ["ranch"]], ["Salad dressing", ["dressing", "vinaigrette"]], ["Nutella", ["nutella"]]
  ];
  function matchExtras(text) {
    var t = norm(text), out = [];
    EXTRAS.forEach(function (e) {
      e[1].forEach(function (w) {
        var needle = " " + w + " ", idx;
        while ((idx = t.indexOf(needle)) !== -1) {
          if (out.indexOf(e[0]) === -1) out.push(e[0]);
          t = t.slice(0, idx) + " " + t.slice(idx + needle.length);
        }
      });
    });
    return out;
  }

  // ---------- helpers ----------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function norm(s) {
    return " " + String(s).toLowerCase().replace(/['’]/g, "").replace(/[^a-z]+/g, " ").replace(/\s+/g, " ").trim() + " ";
  }
  function lev1(a, b) { // true if edit distance <= 1
    if (a === b) return true;
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    var i = 0, j = 0, diff = 0;
    while (i < la && j < lb) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++diff > 1) return false;
      if (la > lb) i++; else if (lb > la) j++; else { i++; j++; }
    }
    return diff + (la - i) + (lb - j) <= 1;
  }

  // Returns the list of pantry keys mentioned in the text.
  function matchText(text) {
    var t = norm(text), found = [];
    WORDS.forEach(function (entry) {
      var key = entry[0], hit = false;
      entry[1].forEach(function (w) {
        var needle = " " + w + " ", idx;
        while ((idx = t.indexOf(needle)) !== -1) {
          hit = true;
          t = t.slice(0, idx) + " " + new Array(needle.length - 1).join("_") + " " + t.slice(idx + needle.length);
        }
        // Fuzzy match long single words, because OCR on curved cans is messy ("chlckpeas").
        if (!hit && w.indexOf(" ") === -1 && w.length >= 6) {
          var toks = t.split(" ");
          for (var k = 0; k < toks.length; k++) {
            if (toks[k].length >= 5 && lev1(toks[k], w)) { hit = true; toks[k] = "_"; }
          }
          t = toks.join(" ");
        }
      });
      if (hit && key) found.push(key);
    });
    matchText.rest = t; // text left over after ingredient words are used up
    return found;
  }

  var scriptCache = {};
  function loadScript(src) {
    if (!scriptCache[src]) {
      scriptCache[src] = new Promise(function (res, rej) {
        var s = document.createElement("script");
        s.src = src; s.async = true; s.crossOrigin = "anonymous";
        s.onload = res; s.onerror = function () { delete scriptCache[src]; rej(new Error("Could not load " + src)); };
        document.head.appendChild(s);
      });
    }
    return scriptCache[src];
  }

  var ocrWorker = null, visionModel = null;
  function getOcr(onProgress) {
    if (ocrWorker) return Promise.resolve(ocrWorker);
    return loadScript(TESSERACT_URL).then(function () {
      return window.Tesseract.createWorker("eng", 1, {
        logger: function (m) { if (onProgress && m && typeof m.progress === "number") onProgress(m.status, m.progress); }
      });
    }).then(function (w) { ocrWorker = w; return w; });
  }
  function getVision() {
    if (visionModel) return Promise.resolve(visionModel);
    return loadScript(TFJS_URL).then(function () { return loadScript(MOBILENET_URL); })
      .then(function () { return window.mobilenet.load({ version: 2, alpha: 1.0 }); })
      .then(function (m) { visionModel = m; return m; });
  }

  // Shrink big phone photos so OCR is quick, but keep labels readable.
  function fileToCanvas(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var max = 2000, w = img.naturalWidth, h = img.naturalHeight, s = Math.min(1, max / Math.max(w, h));
        var c = document.createElement("canvas");
        c.width = Math.round(w * s); c.height = Math.round(h * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); res(c);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error("That photo couldn't be opened. Try a JPG or PNG.")); };
      img.src = url;
    });
  }

  // ---------- page wiring ----------
  RC_SCAN_init();
  function RC_SCAN_init() {
    var box = document.getElementById("scan-box");
    if (!box) return;
    var statusEl = document.getElementById("scan-status"), resultEl = document.getElementById("scan-result");
    var labels = {}; (window.RC_PANTRY || []).forEach(function (p) { labels[p.k] = p.l; });
    var busy = false;

    function status(html, kind) {
      statusEl.innerHTML = html ? '<p class="scan-msg' + (kind ? " " + kind : "") + '">' + html + "</p>" : "";
    }

    ["scan-camera", "scan-file"].forEach(function (id) {
      var input = document.getElementById(id);
      input.addEventListener("change", function () {
        var f = input.files && input.files[0];
        input.value = "";
        if (f && !busy) scan(f);
      });
    });

    function scan(file) {
      busy = true; box.classList.add("is-busy"); resultEl.innerHTML = "";
      var canvas, preview;
      status("&#129302; Rusty is warming up his robot eyes&hellip;");
      fileToCanvas(file).then(function (c) {
        canvas = c; preview = c.toDataURL("image/jpeg", 0.6);
        var firstTime = !ocrWorker;
        return getOcr(function (st, p) {
          if (/loading|initializ/i.test(st) && firstTime) status("&#129302; Loading Rusty's robot eyes (first time only, about 15&nbsp;MB)&hellip; " + Math.round(p * 100) + "%");
          else if (/recogniz/i.test(st)) status("&#128269; Reading the labels&hellip; " + Math.round(p * 100) + "%");
        });
      }).then(function (worker) {
        status("&#128269; Reading the labels&hellip;");
        return worker.recognize(canvas);
      }).then(function (out) {
        var data = out.data || {}, lines = (data.lines || []).filter(function (l) {
          return l.confidence > 40 && /[a-z]{3}/i.test(l.text);
        });
        // Big text (product names) counts as "found"; small print is only "maybe".
        var heights = lines.map(function (l) { return l.bbox.y1 - l.bbox.y0; }).sort(function (a, b) { return b - a; });
        var ref = heights.length ? heights[Math.min(2, heights.length - 1)] : 0;
        var big = lines.filter(function (l) { return (l.bbox.y1 - l.bbox.y0) >= ref * 0.45; })
          .map(function (l) { return l.text; }).join(" \n ");
        var all = lines.map(function (l) { return l.text; }).join(" \n ");
        var sure = matchText(big), maybe = matchText(all).filter(function (k) { return sure.indexOf(k) === -1; });
        matchText(big); var extras = matchExtras(matchText.rest);
        // Biggest readable words on the photo, shown so you always see what Rusty read.
        var labelText = lines.filter(function (l) { return (l.bbox.y1 - l.bbox.y0) >= ref * 0.6; })
          .map(function (l) { return l.text.replace(/[^A-Za-z0-9&' -]+/g, " ").replace(/\s+/g, " ").trim(); })
          .filter(function (x) { return /[a-z]{3}/i.test(x); }).slice(0, 3).join(" / ");
        var guess = "";

        status("&#128064; Looking at shapes&hellip;");
        return getVision().then(function (m) { return m.classify(canvas, 5); }).catch(function () { return []; })
          .then(function (preds) {
            if (preds[0] && preds[0].probability >= 0.25) guess = String(preds[0].className).split(",")[0];
            preds.forEach(function (p) {
              var name = String(p.className).toLowerCase(), key = null;
              Object.keys(VISION).forEach(function (v) { if (name.split(", ").indexOf(v) !== -1) key = VISION[v]; });
              if (!key) return;
              if (p.probability >= 0.3 && sure.indexOf(key) === -1) { sure.push(key); maybe = maybe.filter(function (k) { return k !== key; }); }
              else if (p.probability >= 0.1 && sure.indexOf(key) === -1 && maybe.indexOf(key) === -1) maybe.push(key);
            });
            show(preview, sure, maybe, extras, labelText, guess);
          });
      }).catch(function (err) {
        status("&#9888;&#65039; " + esc(err && err.message ? err.message : "Something went wrong.") +
          " Check your connection and try again.", "error");
      }).then(function () { busy = false; box.classList.remove("is-busy"); });
    }

    function chip(k, checked) {
      return '<label class="scan-chip"><input type="checkbox" value="' + esc(k) + '"' + (checked ? " checked" : "") + "> " +
        esc(labels[k] || k) + "</label>";
    }

    function show(preview, sure, maybe, extras, labelText, guess) {
      status("");
      var html = '<div class="scan-card"><img class="scan-thumb" src="' + preview + '" alt="Your photo">' + '<div class="scan-found">';
      var other = "";
      if (extras.length) other += "<h3>" + (sure.length ? "Rusty also sees:" : "Rusty sees:") + '</h3><div class="scan-chips">' +
        extras.map(function (x) { return '<span class="scan-chip scan-chip-info">' + esc(x) + "</span>"; }).join("") + "</div>" +
        '<p class="scan-maybe-h">' + (extras.length > 1 ? "These aren't" : "That isn't") + " used in any of our recipes, so there's nothing to tick.</p>";
      else if (!sure.length && !maybe.length && (labelText || guess)) other += "<h3>Rusty isn't sure what this is.</h3>" +
        (labelText ? '<p class="scan-maybe-h">The label seems to say: <strong>&ldquo;' + esc(labelText) + "&rdquo;</strong></p>" : "") +
        (guess ? '<p class="scan-maybe-h">It looks a bit like: <strong>' + esc(guess) + "</strong></p>" : "");
      if (!sure.length && !maybe.length) {
        html += other || ("<h3>Hmm, Rusty couldn't make anything out.</h3>" +
          '<p class="muted">Try again closer up, with the label facing the camera and good light. ' +
          "One or two items per photo works best. You can also tick items by hand below.</p>");
      } else {
        if (sure.length) html += "<h3>Rusty spotted:</h3><div class=\"scan-chips\">" + sure.map(function (k) { return chip(k, true); }).join("") + "</div>";
        if (maybe.length) html += '<p class="scan-maybe-h">Not sure about these (tick any that are right):</p><div class="scan-chips">' +
          maybe.map(function (k) { return chip(k, false); }).join("") + "</div>";
        html += other;
        html += '<p><button class="btn" id="scan-add">Add to my pantry</button> ' +
          '<span class="muted scan-tip">Snap another photo to add more.</span></p>';
      }
      html += "</div></div>";
      resultEl.innerHTML = html;
      var addBtn = document.getElementById("scan-add");
      if (addBtn) addBtn.addEventListener("click", function () {
        var keys = [].map.call(resultEl.querySelectorAll(".scan-chip input:checked"), function (c) { return c.value; });
        if (!keys.length) { status("Tick at least one item first.", "error"); return; }
        if (window.RC && RC.pantryAdd) RC.pantryAdd(keys);
        resultEl.innerHTML = "";
        status("&#9989; Added " + keys.map(function (k) { return esc(labels[k] || k); }).join(", ") +
          '. <a href="#results-heading">See what you can make &darr;</a>', "ok");
      });
    }
  }

  window.RC_SCAN = { matchText: matchText };
})();
