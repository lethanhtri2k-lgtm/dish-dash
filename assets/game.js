/* Dish Dash — shared logic for both screens.
   host.html sets window.DISH_ROLE = "host"; index.html sets "player". */
const ROLE = window.DISH_ROLE || "player";
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[<&>"]/g, c => ({ "<":"&lt;", ">":"&gt;", "&":"&amp;", '"':"&quot;" }[c]));

let sb = null, setupProblem = "";
if(!window.supabase || !window.supabase.createClient){
  setupProblem = "library";
} else if(!CONFIG || !CONFIG.url || CONFIG.url.indexOf("YOUR-PROJECT") >= 0){
  setupProblem = "config";
} else {
  try { sb = window.supabase.createClient(CONFIG.url, CONFIG.anonKey); }
  catch(e){ setupProblem = "config"; }
}
const configOK = !setupProblem;

let pin = "", game = null, players = [], myId = null, myName = "";
let picks = new Set(), locked = false, localStart = 0, lastKey = "", tick = null, busy = false;
let msg = "", channel = null, poll = null;
let lastSecond = -1, lastPhase = "", lastRoster = 0, revealPlayed = "";

try { myName = localStorage.getItem("dishdash.name") || ""; } catch(e) {}

/* ---------------- plumbing ---------------- */
function uuid(){
  if(crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
async function refresh(){
  if(!pin || !sb) return;
  const g = await sb.from("games").select("*").eq("pin", pin).maybeSingle();
  if(g.data) game = g.data;
  const p = await sb.from("players").select("*").eq("pin", pin);
  if(p.data) players = p.data;
  onData();
}
function watch(){
  if(channel) sb.removeChannel(channel);
  channel = sb.channel("room-" + pin)
    .on("postgres_changes", { event:"*", schema:"public", table:"games", filter:"pin=eq." + pin }, refresh)
    .on("postgres_changes", { event:"*", schema:"public", table:"players", filter:"pin=eq." + pin }, refresh)
    .subscribe();
  if(poll) clearInterval(poll);
  poll = setInterval(refresh, 2500);   /* safety net if realtime is off */
  refresh();
}
function onData(){
  if(!game) return render();
  const key = game.round + ":" + game.q + ":" + game.started_at;
  if(key !== lastKey){
    lastKey = key; picks = new Set(); locked = false; localStart = Date.now(); lastSecond = -1;
    if(game.phase === "question") Sound.start();
  }
  if(game.phase !== lastPhase){
    lastPhase = game.phase;
    if(game.phase === "final") Sound.fanfare();
  }
  Music.setPhase(game.phase);
  if(ROLE === "host"){
    const n = roster().length;
    if(n > lastRoster && game.phase === "lobby") Sound.join();
    lastRoster = n;
  }
  game.phase === "question" ? startTick() : stopTick();
  render();
}
function startTick(){ if(!tick) tick = setInterval(() => { heartbeat(); render(); }, 250); }
function heartbeat(){
  const left = remaining();
  if(left === lastSecond) return;
  lastSecond = left;
  const answered = ROLE === "player" && meRow() && meRow().answers && meRow().answers[String(game.q)];
  if(answered) return;
  if(left === 0) Sound.timeUp();
  else if(left <= 5) Sound.tick(true);
  else if(left <= 10 || left % 5 === 0) Sound.tick(false);
}
function stopTick(){ if(tick){ clearInterval(tick); tick = null; } }
function limit(){ return (game && game.seconds) || 60; }
function remaining(){
  return Math.max(0, Math.min(limit(), limit() - Math.floor((Date.now() - localStart) / 1000)));
}
async function patchGame(patch){
  if(busy || !game) return;
  busy = true; msg = "";
  const r = await sb.from("games").update(Object.assign({ updated_at:new Date().toISOString() }, patch)).eq("pin", pin);
  if(r.error) msg = "The game could not be updated: " + r.error.message;
  busy = false;
  await refresh();
}

/* ---------------- scoring ---------------- */
/* A wrong tick costs twice what a right one earns, and a dish can go negative,
   so ticking everything is far worse than answering nothing. */
const WRONG_WEIGHT = 2;
const MIN_PER_DISH = -250;
function scoreOf(q, chosen, secondsUsed){
  const total = q.sections.reduce((t, s) => t + s.correct.length, 0);
  let right = 0, wrong = 0;
  chosen.forEach(key => {
    const [s, o] = key.split(":").map(Number);
    if(q.sections[s] && q.sections[s].correct.includes(o)) right++; else wrong++;
  });
  const net = right - WRONG_WEIGHT * wrong;
  const share = net / total;
  let points;
  if(net > 0){
    const speed = 1 - 0.5 * Math.min(1, Math.max(0, secondsUsed / limit()));
    points = Math.round(MAX_PER_DISH * Math.min(1, share) * speed);
  } else {
    /* no speed relief on a penalty — guessing fast must not be cheaper */
    points = Math.max(MIN_PER_DISH, Math.round(250 * share));
  }
  return { right, wrong, total, net, accuracy:Math.max(0, share), secondsUsed, points };
}
const meRow = () => players.find(p => p.id === myId) || null;
async function lockIn(auto){
  const me = meRow();
  if(locked || !me || !game) return;
  locked = true;
  const q = QUESTIONS[game.q];
  const used = Math.min(limit(), Math.round((Date.now() - localStart) / 1000));
  const answers = Object.assign({}, me.answers || {});
  answers[String(game.q)] = Object.assign({ picks:[...picks], auto: !!auto }, scoreOf(q, [...picks], used));
  const score = Object.values(answers).reduce((t, a) => t + (a.points || 0), 0);
  const r = await sb.from("players").update({ answers, score, updated_at:new Date().toISOString() }).eq("id", myId);
  if(r.error) msg = "Your answer did not reach the teacher: " + r.error.message;
  await refresh();
}

/* ---------------- shared pieces ---------------- */
function dishPic(d){ return `<div class="dishframe"><img src="${esc(d.photo)}" alt="${esc(d.name)}"></div>`; }
function sectionBlock(sec, si, { interactive, reveal, mine }){
  const chosenSet = mine ? new Set(mine) : picks;
  return `<div class="sec s${si % 4}">
    <div class="sechead"><h3>${esc(sec.title)}</h3><span>${esc(sec.hint)}</span></div>
    <div class="opts">${sec.options.map((o, i) => {
      const key = si + ":" + i;
      const right = sec.correct.includes(i);
      const chose = chosenSet.has(key);
      let cls = "opt";
      if(chose) cls += " picked";
      if(reveal && !right && !chose) cls += " dim";
      let mark = "";
      if(reveal) mark = right ? "✔" : (chose ? "✘" : "");
      return `<button type="button" class="${cls}" ${interactive ? `data-k="${key}"` : "disabled"}>
        <span class="lb">${esc(o)}</span><span class="mark">${mark}</span></button>`;
    }).join("")}</div></div>`;
}
const allSections = (q, o) => q.sections.map((s, i) => sectionBlock(s, i, o)).join("");
function ring(){
  const left = remaining(), C = 2 * Math.PI * 26;
  return `<div class="timer"><svg class="ring" width="62" height="62" viewBox="0 0 64 64" aria-hidden="true">
    <circle class="bg" cx="32" cy="32" r="26"></circle>
    <circle class="fg" cx="32" cy="32" r="26" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - left / limit())}"></circle>
    </svg><span class="num">${left}</span></div>`;
}
const roster = () => players.filter(p => p.round === (game ? game.round : 1));
function board(n){
  const list = roster().sort((a, b) => (b.score || 0) - (a.score || 0) || String(a.name).localeCompare(String(b.name)));
  if(!list.length) return `<p class="note">No scores yet.</p>`;
  return `<ul class="board">${list.slice(0, n).map((p, i) =>
    `<li class="${i === 0 ? "p1" : ""} ${p.id === myId ? "me" : ""}"><span class="rank">${i + 1}</span>
      <span class="nm">${esc(p.name || "Player")}</span><span class="sc">${p.score || 0}</span></li>`).join("")}</ul>`;
}
const answered = () => roster().filter(p => p.answers && p.answers[String(game.q)]).length;
const timeChips = () => TIMES.map(t =>
  `<button class="tbtn" data-t="${t}" aria-pressed="${limit() === t}">${t}s</button>`).join("");
const errLine = () => msg ? `<p class="err">${esc(msg)}</p>` : "";

/* ---------------- host ---------------- */
async function createGame(){
  if(busy) return;
  busy = true; msg = "";
  for(let attempt = 0; attempt < 8; attempt++){
    const candidate = String(Math.floor(1000 + Math.random() * 9000));
    const r = await sb.from("games").insert({ pin:candidate, phase:"lobby", round:1, q:0, seconds:60 }).select().single();
    if(!r.error){
      pin = candidate; game = r.data; busy = false;
      try { sessionStorage.setItem("dishdash.pin", pin); } catch(e) {}
      watch();
      return;
    }
    if(r.error && String(r.error.code) !== "23505"){
      msg = "Could not start a game: " + r.error.message + " (check assets/config.js and the database setup)";
      busy = false; render(); return;
    }
  }
  msg = "Could not find a free game PIN. Try again.";
  busy = false; render();
}
function studentURL(){
  const u = new URL("index.html", location.href);
  u.search = "?pin=" + pin;
  return u.href;
}
function hostView(){
  if(!game) return `<div class="card center">
      <p class="big">Dish Dash — teacher screen</p>
      <p class="note">${QUESTIONS.length} dishes · up to ${MAX_PER_DISH} points each · ${MAX_POINTS} in total.
        Start a game and the screen shows a PIN and a QR code for the class.</p>
      <div class="row" style="justify-content:center"><button class="btn go" id="create">Start a new game</button></div>
      ${errLine()}</div>`;

  const q = QUESTIONS[game.q] || QUESTIONS[0];
  const total = roster().length;

  if(game.phase === "lobby"){
    return `<div class="card center">
      <p class="note">Students open the link and type this PIN</p>
      <p class="pincode">${esc(pin)}</p>
      <div class="qrbox" id="qr"></div>
      <p class="linkline" id="linktext">${esc(studentURL())}</p>
      <div class="row" style="justify-content:center"><button class="btn alt" id="copylink">Copy the link</button></div>
      <div style="margin-top:16px"><span class="pill">time for each dish</span>
        <div class="chipset" style="justify-content:center">${timeChips()}</div></div>
      <div class="lobbynames" style="justify-content:center">${roster().map(p => `<span class="tagname">${esc(p.name)}</span>`).join("")
        || `<span class="note">Waiting for the first student…</span>`}</div>
      <div class="row" style="justify-content:center"><button class="btn go" id="start">Start the game</button></div>
      <p class="note">${total} player${total === 1 ? "" : "s"} in the room</p>${errLine()}</div>`;
  }
  if(game.phase === "final"){
    return `<div class="card center"><p class="big">Final scores</p>${board(12)}
      <div class="row" style="justify-content:center">
        <button class="btn" id="again">Play again with the same PIN</button></div>${errLine()}</div>`;
  }
  const reveal = game.phase === "reveal";
  return `<div class="card">
      <div class="stage">${dishPic(q.dish)}
        <div><span class="pill">Dish ${game.q + 1} of ${QUESTIONS.length}</span>
          <span class="pill">PIN ${esc(pin)}</span>
          <h2 class="qtitle" style="margin-top:6px">${esc(q.dish.name)}</h2>
          <div class="row">${reveal ? "" : ring()}<span class="pill live">${answered()} of ${total} answered</span></div>
          <div class="progress"><i style="width:${total ? Math.round(answered() / total * 100) : 0}%"></i></div>
          ${reveal ? "" : `<div class="chipset">${timeChips()}<button class="tbtn" id="addtime">+15s</button></div>`}
        </div></div>
    </div>
    <div class="card">${allSections(q, { interactive:false, reveal })}</div>
    ${reveal ? `<div class="card"><h3>Scoreboard</h3>${board(6)}</div>` : ""}${errLine()}
    <div class="dock"><span class="tally">Dish ${game.q + 1} of ${QUESTIONS.length}</span><div class="spacer"></div>
      ${reveal
        ? `<button class="btn go" id="next">${game.q + 1 < QUESTIONS.length ? "Next dish" : "Show final scores"}</button>`
        : `<button class="btn" id="reveal">Show the answers</button>`}
      <button class="btn alt" id="stop">End game</button></div>`;
}

/* ---------------- player ---------------- */
async function join(){
  const name = ($("nick").value || "").trim().slice(0, 18);
  const code = ($("pinin").value || "").trim();
  if(!name || !/^\d{4}$/.test(code)){ msg = "Type the 4-digit PIN from the board and your name."; return render(); }
  busy = true; msg = ""; render();
  const g = await sb.from("games").select("*").eq("pin", code).maybeSingle();
  busy = false;
  if(!g.data){ msg = "No game with that PIN. Check the number on the board."; return render(); }
  pin = code; game = g.data; myName = name;
  try { localStorage.setItem("dishdash.name", name); } catch(e) {}
  myId = uuid();
  try { localStorage.setItem("dishdash.me." + pin, myId); } catch(e) {}
  const r = await sb.from("players").insert({ id:myId, pin, name, round:game.round, score:0, answers:{} });
  if(r.error){ msg = "Could not join: " + r.error.message; myId = null; return render(); }
  watch();
}
function playerView(){
  const me = meRow();
  if(!game || !me){
    const q = new URLSearchParams(location.search).get("pin") || "";
    return `<div class="card center">
      <p class="big">Join the game</p>
      <p class="note">Type the PIN your teacher is showing, and the name you want on the scoreboard.</p>
      <div class="joinbox" style="margin-top:16px">
        <label class="field" for="pinin">Game PIN</label>
        <input id="pinin" class="pininput" type="text" inputmode="numeric" maxlength="4" value="${esc(q)}" placeholder="0000">
        <div style="height:12px"></div>
        <label class="field" for="nick">Your name</label>
        <input id="nick" type="text" maxlength="18" value="${esc(myName)}" placeholder="e.g. Minh">
      </div>
      <div class="row" style="justify-content:center">
        <button class="btn go" id="join" ${busy ? "disabled" : ""}>${busy ? "Joining…" : "Join"}</button></div>
      ${errLine()}</div>`;
  }
  if(me.round !== game.round){
    return `<div class="card center"><p class="big">A new round is starting</p>
      <p class="note">Your teacher reset the game. Reload this page to join the new round.</p>
      <div class="row" style="justify-content:center"><button class="btn" id="reload">Reload</button></div></div>`;
  }
  const q = QUESTIONS[game.q] || QUESTIONS[0];
  if(game.phase === "lobby"){
    return `<div class="card center"><p class="big">You're in, ${esc(me.name)}!</p>
      <p class="note">Watch the teacher's screen. Each dish is worth up to ${MAX_PER_DISH} points.
        A wrong tick costs double a right one and a dish can go as low as ${MIN_PER_DISH},
        so only tick what you believe. Answering quickly keeps more of what you earn.</p>
      ${board(10)}${errLine()}</div>`;
  }
  if(game.phase === "final"){
    const list = roster().sort((a, b) => (b.score || 0) - (a.score || 0));
    const place = list.findIndex(p => p.id === myId) + 1;
    return `<div class="card center"><p class="big">${place === 1 ? "You won!" : "You finished #" + place}</p>
      <p class="note">${me.score || 0} points out of ${MAX_POINTS}</p>${board(12)}${errLine()}</div>`;
  }
  const answer = me.answers && me.answers[String(game.q)];
  if(game.phase === "reveal"){
    const pts = answer ? answer.points : 0;
    if(revealPlayed !== lastKey){
      revealPlayed = lastKey;
      pts > 0 ? Sound.good(pts >= MAX_PER_DISH * 0.8) : Sound.bad();
    }
    const detail = answer
      ? `${answer.right} of ${answer.total} right${answer.wrong ? `, ${answer.wrong} wrong` : ""} · locked in at ${answer.secondsUsed}s`
      : "You did not lock in an answer.";
    return `<div class="card">
        <div class="stage">${dishPic(q.dish)}
          <div><h2 class="qtitle">${esc(q.dish.name)}</h2>
            <div class="banner ${pts > 0 ? "good" : "bad"}">+${pts} points</div>
            <p class="note">${esc(detail)}</p>
            <p class="note">Ticks with ✔ earned a point each. Ticks with ✘ cost two each.</p></div></div>
      </div>
      <div class="card">${allSections(q, { interactive:false, reveal:true, mine: answer ? answer.picks : [] })}</div>
      <div class="card"><h3>Scoreboard</h3>${board(10)}</div>${errLine()}`;
  }
  if(!locked && !answer && remaining() === 0) setTimeout(() => lockIn(true), 0);
  return `<div class="card">
      <div class="stage">${dishPic(q.dish)}
        <div><span class="pill">Dish ${game.q + 1} of ${QUESTIONS.length}</span>
          <h2 class="qtitle" style="margin-top:6px">${esc(q.dish.name)}</h2>
          <p class="note">Tick every answer you think is right, then lock in.
            A wrong tick costs <strong>double</strong> what a right one earns, so ticking everything scores below zero.</p>
          <div class="row">${ring()}<span class="pill">${me.score || 0} points so far</span></div></div></div>
    </div>
    <div class="card">${allSections(q, { interactive: !locked && !answer, reveal:false })}</div>${errLine()}
    <div class="dock"><span class="tally">${picks.size} ticked</span><div class="spacer"></div>
      ${answer || locked
        ? `<span class="tally"><b>Answer locked in</b> — wait for your teacher.</span>`
        : `<button class="btn go" id="lock" ${picks.size ? "" : "disabled"}>Lock in my answers</button>`}</div>`;
}

/* ---------------- render ---------------- */
function soundButton(){
  const el = $("soundbtn");
  if(!el) return;
  el.textContent = Sound.enabled ? "sound on" : "sound off";
  el.setAttribute("aria-pressed", Sound.enabled);
}
function render(){
  if(setupProblem === "library"){
    $("app").innerHTML = `<div class="card"><p class="big">No connection</p>
      <p class="note">The page could not download the Supabase library it needs. Check that this device is online,
        then reload. If your school network blocks cdn.jsdelivr.net and unpkg.com, download
        <strong>supabase.js</strong> once, put it in <strong>assets/</strong>, and point the script tag at it.</p></div>`;
    return;
  }
  if(setupProblem === "config"){
    $("app").innerHTML = `<div class="card"><p class="big">Nearly there</p>
      <p class="note">Open <strong>assets/config.js</strong> and paste your Supabase project URL and anon key.
        Step 2 of the README explains where to find them.</p></div>`;
    return;
  }
  const show = game && (game.phase === "question" || game.phase === "reveal");
  if($("qpill")){ $("qpill").hidden = !show; if(show) $("qpill").textContent = `Dish ${game.q + 1} / ${QUESTIONS.length}`; }
  if($("pinpill")){ $("pinpill").hidden = !pin; $("pinpill").textContent = "PIN " + pin; }
  $("app").innerHTML = ROLE === "host" ? hostView() : playerView();
  soundButton();
  wire();
}
function drawQR(){
  const box = $("qr");
  if(!box) return;
  try {
    const qr = qrcode(0, "M");
    qr.addData(studentURL());
    qr.make();
    box.innerHTML = qr.createSvgTag({ cellSize:6, margin:2, scalable:true });
    const svg = box.querySelector("svg");
    if(svg){ svg.setAttribute("width", "100%"); svg.setAttribute("height", "100%"); svg.removeAttribute("style"); }
  } catch(e){ box.innerHTML = `<p class="note">Students can type the link below.</p>`; }
}
function wire(){
  const on = (id, fn) => { const el = $(id); if(el) el.addEventListener("click", fn); };
  const sb2 = $("soundbtn");
  if(sb2 && !sb2.dataset.wired){
    sb2.dataset.wired = "1";
    sb2.addEventListener("click", () => {
      Sound.toggle();
      soundButton();
      Music.setPhase(game ? game.phase : "lobby");
    });
  }
  document.addEventListener("click", () => Sound.unlock(), { once:true });
  $("app").querySelectorAll(".opt[data-k]").forEach(b => b.addEventListener("click", () => {
    const k = b.dataset.k;
    picks.has(k) ? picks.delete(k) : picks.add(k);
    Sound.pick();
    render();
  }));
  $("app").querySelectorAll(".tbtn[data-t]").forEach(b => b.addEventListener("click", () => patchGame({ seconds:Number(b.dataset.t) })));
  on("create", () => { Sound.unlock(); Music.setPhase("lobby"); createGame(); });
  on("addtime", () => patchGame({ seconds:limit() + 15 }));
  on("start", () => patchGame({ phase:"question", q:0, started_at:new Date().toISOString() }));
  on("reveal", () => patchGame({ phase:"reveal" }));
  on("next", () => game.q + 1 < QUESTIONS.length
    ? patchGame({ phase:"question", q:game.q + 1, started_at:new Date().toISOString() })
    : patchGame({ phase:"final" }));
  on("stop", () => patchGame({ phase:"final" }));
  on("again", () => patchGame({ phase:"lobby", round:game.round + 1, q:0 }));
  on("lock", () => { Sound.lock(); lockIn(false); });
  on("join", join);
  on("reload", () => location.reload());
  on("copylink", e => {
    const btn = e.currentTarget, old = btn.textContent;
    const done = m => { btn.textContent = m; setTimeout(() => { btn.textContent = old; }, 1500); };
    navigator.clipboard.writeText(studentURL()).then(() => done("Copied!"), () => done("Select the link below"));
  });
  const nick = $("nick");
  if(nick) nick.addEventListener("keydown", e => { if(e.key === "Enter") join(); });
  const pinin = $("pinin");
  if(pinin) pinin.addEventListener("keydown", e => { if(e.key === "Enter" && $("nick")) $("nick").focus(); });
  if(ROLE === "host" && game && game.phase === "lobby") drawQR();
}

/* ---------------- start ---------------- */
if(configOK && ROLE === "host"){
  let saved = "";
  try { saved = sessionStorage.getItem("dishdash.pin") || ""; } catch(e) {}
  if(saved){
    sb.from("games").select("*").eq("pin", saved).maybeSingle().then(r => {
      if(r.data){ pin = saved; game = r.data; watch(); } else render();
    });
  } else render();
} else {
  render();
}
