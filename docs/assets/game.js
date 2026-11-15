/* Rusty Chef: Burger Stack - an original platform game for therustychef.com */
(function () {
  "use strict";
  var canvas = document.getElementById("game");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");

  // ---------- world constants ----------
  var W = 320, H = 430;
  var FLOORS = [78, 146, 214, 282, 350];   // y of each walkway (top to bottom)
  var PLATE_Y = 412;
  var LEFT = 10, RIGHT = 310;
  var COLS = [52, 124, 196, 268];           // burger columns (x centers)
  var PIECE_W = 52, SEG = PIECE_W / 4, PIECE_H = 8;
  var CHEF_SPEED = 62, LADDER_TOL = 9;

  // Two layouts that alternate between levels
  var MAPS = [
    {
      ladders: [[18, 0, 4], [88, 0, 1], [88, 2, 4], [160, 0, 2], [160, 3, 4], [232, 1, 3], [232, 0, 1], [302, 0, 4]],
      stacks: [["topbun", "lettuce", "patty", "bottombun"], ["topbun", "cheese", "patty", "bottombun"],
               ["topbun", "tomato", "patty", "bottombun"], ["topbun", "lettuce", "patty", "bottombun"]]
    },
    {
      ladders: [[18, 0, 2], [18, 3, 4], [88, 0, 4], [160, 1, 3], [160, 0, 1], [160, 3, 4], [232, 0, 4], [302, 0, 1], [302, 2, 4], [302, 1, 2]],
      stacks: [["topbun", "cheese", "patty", "bottombun"], ["topbun", "lettuce", "tomato", "bottombun"],
               ["topbun", "cheese", "patty", "bottombun"], ["topbun", "tomato", "lettuce", "bottombun"]]
    }
  ];

  var COLORS = {
    topbun: "#d99a4e", bottombun: "#c8843c", lettuce: "#5bb04a", patty: "#6b3b1f", cheese: "#f2c230", tomato: "#d9432f"
  };

  // ---------- state ----------
  var state = "title"; // title | play | paused | dying | levelup | over
  var level = 1, score = 0, lives = 3, oil = 4, hi = 0, muted = false;
  var chef, enemies, pieces, ladders, sprays, popups, timer = 0, flash = 0;
  try { hi = +localStorage.getItem("rc_game_hi") || 0; muted = localStorage.getItem("rc_game_muted") === "1"; } catch (e) {}

  var input = { left: false, right: false, up: false, down: false };

  // ---------- sound ----------
  var actx = null;
  function sound(freq, dur, type, slide) {
    if (muted) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      var o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
      o.type = type || "square"; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur);
    } catch (e) {}
  }

  // ---------- helpers ----------
  function floorAt(y) {
    for (var i = 0; i < FLOORS.length; i++) if (Math.abs(y - FLOORS[i]) < 0.01) return i;
    return -1;
  }
  function ladderOn(x, y) { // ladder the entity is standing in (between floors)
    for (var i = 0; i < ladders.length; i++) {
      var L = ladders[i];
      if (Math.abs(L.x - x) < 0.01 && y >= FLOORS[L.top] && y <= FLOORS[L.bottom]) return L;
    }
    return null;
  }
  function ladderFrom(x, f, dir, tol) { // ladder usable from floor f going up(-1)/down(+1)
    var best = null, bd = 1e9;
    for (var i = 0; i < ladders.length; i++) {
      var L = ladders[i], d = Math.abs(L.x - x);
      if (d > tol) continue;
      var ok = dir < 0 ? (L.top < f && L.bottom >= f) : (L.bottom > f && L.top <= f);
      if (ok && d < bd) { best = L; bd = d; }
    }
    return best;
  }

  // Moves an entity one step. dir: "left" | "right" | "up" | "down". Returns true if it moved.
  function step(e, dir, dist, tol) {
    var f = floorAt(e.y);
    if (dir === "left" || dir === "right") {
      if (f < 0) return false;
      var nx = e.x + (dir === "left" ? -dist : dist);
      if (nx < LEFT || nx > RIGHT) { e.x = Math.max(LEFT, Math.min(RIGHT, nx)); return false; }
      e.x = nx; e.facing = dir; return true;
    }
    var vdir = dir === "up" ? -1 : 1, L;
    if (f >= 0) {
      L = ladderFrom(e.x, f, vdir, tol);
      if (!L) return false;
      e.x = L.x;
    } else {
      L = ladderOn(e.x, e.y);
      if (!L) return false;
    }
    var oy = e.y, ny = e.y + vdir * dist;
    ny = Math.max(FLOORS[L.top], Math.min(FLOORS[L.bottom], ny));
    for (var k = L.top; k <= L.bottom; k++) {
      var fy = FLOORS[k];
      if (vdir > 0 ? (fy > oy && fy <= ny) : (fy < oy && fy >= ny)) { ny = fy; break; }
    }
    e.y = ny; return ny !== oy;
  }

  // ---------- setup ----------
  function buildLevel() {
    var map = MAPS[(level - 1) % MAPS.length];
    ladders = map.ladders.map(function (l) { return { x: l[0], top: l[1], bottom: l[2] }; });
    pieces = [];
    map.stacks.forEach(function (stack, c) {
      stack.forEach(function (type, f) {
        pieces.push({ col: c, x: COLS[c], y: FLOORS[f], type: type, state: "rest", stepped: [0, 0, 0, 0], vy: 0 });
      });
    });
    resetActors();
  }
  function resetActors() {
    chef = { x: 160, y: FLOORS[4], facing: "right", walk: 0, stun: 0 };
    enemies = [];
    var n = Math.min(5, 2 + Math.floor((level - 1) / 2));
    var kinds = ["blob", "fork", "onion"];
    for (var i = 0; i < n; i++) {
      enemies.push({ kind: kinds[i % 3], x: i % 2 ? RIGHT : LEFT, y: FLOORS[i % 2 ? 0 : 1], dir: i % 2 ? "left" : "right",
        facing: "right", stun: 0, dead: 0, delay: 1.2 + i * 1.6, lastKey: null, walk: 0 });
    }
    sprays = []; popups = [];
  }
  function newGame() {
    level = 1; score = 0; lives = 3; oil = 4;
    buildLevel(); state = "play"; sound(523, 0.12); sound(784, 0.2);
  }

  // ---------- update ----------
  function enemySpeed() { return Math.min(58, 38 + level * 3.5); }

  function updateChef(dt) {
    var dist = CHEF_SPEED * dt, moved = false;
    var f = floorAt(chef.y);
    if (input.up || input.down) {
      moved = step(chef, input.up ? "up" : "down", dist, LADDER_TOL);
      // slide toward a nearby ladder to make phone controls forgiving
      if (!moved && f >= 0) {
        var L = ladderFrom(chef.x, f, input.up ? -1 : 1, 22);
        if (L) { chef.x += Math.sign(L.x - chef.x) * Math.min(dist, Math.abs(L.x - chef.x)); moved = true; }
      }
    }
    if (!moved && (input.left || input.right)) {
      moved = step(chef, input.left ? "left" : "right", dist, LADDER_TOL);
      // finish climbing to the nearest floor if a side key is held on a ladder
      if (!moved && floorAt(chef.y) < 0) {
        var Lo = ladderOn(chef.x, chef.y);
        if (Lo) {
          var up = chef.y - FLOORS.filter(function (y) { return y < chef.y; }).pop();
          step(chef, up < 34 ? "up" : "down", dist, 0); moved = true;
        }
      }
    }
    if (moved) chef.walk += dt * 10;

    // walking over burger pieces
    f = floorAt(chef.y);
    if (f >= 0) pieces.forEach(function (p) {
      if (p.state !== "rest" || Math.abs(p.y - chef.y) > 0.01) return;
      for (var s = 0; s < 4; s++) {
        var sx = p.x - PIECE_W / 2 + SEG * s + SEG / 2;
        if (!p.stepped[s] && Math.abs(chef.x - sx) < SEG / 2 + 1) { p.stepped[s] = 1; score += 10; sound(300 + s * 60, 0.05); }
      }
      if (p.stepped.every(Boolean)) dropPiece(p);
    });
  }

  function dropPiece(p) {
    p.state = "fall"; p.vy = 40; p.stepped = [0, 0, 0, 0]; score += 50;
    sound(440, 0.25, "triangle", 160);
  }

  function updatePieces(dt) {
    pieces.forEach(function (p) {
      if (p.state !== "fall") return;
      var oy = p.y;
      p.vy = Math.min(220, p.vy + 500 * dt);
      p.y += p.vy * dt;
      // squash enemies under the falling piece
      enemies.forEach(function (e) {
        if (e.dead || e.delay > 0) return;
        if (Math.abs(e.x - p.x) < PIECE_W / 2 + 4 && e.y > oy - 4 && e.y - 14 < p.y) {
          e.dead = 3.5; score += 500; addPopup(e.x, e.y - 20, "500"); sound(200, 0.3, "sawtooth", 60);
        }
      });
      // hit a resting piece below? it falls and this one takes its place
      for (var i = 0; i < pieces.length; i++) {
        var q = pieces[i];
        if (q !== p && q.col === p.col && q.state === "rest" && q.y > oy && q.y <= p.y) {
          p.y = q.y; p.state = "rest"; p.vy = 0; dropPiece(q); return;
        }
      }
      // land on the plate stack
      var stack = pieces.filter(function (q) { return q.col === p.col && q.state === "plated"; }).length;
      var top = PLATE_Y - 4 - stack * (PIECE_H + 1);
      if (p.y >= top) {
        p.y = top; p.state = "plated"; score += 100; sound(660, 0.08); addPopup(p.x, top - 12, "100");
      }
    });
    if (state === "play" && pieces.every(function (p) { return p.state === "plated"; })) {
      state = "levelup"; timer = 2.6; score += 1000 + level * 250; oil = Math.min(9, oil + 1);
      [523, 659, 784, 1047].forEach(function (f, i) { setTimeout(function () { sound(f, 0.15); }, i * 120); });
    }
  }

  function decide(e, f, options) {
    var pick;
    var chefF = floorAt(chef.y), sameFloor = chefF === f;
    var pref = [];
    if (!sameFloor) {
      var want = chef.y < e.y ? "up" : "down";
      if (options.indexOf(want) >= 0) pref.push(want);
    }
    var hdir = chef.x < e.x ? "left" : "right";
    if (options.indexOf(hdir) >= 0) pref.push(hdir);
    if (pref.length && Math.random() > 0.22) pick = pref[0];
    else pick = options[Math.floor(Math.random() * options.length)];
    return pick;
  }

  function updateEnemies(dt) {
    var spd = enemySpeed() * dt;
    enemies.forEach(function (e) {
      if (e.delay > 0) { e.delay -= dt; return; }
      if (e.dead > 0) {
        e.dead -= dt;
        if (e.dead <= 0) { e.dead = 0; e.x = Math.random() < 0.5 ? LEFT : RIGHT; e.y = FLOORS[Math.random() < 0.5 ? 0 : 4]; e.dir = e.x === LEFT ? "right" : "left"; e.lastKey = null; }
        return;
      }
      if (e.stun > 0) { e.stun -= dt; return; }
      var f = floorAt(e.y);
      if (f >= 0) {
        var options = [], key = null;
        ladders.forEach(function (L) {
          if (Math.abs(L.x - e.x) <= spd + 0.01) {
            if (L.top < f && L.bottom >= f && options.indexOf("up") < 0) options.push("up");
            if (L.bottom > f && L.top <= f && options.indexOf("down") < 0) options.push("down");
            key = f + ":" + L.x;
          }
        });
        if (e.x > LEFT + 0.5) options.push("left");
        if (e.x < RIGHT - 0.5) options.push("right");
        var atEnd = e.x <= LEFT + 0.5 || e.x >= RIGHT - 0.5;
        if (atEnd) key = key || f + ":end:" + Math.round(e.x);
        var blocked = (e.dir === "up" || e.dir === "down") ? options.indexOf(e.dir) < 0 : (e.dir === "left" ? e.x <= LEFT + 0.5 : e.x >= RIGHT - 0.5);
        if ((key && key !== e.lastKey) || blocked) {
          var avoid = { left: "right", right: "left", up: "down", down: "up" }[e.dir];
          var opts = options.length > 1 ? options.filter(function (o) { return o !== avoid; }) : options;
          e.dir = decide(e, f, opts.length ? opts : options);
          if ((e.dir === "up" || e.dir === "down")) {
            var L2 = ladderFrom(e.x, f, e.dir === "up" ? -1 : 1, spd + 0.01); if (L2) e.x = L2.x;
          }
        }
        e.lastKey = key;
      }
      if (step(e, e.dir, spd, 0.01)) e.walk += dt * 9;
      if (e.dir === "left" || e.dir === "right") e.facing = e.dir;

      // caught the chef?
      if (state === "play" && Math.abs(e.x - chef.x) < 11 && Math.abs(e.y - chef.y) < 12) {
        state = "dying"; timer = 1.8; sound(400, 0.8, "sawtooth", 50);
      }
    });
  }

  function spray() {
    if (state !== "play") return;
    if (oil <= 0) { sound(120, 0.1); return; }
    oil--; sound(900, 0.25, "sawtooth", 300);
    var dir = chef.facing === "left" ? -1 : 1;
    sprays.push({ x: chef.x, y: chef.y, dir: dir, t: 0.4 });
    enemies.forEach(function (e) {
      if (e.dead || e.delay > 0) return;
      var dx = (e.x - chef.x) * dir;
      if (dx > -6 && dx < 56 && Math.abs(e.y - chef.y) < 16) { e.stun = 3.2; addPopup(e.x, e.y - 22, "!"); }
    });
  }

  function addPopup(x, y, text) { popups.push({ x: x, y: y, text: text, t: 1 }); }

  function update(dt) {
    flash += dt;
    sprays.forEach(function (s) { s.t -= dt; }); sprays = sprays.filter(function (s) { return s.t > 0; });
    popups.forEach(function (p) { p.t -= dt; p.y -= 18 * dt; }); popups = popups.filter(function (p) { return p.t > 0; });
    if (state === "play") {
      updateChef(dt); updatePieces(dt);
      if (state === "play") updateEnemies(dt);
    } else if (state === "dying") {
      timer -= dt;
      if (timer <= 0) {
        lives--;
        if (lives <= 0) {
          state = "over";
          if (score > hi) { hi = score; try { localStorage.setItem("rc_game_hi", hi); } catch (e) {} }
        } else { resetActors(); state = "play"; }
      }
    } else if (state === "levelup") {
      updatePieces(0);
      timer -= dt;
      if (timer <= 0) { level++; buildLevel(); state = "play"; }
    }
    if (score > hi && state !== "title") hi = score;
  }

  // ---------- drawing ----------
  function rr(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function drawBackground() {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#2b2522"); g.addColorStop(1, "#3a2f2a");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // tiles
    ctx.strokeStyle = "rgba(255,255,255,0.03)"; ctx.lineWidth = 1;
    for (var x = 0; x < W; x += 20) { ctx.beginPath(); ctx.moveTo(x, 30); ctx.lineTo(x, H); ctx.stroke(); }
    for (var y = 30; y < H; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    // ladders
    ladders.forEach(function (L) {
      var y1 = FLOORS[L.top] - 2, y2 = FLOORS[L.bottom];
      ctx.strokeStyle = "#8f8a86"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(L.x - 7, y1); ctx.lineTo(L.x - 7, y2); ctx.moveTo(L.x + 7, y1); ctx.lineTo(L.x + 7, y2); ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = "#b07a4f";
      for (var y = y1 + 6; y < y2; y += 9) { ctx.beginPath(); ctx.moveTo(L.x - 7, y); ctx.lineTo(L.x + 7, y); ctx.stroke(); }
    });
    // girders (rusty walkways)
    FLOORS.forEach(function (fy) {
      ctx.fillStyle = "#b7472a"; ctx.fillRect(LEFT - 8, fy, RIGHT - LEFT + 16, 5);
      ctx.fillStyle = "#8a3320"; ctx.fillRect(LEFT - 8, fy + 5, RIGHT - LEFT + 16, 2);
      ctx.fillStyle = "#e07a52";
      for (var x = LEFT - 4; x < RIGHT + 8; x += 16) ctx.fillRect(x, fy + 1, 2, 2);
    });
    // plates
    COLS.forEach(function (cx) {
      ctx.fillStyle = "#d9d4cf"; ctx.beginPath(); ctx.ellipse(cx, PLATE_Y + 3, 32, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#a9a29c"; ctx.fillRect(cx - 32, PLATE_Y + 3, 64, 2);
    });
  }

  function drawPiece(p) {
    var x0 = p.x - PIECE_W / 2, c = COLORS[p.type];
    for (var s = 0; s < 4; s++) {
      var x = x0 + s * SEG, y = p.y - PIECE_H + (p.stepped[s] ? 3 : 0);
      ctx.fillStyle = c;
      if (p.type === "topbun") {
        rr(x, y - 3, SEG + 0.5, PIECE_H + 3, s === 0 || s === 3 ? 5 : 1); ctx.fill();
        ctx.fillStyle = "#f6e6c4"; ctx.fillRect(x + 3, y - 1, 2, 1.5); ctx.fillRect(x + 8, y + 1, 2, 1.5);
      } else if (p.type === "lettuce") {
        ctx.beginPath(); ctx.moveTo(x, y + 2);
        for (var i = 0; i <= SEG; i += 3.25) ctx.lineTo(x + i, y + (i % 6.5 < 3 ? 0 : 3));
        ctx.lineTo(x + SEG + 0.5, y + PIECE_H - 1); ctx.lineTo(x, y + PIECE_H - 1); ctx.closePath(); ctx.fill();
      } else if (p.type === "cheese") {
        ctx.fillRect(x, y + 1, SEG + 0.5, 4);
        ctx.beginPath(); ctx.moveTo(x + 2, y + 5); ctx.lineTo(x + 6, y + 9); ctx.lineTo(x + 10, y + 5); ctx.fill();
      } else if (p.type === "tomato") {
        rr(x + 0.5, y + 1, SEG - 1, PIECE_H - 2, 3); ctx.fill();
        ctx.fillStyle = "#f08a7a"; ctx.fillRect(x + 4, y + 3, 4, 1.5);
      } else if (p.type === "patty") {
        rr(x, y, SEG + 0.5, PIECE_H, s === 0 || s === 3 ? 3 : 0); ctx.fill();
        ctx.fillStyle = "#4a2814"; ctx.fillRect(x + 2, y + 2, 3, 1.5); ctx.fillRect(x + 8, y + 5, 3, 1.5);
      } else {
        rr(x, y, SEG + 0.5, PIECE_H, s === 0 || s === 3 ? 3 : 0); ctx.fill();
      }
    }
  }

  function drawChef() {
    var x = chef.x, y = chef.y, bob = Math.sin(chef.walk) * 1.2, onLadder = floorAt(y) < 0;
    var dying = state === "dying";
    ctx.save(); ctx.translate(x, y);
    if (dying) ctx.rotate(Math.sin(flash * 20) * 0.3);
    // legs
    ctx.fillStyle = "#6b625d";
    ctx.fillRect(-5, -6 + (onLadder ? bob : 0), 3, 6 - (onLadder ? 0 : bob)); ctx.fillRect(2, -6 - (onLadder ? bob : 0), 3, 6 + (onLadder ? 0 : bob));
    // body
    ctx.fillStyle = "#c06a3a"; rr(-7, -17, 14, 11, 2); ctx.fill();
    ctx.fillStyle = "#8a3320"; ctx.fillRect(-7, -9, 14, 2);
    ctx.fillStyle = "#e9e1d8"; ctx.fillRect(-5, -15, 10, 5); // apron
    // head
    ctx.fillStyle = "#9aa0a6"; rr(-6, -26, 12, 9, 2); ctx.fill();
    ctx.fillStyle = dying ? "#ff5a3c" : "#7fe3ff";
    var fx = chef.facing === "left" ? -1 : 1;
    if (!onLadder) { ctx.fillRect(-3 + fx, -23, 2, 2); ctx.fillRect(2 + fx, -23, 2, 2); }
    // rust spots
    ctx.fillStyle = "#b7472a"; ctx.fillRect(-5, -20, 2, 2);
    // chef hat
    ctx.fillStyle = "#ffffff"; ctx.fillRect(-6, -29, 12, 3);
    ctx.beginPath(); ctx.arc(-3, -31, 3.5, 0, Math.PI * 2); ctx.arc(3, -31, 3.5, 0, Math.PI * 2); ctx.arc(0, -33, 4, 0, Math.PI * 2); ctx.fill();
    // oil can arm
    ctx.fillStyle = "#d8b24a"; ctx.fillRect(fx > 0 ? 6 : -10, -15, 4, 5);
    ctx.restore();
  }

  function drawEnemy(e) {
    if (e.delay > 0) return;
    var x = e.x, y = e.y, wob = Math.sin(e.walk) * 1.5;
    ctx.save(); ctx.translate(x, y);
    if (e.dead > 0) { ctx.globalAlpha = Math.max(0, (e.dead - 2.5)); ctx.scale(1.4, 0.3); }
    if (e.stun > 0) ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(flash * 10));
    var fx = e.facing === "left" ? -1 : 1;
    if (e.kind === "blob") {
      ctx.fillStyle = "#d4b24c";
      ctx.beginPath(); ctx.moveTo(-9, 0); ctx.quadraticCurveTo(-10, -18, 0, -18 + wob); ctx.quadraticCurveTo(10, -18, 9, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#b08f2f"; ctx.fillRect(-9, -2, 18, 2);
    } else if (e.kind === "fork") {
      ctx.fillStyle = "#c9ced3";
      ctx.fillRect(-2, -12, 4, 12);
      ctx.fillRect(-7, -16, 14, 4);
      for (var t = -7; t <= 5; t += 4) ctx.fillRect(t, -24 + (t === -3 || t === 1 ? wob * 0.5 : 0), 2, 9);
    } else {
      ctx.fillStyle = "#9b5fb4";
      ctx.beginPath(); ctx.ellipse(0, -9, 9, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-3, -16); ctx.quadraticCurveTo(0, -24 + wob, 3, -16); ctx.fill();
      ctx.strokeStyle = "#c48ad8"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -17); ctx.quadraticCurveTo(-5, -9, 0, -1); ctx.stroke();
    }
    // angry eyes
    var ey = e.kind === "fork" ? -10 : -11;
    ctx.fillStyle = "#fff"; ctx.fillRect(-5 + fx, ey, 4, 4); ctx.fillRect(1 + fx, ey, 4, 4);
    ctx.fillStyle = "#1a1a1a"; ctx.fillRect(-4 + fx * 2, ey + 1, 2, 2); ctx.fillRect(2 + fx * 2, ey + 1, 2, 2);
    ctx.strokeStyle = "#1a1a1a"; ctx.lineWidth = 1.5; ctx.beginPath();
    ctx.moveTo(-6, ey - 2); ctx.lineTo(-1, ey - 0.5); ctx.moveTo(6, ey - 2); ctx.lineTo(1, ey - 0.5); ctx.stroke();
    if (e.stun > 0) { ctx.globalAlpha = 1; ctx.fillStyle = "#f2c230"; ctx.font = "bold 9px sans-serif"; ctx.textAlign = "center"; ctx.fillText("✦ ✦", 0, -26); }
    ctx.restore();
  }

  function drawHUD() {
    ctx.fillStyle = "#1c1816"; ctx.fillRect(0, 0, W, 28);
    ctx.font = "bold 11px system-ui, sans-serif"; ctx.textBaseline = "middle"; ctx.textAlign = "left";
    ctx.fillStyle = "#f08a5d"; ctx.fillText("SCORE", 8, 9); ctx.fillStyle = "#fff"; ctx.fillText(score, 8, 21);
    ctx.fillStyle = "#f08a5d"; ctx.fillText("HI", 78, 9); ctx.fillStyle = "#fff"; ctx.fillText(hi, 78, 21);
    ctx.fillStyle = "#f08a5d"; ctx.fillText("LEVEL", 138, 9); ctx.fillStyle = "#fff"; ctx.fillText(level, 138, 21);
    ctx.fillStyle = "#f08a5d"; ctx.fillText("OIL", 190, 9);
    for (var i = 0; i < Math.min(oil, 6); i++) { ctx.fillStyle = "#d8b24a"; ctx.fillRect(190 + i * 7, 17, 5, 8); }
    if (oil > 6) { ctx.fillStyle = "#fff"; ctx.fillText("+" + (oil - 6), 233, 21); }
    ctx.fillStyle = "#f08a5d"; ctx.fillText("LIVES", 258, 9);
    for (var j = 0; j < lives; j++) {
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(262 + j * 12, 21, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(258 + j * 12, 22, 8, 3);
    }
  }

  function overlay(title, lines, color) {
    ctx.fillStyle = "rgba(20,16,14,0.78)"; ctx.fillRect(0, 28, W, H - 28);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = color || "#f08a5d"; ctx.font = "bold 26px system-ui, sans-serif"; ctx.fillText(title, W / 2, 170);
    ctx.fillStyle = "#f3e9e0"; ctx.font = "13px system-ui, sans-serif";
    lines.forEach(function (l, i) { ctx.fillText(l, W / 2, 205 + i * 20); });
  }

  function draw() {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawBackground();
    pieces.forEach(drawPiece);
    enemies.forEach(drawEnemy);
    sprays.forEach(function (s) {
      ctx.save(); ctx.globalAlpha = Math.min(1, s.t * 3);
      for (var i = 0; i < 10; i++) {
        var d = (0.4 - s.t) * 140 * (0.4 + (i % 5) / 5), off = ((i * 37) % 11) - 5;
        ctx.fillStyle = i % 2 ? "#f2d77a" : "#d8b24a";
        ctx.beginPath(); ctx.arc(s.x + s.dir * (10 + d), s.y - 13 + off, 2.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    });
    drawChef();
    popups.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.t); ctx.fillStyle = "#fff"; ctx.font = "bold 10px system-ui, sans-serif"; ctx.textAlign = "center";
      ctx.fillText(p.text, p.x, p.y); ctx.globalAlpha = 1;
    });
    drawHUD();
    if (state === "title") overlay("BURGER STACK", ["Walk across every burger piece", "to drop it down to the plates.", "Spray oil to stop the kitchen pests.", "", "Tap START to play"]);
    else if (state === "paused") overlay("PAUSED", ["Tap START to keep cooking"]);
    else if (state === "levelup") overlay("ORDER UP!", ["Level " + level + " complete", "+1 oil can"], "#7fe37f");
    else if (state === "over") overlay("GAME OVER", ["Score: " + score, "Best: " + hi, "", "Tap START to play again"]);
  }

  // ---------- loop & sizing ----------
  var scale = 1, last = 0;
  function resize() {
    var cssW = canvas.clientWidth || W, dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssW * dpr * H / W);
    scale = canvas.width / W;
  }
  function frame(t) {
    var dt = Math.min(0.05, (t - last) / 1000 || 0); last = t;
    update(dt); draw();
    requestAnimationFrame(frame);
  }

  // ---------- controls ----------
  function startPause() {
    try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.resume) actx.resume(); } catch (e) {}
    if (state === "title" || state === "over") {
      newGame();
      try { var top = canvas.getBoundingClientRect().top + window.scrollY - 70; if (Math.abs(window.scrollY - top) > 20) window.scrollTo({ top: top, behavior: "smooth" }); } catch (e) {}
    }
    else if (state === "play") state = "paused";
    else if (state === "paused") state = "play";
    updateButtons();
  }
  function updateButtons() {
    var sb = document.getElementById("g-start");
    if (sb) sb.textContent = state === "play" ? "Pause" : (state === "paused" ? "Resume" : "Start");
    var mb = document.getElementById("g-mute");
    if (mb) mb.textContent = muted ? "Sound: off" : "Sound: on";
  }
  var KEYS = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right",
    ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down" };
  document.addEventListener("keydown", function (ev) {
    if (KEYS[ev.key]) { input[KEYS[ev.key]] = true; ev.preventDefault(); }
    else if (ev.key === " " || ev.key === "x" || ev.key === "X") { spray(); ev.preventDefault(); }
    else if (ev.key === "Enter" || ev.key === "p" || ev.key === "P") { startPause(); ev.preventDefault(); }
  });
  document.addEventListener("keyup", function (ev) { if (KEYS[ev.key]) input[KEYS[ev.key]] = false; });

  document.querySelectorAll("[data-pad]").forEach(function (b) {
    var dir = b.getAttribute("data-pad");
    var on = function (ev) { ev.preventDefault(); input[dir] = true; b.classList.add("pressed"); if (b.setPointerCapture && ev.pointerId !== undefined) try { b.setPointerCapture(ev.pointerId); } catch (e) {} };
    var off = function (ev) { ev.preventDefault(); input[dir] = false; b.classList.remove("pressed"); };
    b.addEventListener("pointerdown", on); b.addEventListener("pointerup", off);
    b.addEventListener("pointercancel", off); b.addEventListener("lostpointercapture", off);
    b.addEventListener("contextmenu", function (ev) { ev.preventDefault(); });
  });
  var sprayBtn = document.getElementById("g-spray");
  if (sprayBtn) sprayBtn.addEventListener("pointerdown", function (ev) { ev.preventDefault(); spray(); });
  var startBtn = document.getElementById("g-start");
  if (startBtn) startBtn.addEventListener("click", startPause);
  canvas.addEventListener("click", function () { if (state !== "play") startPause(); });
  var muteBtn = document.getElementById("g-mute");
  if (muteBtn) muteBtn.addEventListener("click", function () {
    muted = !muted; try { localStorage.setItem("rc_game_muted", muted ? "1" : "0"); } catch (e) {} updateButtons();
  });
  document.addEventListener("visibilitychange", function () { if (document.hidden && state === "play") { state = "paused"; updateButtons(); } });
  setInterval(updateButtons, 500);

  window.addEventListener("resize", resize);
  buildLevel(); resize(); updateButtons();
  requestAnimationFrame(frame);

  // exposed for testing
  window.RC_GAME = { get state() { return state; }, get score() { return score; }, get pieces() { return pieces; }, get chef() { return chef; },
    get enemies() { return enemies; }, input: input, spray: spray, start: startPause };
})();
