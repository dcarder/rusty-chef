/* ================================================================
   RECEIPT READER for My Kitchen
   Turns the text read from a grocery receipt photo into pantry
   ingredients. Stores shorten names ("GV LG EGGS 18CT", "WHL MLK
   GAL"), so this keeps a list of common receipt abbreviations.
   To teach it a new one, add it under the right key below.
   ================================================================ */
(function () {
  "use strict";

  // Longer phrases are checked first, so "PNT BTR" wins over "BTR" and
  // "CORN STARCH" over "CORN". A null key means "ignore this".
  var WORDS = {
    "peanut-butter": ["peanut butter", "pnt butter", "pnt btr", "peanut btr", "pb creamy", "pb crunchy", "jif", "skippy"],
    "cream-cheese": ["cream cheese", "crm cheese", "crm chs", "cream chs", "philadelphia", "phila"],
    "sour-cream": ["sour cream", "sour crm", "sr crm", "sr cream"],
    "coconut-milk": ["coconut milk", "coconut mlk", "coco milk", "cocnt milk"],
    "orange-juice": ["orange juice", "orng juice", "or juice", "oj", "tropicana", "simply orange"],
    "olive-oil": ["olive oil", "olv oil", "evoo", "xvoo", "ex virgin"],
    "sesame-oil": ["sesame oil", "seasme oil"],
    "tortilla-chips": ["tortilla chips", "tort chips", "tort chip", "tostitos", "corn chips"],
    "sweet-potato": ["sweet potato", "sweet potatoes", "swt potato", "swt pot", "sweet pot", "yams"],
    "green-onion": ["green onion", "green onions", "grn onion", "grn onions", "scallion", "scallions", "bunch onion"],
    "bell-pepper": ["bell pepper", "bell peppers", "bell pep", "grn pepper", "red pepper", "yel pepper", "pepper bell", "peppers"],
    "black-beans": ["black beans", "black bean", "blk beans", "blk bean", "blk bns"],
    "kidney-beans": ["kidney beans", "kidney bean", "kidney"],
    "white-beans": ["cannellini", "great northern", "grt northern", "navy beans", "white beans"],
    "chickpeas": ["chickpeas", "chick peas", "garbanzo", "garbanzos"],
    "canned-tuna": ["tuna"],
    "canned-tomatoes": ["tomato sauce", "tom sauce", "diced tomatoes", "diced tom", "crushed tomatoes", "crshd tom", "tomato paste", "tom paste",
                        "whole tomatoes", "rotel", "pasta sauce", "marinara", "spaghetti sauce", "tomatoes", "tomato"],
    "ground-beef": ["ground beef", "grnd beef", "grd beef", "gr beef", "grnd chuck", "grd chuck", "ground chuck", "hamburger", "80 20", "85 15", "93 7"],
    "chicken": ["chicken breast", "chkn breast", "chk breast", "chkn brst", "bnls brst", "chicken thigh", "chkn thigh", "thighs", "drumsticks",
                "rotisserie", "chicken", "chkn", "chick"],
    "cornstarch": ["corn starch", "cornstarch", "crnstarch"],
    "cornmeal": ["corn meal", "cornmeal", "masa"],
    "corn": ["whole kernel", "sweet corn", "corn"],
    "breadcrumbs": ["bread crumbs", "breadcrumbs", "brd crumbs", "brd crmb", "panko"],
    "baking-powder": ["baking powder", "baking pwd", "bkg powder", "bkg pwdr"],
    "chili-powder": ["chili powder", "chili pwd", "chili pwdr"],
    "curry-powder": ["curry powder", "curry"],
    "dried-herbs": ["italian seasoning", "ital season", "oregano", "basil leaves", "thyme"],
    "frozen-veg": ["mixed vegetables", "mixed veg", "mxd veg", "frz veg", "frozen veg", "stir fry veg", "steamers", "peas", "green beans", "grn beans"],
    "parmesan": ["parmesan", "parm", "parmigiano", "romano"],
    "cheese": ["shredded cheese", "shrd chs", "shred chs", "cheddar", "chdr", "ched", "mozzarella", "mozz", "colby", "monterey", "pepper jack",
               "american slices", "amer slices", "amer chs", "provolone", "swiss", "string chs", "cheese", "chs"],
    "yogurt": ["yogurt", "yoghurt", "ygrt", "yogrt", "greek yog", "chobani", "yoplait"],
    "butter": ["salted butter", "unsalted butter", "unsltd btr", "sltd btr", "butter", "btr", "land o lakes"],
    "milk": ["half and half", "half half", "heavy cream", "hvy cream", "hvy crm", "whip cream", "whipping crm", "whole milk", "whl milk", "whl mlk",
             "2 milk", "1 milk", "skim milk", "milk", "mlk", "creamer"],
    "eggs": ["large eggs", "lg eggs", "lrg eggs", "eggs", "egg lg", "lg egg", "egg"],
    "bacon": ["bacon", "bcn"],
    "sausage": ["sausage", "saus", "ssg", "pepperoni", "pepp", "kielbasa", "brats", "bratwurst", "hot dogs", "franks"],
    "ham": ["deli ham", "sliced ham", "ham"],
    "tortillas": ["flour tortillas", "flr tort", "corn tortillas", "tortillas", "tortilla", "tort"],
    "bread": ["sandwich bread", "white bread", "wht bread", "wht brd", "wheat bread", "whole wheat", "hamburger buns", "hmbrgr bun", "hot dog buns",
              "hot dog bun", "buns", "bagels", "bagel", "english muffin", "rolls", "texas toast", "garlic bread", "bread", "brd"],
    "ramen": ["ramen", "maruchan", "cup noodle", "top ramen"],
    "ravioli": ["ravioli", "tortellini"],
    "pasta": ["spaghetti", "spagh", "penne", "elbow", "elbows", "macaroni", "rigatoni", "rotini", "linguine", "fettuccine", "egg noodles", "noodles", "pasta", "lasagna"],
    "rice": ["jasmine rice", "basmati", "long grain", "lg grain", "rice"],
    "flour": ["all purpose", "ap flour", "flour", "flr"],
    "oats": ["rolled oats", "old fashioned", "oatmeal", "oats", "quaker"],
    "lentils": ["lentils", "lentil"],
    "stock": ["chicken broth", "chkn broth", "beef broth", "veg broth", "broth", "brth", "stock", "bouillon", "swanson"],
    "salsa": ["salsa", "picante"],
    "spinach": ["baby spinach", "bby spinach", "spinach", "spnch"],
    "parsley": ["parsley", "cilantro"],
    "banana": ["bananas", "banana", "banan"],
    "potatoes": ["russet", "yukon", "red potatoes", "potatoes", "potato", "potatos"],
    "onion": ["yellow onion", "yel onion", "red onion", "white onion", "sweet onion", "onions", "onion"],
    "garlic": ["garlic"],
    "carrot": ["baby carrots", "carrots", "carrot"],
    "celery": ["celery"],
    "cabbage": ["cabbage", "coleslaw", "cole slaw"],
    "ginger": ["ginger"],
    "oil": ["vegetable oil", "veg oil", "canola oil", "canola", "crisco", "wesson"],
    "soy-sauce": ["soy sauce", "soy sce", "soy sc", "kikkoman"],
    "ketchup": ["ketchup", "catsup"],
    "mustard": ["mustard", "mstrd", "dijon"],
    "mayo": ["mayonnaise", "mayo", "hellmanns", "dukes"],
    "honey": ["honey"],
    "vinegar": ["vinegar", "lemons", "lemon"],
    "olives": ["olives", "olive"],
    "capers": ["capers"],
    "tahini": ["tahini"],
    "raisins": ["raisins"],
    "cocoa": ["cocoa"],
    "cinnamon": ["cinnamon", "cinn"],
    "cumin": ["cumin"],
    "paprika": ["paprika"],
    "chili-flakes": ["red pepper flakes", "crushed red pepper", "chili flakes"],
    "brown-sugar": ["brown sugar", "brwn sugar", "lt brown sugar", "dk brown sugar"],
    "sugar": ["powdered sugar", "granulated", "gran sugar", "sugar", "sugr"],
    "broccoli": ["broccoli", "brocc", "broc"],
    "steak": ["flank steak", "sirloin", "steak", "stk"],
    "tofu": ["tofu"],
    "peanuts": ["roasted peanuts", "dry roasted", "peanuts", "pnuts"],
    "pineapple": ["pineapple", "pineapl", "pinapl"],
    "graham-crackers": ["graham crackers", "graham crkr", "graham"],
    "condensed-milk": ["sweetened condensed", "condensed milk", "sw cond milk", "eagle brand"],
    "lime-juice": ["key lime juice", "lime juice", "key limes", "limes", "lime"],
    "vanilla": ["vanilla extract", "vanilla ext", "pure vanilla", "vanilla"],
    "enchilada-sauce": ["enchilada sauce", "enchilada sce", "ench sauce", "old el paso ench"],
    "chocolate-chips": ["chocolate chips", "choc chips", "choc chip", "semi sweet morsels", "morsels", "nestle toll house"],
    "baking-soda": ["baking soda", "bkg soda", "arm hammer", "arm & hammer"],
    "salt": ["sea salt", "kosher salt", "iodized", "salt"]
  };
  WORDS[""] = ["salted caramel", "salt and vinegar", "sugar free", "cheese its", "cheez it", "mac and cheese", "pepper jack chips",
               "chips ahoy", "rice krispies", "rice a roni", "egg roll", "egg rolls", "cream soda", "milk chocolate", "peanut m m",
               "dog food", "cat food", "bag fee", "bottle deposit", "black pepper", "ground pepper", "noodle soup", "chicken noodle",
               "corn flakes", "popcorn", "ice cream", "cream of", "cookies", "cookie", "crackers", "cracker", "potato chips", "chips",
               "cheese puffs", "onion rings", "chicken nuggets", "chkn nugget", "frozen pizza", "pizza"];

  // Lines on a receipt that are never groceries.
  var SKIP = /\b(sub ?total|total|tax|visa|mastercard|amex|discover|debit|credit|change due|change|cash|balance|savings|you saved|coupon|thank|store|manager|refund|items sold|approval|approved|auth|terminal|chip read|account|acct|tend|payment|rewards|member|survey|receipt|cashier|register|trans|ref ?#|tc ?#|st ?#|op ?#|te ?#|tr ?#|low prices|walmart|kroger|target|aldi|publix|safeway|costco|www|http)\b/i;

  var LIST = [];
  Object.keys(WORDS).forEach(function (k) { WORDS[k].forEach(function (w) { LIST.push([w, k || null]); }); });
  LIST.sort(function (a, b) { return b[0].length - a[0].length; });

  function norm(s) {
    return " " + String(s).toLowerCase().replace(/[%]/g, " ").replace(/&/g, " and ").replace(/[^a-z]+/g, " ").replace(/\s+/g, " ").trim() + " ";
  }
  function lev1(a, b) {
    if (a === b) return true;
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    var i = 0, j = 0, d = 0;
    while (i < la && j < lb) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++d > 1) return false;
      if (la > lb) i++; else if (lb > la) j++; else { i++; j++; }
    }
    return d + (la - i) + (lb - j) <= 1;
  }

  // Returns { found: [keys], counts: {key: how many lines}, unmatched: [item names that looked like groceries] }
  function parseReceipt(text) {
    var found = [], counts = {}, unmatched = [];
    String(text).split(/\r?\n/).forEach(function (line) {
      if (!/[a-z]{2}/i.test(line) || SKIP.test(line)) return;
      var t = norm(line), hit;
      for (var n = 0; n < LIST.length && hit === undefined; n++) {
        if (t.indexOf(" " + LIST[n][0] + " ") !== -1) hit = LIST[n][1];
      }
      if (hit === undefined) { // forgive one OCR mistake in longer words ("CHICKFN", "BANANAS")
        var toks = t.trim().split(" ");
        for (var m = 0; m < LIST.length && hit === undefined; m++) {
          var w = LIST[m][0];
          if (w.indexOf(" ") !== -1 || w.length < 5) continue;
          for (var q = 0; q < toks.length; q++) if (toks[q].length >= 5 && lev1(toks[q], w)) { hit = LIST[m][1]; break; }
        }
      }
      if (hit) { if (found.indexOf(hit) === -1) found.push(hit); counts[hit] = (counts[hit] || 0) + 1; return; }
      if (hit === null) return;
      // Looks like an item line (has a price) but we don't know it.
      if (/\d+[.,]\d{2}/.test(line)) {
        var name = line.replace(/\d+[.,]\d{2}.*$/, "").replace(/\b\d{5,}\b/g, "").replace(/[^A-Za-z &/%-]+/g, " ").replace(/\s+/g, " ").trim();
        if (name.length >= 3 && unmatched.length < 12) unmatched.push(name);
      }
    });
    return { found: found, counts: counts, unmatched: unmatched };
  }

  if (typeof window !== "undefined") window.RC_RECEIPT = { parse: parseReceipt };
  if (typeof module !== "undefined") module.exports = { parse: parseReceipt };
})();
