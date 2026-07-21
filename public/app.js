const socket = io();
const app = document.querySelector("#app");
const params = new URLSearchParams(location.search);
const joinCode = params.get("join");
let role = null;
let roomCode = null;
let qr = null;
let state = null;
let selectedFrom = null;

const themes = [
  ["classic-walnut","Classic Walnut"],
  ["egyptian","Ancient Egypt"],
  ["zen","Japanese Zen"],
  ["medieval","Medieval Castle"],
  ["art-deco","Art Deco"],
  ["pirate","Pirate Treasure"],
  ["scifi","Sci-Fi Hologram"],
  ["ocean","Ocean"],
  ["steampunk","Steampunk"],
  ["viking","Nordic Viking"]
];

const palettes = {
  "classic-walnut": ["#15120f","#2e241b","#7a4c2c","#efe0c3","#7f211f","#f4ead7","#1b1715","#d7aa59"],
  "egyptian": ["#17120c","#372812","#b48a4f","#d6bd72","#144f6d","#f0db9c","#1e4160","#e1b957"],
  "zen": ["#151713","#293027","#bba986","#ece7d7","#242926","#eeeade","#202321","#c9848d"],
  "medieval": ["#17110d","#34231a","#6d4126","#dbc58e","#63271f","#e6d5aa","#2b211c","#c49a46"],
  "art-deco": ["#090a0b","#1a1b1c","#161819","#d7bc76","#72583a","#f4ead3","#111214","#d8b45e"],
  "pirate": ["#101a1d","#283a3b","#8b633b","#d8bd82","#273e55","#d8bf82","#38271b","#dcae45"],
  "scifi": ["#050915","#0b1530","#0e1e38","#2cf7dd","#ce4cff","#e9ffff","#14182a","#32f3ff"],
  "ocean": ["#061a25","#0b3547","#16718b","#7ad8d2","#ef805e","#e8f7ef","#17475b","#ffd66b"],
  "steampunk": ["#17100c","#35241a","#765036","#c59458","#33544e","#d5b071","#2b251f","#d78943"],
  "viking": ["#111618","#263236","#5f6a67","#d9d2b8","#314e5a","#d9d6c5","#24292a","#b78a4a"]
};

function applyTheme(name) {
  const p = palettes[name] || palettes["classic-walnut"];
  const keys = ["--bg","--panel","--board","--point-a","--point-b","--white","--black","--accent"];
  keys.forEach((k,i) => document.documentElement.style.setProperty(k,p[i]));
}

function landing() {
  app.innerHTML = `
    <section class="landing"><div class="card">
      <h1>Backgammon</h1>
      <div class="subtitle">Play on the TV. Make every move from your phone.</div>
      <button class="primary big" id="host">Open TV Game</button>
      <hr style="border-color:rgba(255,255,255,.12);margin:24px 0">
      <label>Room code</label>
      <input id="code" maxlength="5" placeholder="ABCDE" autocomplete="off">
      <label>Your name</label>
      <input id="name" maxlength="24" placeholder="Player name" autocomplete="name">
      <button class="secondary big" id="join">Join from Phone</button>
      <div id="err" class="error"></div>
    </div></section>`;
  document.querySelector("#host").onclick = createRoom;
  document.querySelector("#join").onclick = () => joinRoom(
    document.querySelector("#code").value,
    document.querySelector("#name").value
  );
}

function joinScreen(code) {
  app.innerHTML = `
    <section class="join"><div class="card">
      <h1>Join Game</h1>
      <p class="subtitle">Room <strong>${code}</strong></p>
      <label>Your name</label>
      <input id="name" maxlength="24" placeholder="Player name" autofocus>
      <button class="primary big" id="join">Join Game</button>
      <div id="err" class="error"></div>
    </div></section>`;
  document.querySelector("#join").onclick = () => joinRoom(code, document.querySelector("#name").value);
}

function createRoom() {
  role = "tv";
  socket.emit("create-room", { origin: location.origin }, data => {
    roomCode = data.roomCode; qr = data.qr; state = data.state; render();
  });
}

function joinRoom(code, name) {
  if (!name.trim()) {
    document.querySelector("#err").textContent = "Enter your name.";
    return;
  }
  socket.emit("join-room", { roomCode: code, name }, data => {
    if (!data.ok) {
      document.querySelector("#err").textContent = data.error;
      return;
    }
    role = data.color; roomCode = String(code).toUpperCase(); state = data.state; render();
  });
}

socket.on("state", s => {
  state = s;
  applyTheme(s.theme);
  render();
});

function pointOrder() {
  return {
    topLeft: [12,13,14,15,16,17],
    topRight: [18,19,20,21,22,23],
    bottomLeft: [11,10,9,8,7,6],
    bottomRight: [5,4,3,2,1,0]
  };
}

function checkerHtml(color, count) {
  const show = Math.min(count, 5);
  return Array(show).fill(0).map(() => `<span class="checker ${color}"></span>`).join("") +
    (count > 5 ? `<b style="position:absolute;inset:auto 0 4px;text-align:center">${count}</b>` : "");
}

function pointHtml(index, top, alt) {
  const v = state.points[index];
  const color = v > 0 ? "white" : v < 0 ? "black" : "";
  const count = Math.abs(v);
  return `<div class="point ${top ? "top":"bottom"} ${alt ? "alt":""}" data-point="${index}">
    <div class="stack">${color ? checkerHtml(color,count):""}</div>
  </div>`;
}

function halfHtml(topIndices, bottomIndices) {
  return `<div class="half">
    ${topIndices.map((n,i)=>pointHtml(n,true,i%2)).join("")}
    ${bottomIndices.map((n,i)=>pointHtml(n,false,(i+1)%2)).join("")}
  </div>`;
}

