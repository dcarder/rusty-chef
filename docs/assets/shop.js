/* The Rusty Chef shop: stock, quantity, shipping address check and order form.
   Orders are sent to the shop email through FormSubmit (formsubmit.co). */
(function () {
  "use strict";
  var form = document.getElementById("order-form");
  if (!form) return;
  var EMAIL = form.getAttribute("data-email");
  var PRICE = parseInt(form.getAttribute("data-price"), 10);
  var TAG = form.getAttribute("data-cashtag");

  var $ = function (id) { return document.getElementById(id); };
  var stock = Math.max(0, parseInt(window.RC_STOCK, 10) || 0);
  var line = $("stock-line"), buy = $("shop-buy"), sold = $("sold-out");
  var qty = $("qty"), total = $("total"), stateSel = $("f-state"), zip = $("f-zip");
  var err = $("form-error"), stateMsg = $("state-msg"), submit = $("order-submit");

  // ---------- stock ----------
  if (stock <= 0) { buy.hidden = true; sold.hidden = false; return; }
  line.hidden = false;
  line.textContent = stock === 1 ? "Only 1 left in this batch!" : "Only " + stock + " left in this batch";
  qty.innerHTML = "";
  for (var i = 1; i <= Math.min(stock, 3); i++) qty.add(new Option(String(i), String(i)));
  function amount() { return (parseInt(qty.value, 10) || 1) * PRICE; }
  function updateTotal() { total.textContent = "$" + amount(); }
  qty.addEventListener("change", updateTotal); updateTotal();

  // ---------- shipping area ----------
  var NO_SHIP = { AK: "Alaska", HI: "Hawaii", PR: "Puerto Rico", GU: "Guam", VI: "the U.S. Virgin Islands",
    AS: "American Samoa", MP: "the Northern Mariana Islands", AA: "military (APO/FPO) addresses",
    AE: "military (APO/FPO) addresses", AP: "military (APO/FPO) addresses", OTHER: "addresses outside the U.S." };
  // ZIP code prefixes outside the continental 48 states (PR/VI, military, Pacific, HI, AK, Guam etc.)
  function zipBlocked(z) {
    var p = parseInt(z.slice(0, 3), 10);
    return (p >= 6 && p <= 9) || (p >= 90 && p <= 98) || p === 340 || (p >= 962 && p <= 969) || p >= 995;
  }
  function cantShip(where) {
    return "Sorry, we can't ship to " + where + " at this time. We only ship to the continental 48 states.";
  }
  function checkState() {
    var s = stateSel.value;
    if (NO_SHIP[s]) { stateMsg.textContent = cantShip(NO_SHIP[s]); stateMsg.hidden = false; submit.disabled = true; return false; }
    stateMsg.hidden = true; submit.disabled = false; return true;
  }
  stateSel.addEventListener("change", checkState);

  // ---------- submit ----------
  function val(id) { return ($(id).value || "").trim(); }
  function showError(msg, field) {
    err.textContent = msg; err.hidden = false;
    if (field) { field.focus(); field.setAttribute("aria-invalid", "true"); }
  }
  form.addEventListener("input", function (ev) { ev.target.removeAttribute("aria-invalid"); err.hidden = true; });

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    err.hidden = true;
    var required = [["f-name", "your full name"], ["f-email", "your email"], ["f-cashapp", "your Cash App name or $Cashtag"],
      ["f-address", "your street address"], ["f-city", "your city"], ["f-state", "your state"], ["f-zip", "your ZIP code"]];
    for (var r = 0; r < required.length; r++) {
      if (!val(required[r][0])) return showError("Please enter " + required[r][1] + ".", $(required[r][0]));
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val("f-email"))) return showError("Please check your email address.", $("f-email"));
    if (!checkState()) return showError(stateMsg.textContent, stateSel);
    var z = val("f-zip");
    if (!/^\d{5}(-\d{4})?$/.test(z)) return showError("Please enter a 5-digit ZIP code.", zip);
    if (zipBlocked(z)) return showError("That ZIP code is outside the continental 48 states. " + cantShip("that address"), zip);
    if ($("f-honey").value) return; // spam bot

    var n = parseInt(qty.value, 10) || 1, t = amount();
    var orderNo = "RC-" + Date.now().toString(36).toUpperCase().slice(-5);
    var data = {
      _subject: "New Rusty Chef order " + orderNo + " ($" + t + ")",
      _template: "table",
      _captcha: "false",
      "Order number": orderNo,
      "Item": "Rusty Chef Phone Holder",
      "Quantity": String(n),
      "Total due": "$" + t + " (Cash App to $" + TAG + ")",
      "Payment": "Waiting for Cash App payment. Check Cash App for " + orderNo,
      "Name": val("f-name"),
      "email": val("f-email"),
      "Phone": val("f-phone") || "-",
      "Cash App name": val("f-cashapp"),
      "Address": val("f-address"),
      "Apt / unit": val("f-address2") || "-",
      "City": val("f-city"),
      "State": stateSel.value,
      "ZIP": z,
      "Notes": val("f-notes") || "-"
    };
    submit.disabled = true; submit.textContent = "Sending your order...";

    function done() {
      buy.hidden = true;
      $("done-order").textContent = orderNo;
      $("done-total").textContent = "$" + t;
      var pay = $("done-pay");
      pay.href = "https://cash.app/$" + TAG + "/" + t;
      pay.textContent = "Pay $" + t + " on Cash App";
      $("order-done").hidden = false;
      $("order-done").scrollIntoView({ behavior: "smooth", block: "start" });
    }
    function fallback() {
      // If the form service can't be reached, open a pre-filled email instead.
      var body = Object.keys(data).filter(function (k) { return k.charAt(0) !== "_"; })
        .map(function (k) { return k + ": " + data[k]; }).join("\n");
      $("done-fallback").hidden = false;
      $("done-fallback-link").href = "mailto:" + EMAIL + "?subject=" + encodeURIComponent(data._subject) + "&body=" + encodeURIComponent(body);
      done();
    }
    fetch("https://formsubmit.co/ajax/" + EMAIL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(data)
    }).then(function (res) { return res.json().catch(function () { return {}; }); })
      .then(function (json) { if (json && String(json.success) === "true") done(); else fallback(); })
      .catch(fallback);
  });
})();