function boardHtml() {
  const o = pointOrder();
  return `<div class="board">
    ${halfHtml(o.topLeft,o.bottomLeft)}
    <div class="bar">
      <div>${checkerHtml("black",state.bar.black)}</div>
      <div>${checkerHtml("white",state.bar.white)}</div>
    </div>
    ${halfHtml(o.topRight,o.bottomRight)}
    ${state.dice.length ? `<div class="dice-float">${state.dice.map(d=>`<div class="die">${d}</div>`).join("")}</div>`:""}
    <div class="off left">W<br>${state.borneOff.white}</div>
    <div class="off right">B<br>${state.borneOff.black}</div>
  </div>`;
}

function renderTV() {
  const white = state.players.white?.name || "White";
  const black = state.players.black?.name || "Black";
  app.innerHTML = `<section class="tv">
    <div class="stage">
      <div class="topbar">
        <div class="player">${state.turn==="white"&&state.status==="playing"?'<span class="turn-dot"></span>':""}${white}</div>
        <div class="score">${state.score.white} &nbsp;–&nbsp; ${state.score.black}<div class="small">Match to ${state.matchLength}</div></div>
        <div class="player black">${black}${state.turn==="black"&&state.status==="playing"?'<span class="turn-dot" style="margin-left:7px;margin-right:0"></span>':""}</div>
      </div>
      <div class="message">${state.message}</div>
      <div class="board-wrap">${boardHtml()}</div>
    </div>
    <aside class="sidebar">
      <img class="qr" src="${qr}" alt="QR code to join">
      <div class="small" style="text-align:center">Scan to join</div>
      <div class="room-code">${roomCode}</div>
      <label>Match length</label>
      <select id="match">${[1,3,5,7,9,11].map(n=>`<option ${n===state.matchLength?"selected":""}>${n}</option>`).join("")}</select>
      <div class="small">Board theme</div>
      <div class="theme-grid">${themes.map(([id,label])=>`<button class="theme-btn ${id===state.theme?"active":""}" data-theme="${id}">${label}</button>`).join("")}</div>
      <button class="secondary" id="new">New Game</button>
    </aside>
  </section>`;
  document.querySelectorAll("[data-theme]").forEach(b => b.onclick = () => socket.emit("set-theme",{theme:b.dataset.theme}));
  document.querySelector("#match").onchange = e => socket.emit("set-match-length",{matchLength:Number(e.target.value)});
  document.querySelector("#new").onclick = () => socket.emit("new-game");
}

function currentLegalMoves() {
  if (!state.rolled || state.turn !== role) return [];
  const out = [];
  const dice = [...new Set(state.remainingDice)];
  for (const die of dice) {
    if (state.bar[role] > 0) {
      const to = role === "white" ? die-1 : 24-die;
      const v = state.points[to];
      const open = !v || (role==="white" ? v>0 : v<0) || Math.abs(v)===1;
      if (open) out.push({from:"bar",to,die});
      continue;
    }
    for (let from=0; from<24; from++) {
      const v=state.points[from];
      if (!(role==="white"?v>0:v<0)) continue;
      const to=from+(role==="white"?die:-die);
      if (to>=0&&to<24) {
        const tv=state.points[to];
        const open=!tv||(role==="white"?tv>0:tv<0)||Math.abs(tv)===1;
        if(open) out.push({from,to,die});
      } else {
        out.push({from,to:"off",die});
      }
    }
  }
  return out;
}

function describeMove(m) {
  const from = m.from === "bar" ? "Bar" : `Point ${Number(m.from)+1}`;
  const to = m.to === "off" ? "Bear off" : `Point ${Number(m.to)+1}`;
  return `${from} → ${to} (${m.die})`;
}

function renderPhone() {
  const me = state.players[role]?.name || role;
  const myTurn = state.turn === role && state.status === "playing";
  const moves = currentLegalMoves();
  app.innerHTML = `<section class="phone">
    <div class="phone-head"><strong>${me} · ${role}</strong><span>${state.score[role]} points</span></div>
    <div class="notice">${state.message}</div>
    <div class="board-wrap">${boardHtml()}</div>
    <div class="controls">
      ${!myTurn ? `<div class="notice">Waiting for ${state.players[state.turn]?.name || state.turn}</div>` : ""}
      ${myTurn && !state.rolled ? `<button class="primary big" id="roll">Roll Dice</button>` : ""}
      ${myTurn && state.rolled ? `
        <div><strong>Remaining dice:</strong> ${state.remainingDice.join(", ") || "none"}</div>
        <div class="move-list">${moves.map((m,i)=>`<button class="move" data-i="${i}">${describeMove(m)}</button>`).join("")}</div>
        <div class="row">
          <button class="secondary" id="undo" ${state.turnHistory.length?"":"disabled"}>Undo</button>
          <button class="primary" id="confirm">Confirm Turn</button>
        </div>
        <div id="err" class="error"></div>` : ""}
    </div>
  </section>`;

  document.querySelector("#roll")?.addEventListener("click",()=>socket.emit("roll",{}));
  document.querySelectorAll(".move").forEach(b=>b.onclick=()=>{
    const m=moves[Number(b.dataset.i)];
    socket.emit("move",m,res=>{
      if(res&&!res.ok) document.querySelector("#err").textContent=res.error;
    });
  });
  document.querySelector("#undo")?.addEventListener("click",()=>socket.emit("undo"));
  document.querySelector("#confirm")?.addEventListener("click",()=>socket.emit("confirm-turn",{},res=>{
    if(res&&!res.ok) document.querySelector("#err").textContent=res.error;
  }));
}

function render() {
  if (!state) return;
  applyTheme(state.theme);
  if (role === "tv") renderTV(); else renderPhone();
}

if (joinCode) joinScreen(joinCode.toUpperCase());
else landing();
