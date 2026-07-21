const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const QRCode = require("qrcode");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

const rooms = new Map();

function code() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function initialPoints() {
  const p = Array(24).fill(0);
  p[0] = 2;
  p[11] = 5;
  p[16] = 3;
  p[18] = 5;
  p[23] = -2;
  p[12] = -5;
  p[7] = -3;
  p[5] = -5;
  return p;
}

function newGame(roomCode) {
  return {
    roomCode,
    theme: "classic-walnut",
    status: "lobby",
    players: { white: null, black: null },
    points: initialPoints(),
    bar: { white: 0, black: 0 },
    borneOff: { white: 0, black: 0 },
    turn: "white",
    dice: [],
    remainingDice: [],
    rolled: false,
    turnHistory: [],
    score: { white: 0, black: 0 },
    matchLength: 5,
    message: "Waiting for two players",
    winner: null
  };
}

function ownerOf(v) {
  if (v > 0) return "white";
  if (v < 0) return "black";
  return null;
}

function countAt(state, point, color) {
  const v = state.points[point];
  return ownerOf(v) === color ? Math.abs(v) : 0;
}

function direction(color) {
  return color === "white" ? 1 : -1;
}

function homeRange(color) {
  return color === "white" ? [18, 23] : [0, 5];
}

function allInHome(state, color) {
  if (state.bar[color] > 0) return false;
  const [a,b] = homeRange(color);
  for (let i = 0; i < 24; i++) {
    if (countAt(state, i, color) && (i < a || i > b)) return false;
  }
  return true;
}

function canLand(state, point, color) {
  if (point < 0 || point > 23) return false;
  const v = state.points[point];
  const owner = ownerOf(v);
  return owner === null || owner === color || Math.abs(v) === 1;
}

function entryPoint(color, die) {
  return color === "white" ? die - 1 : 24 - die;
}

function exactBearOffDistance(color, from) {
  return color === "white" ? 24 - from : from + 1;
}

function fartherCheckerExists(state, color, from) {
  if (color === "white") {
    for (let i = 18; i < from; i++) if (countAt(state, i, color)) return true;
  } else {
    for (let i = 5; i > from; i--) if (countAt(state, i, color)) return true;
  }
  return false;
}

function legalSingleMoves(state, color, die) {
  const moves = [];
  if (state.bar[color] > 0) {
    const to = entryPoint(color, die);
    if (canLand(state, to, color)) moves.push({ from: "bar", to, die });
    return moves;
  }

  for (let from = 0; from < 24; from++) {
    if (!countAt(state, from, color)) continue;
    const to = from + direction(color) * die;

    if (to >= 0 && to <= 23 && canLand(state, to, color)) {
      moves.push({ from, to, die });
      continue;
    }

    if (allInHome(state, color)) {
      const dist = exactBearOffDistance(color, from);
      if (die === dist || (die > dist && !fartherCheckerExists(state, color, from))) {
        moves.push({ from, to: "off", die });
      }
    }
  }
  return moves;
}

function applyMoveMutable(state, color, move) {
  if (move.from === "bar") {
    state.bar[color]--;
  } else {
    state.points[move.from] += color === "white" ? -1 : 1;
  }

  if (move.to === "off") {
    state.borneOff[color]++;
  } else {
    const opponent = color === "white" ? "black" : "white";
    if (ownerOf(state.points[move.to]) === opponent && Math.abs(state.points[move.to]) === 1) {
      state.points[move.to] = 0;
      state.bar[opponent]++;
    }
    state.points[move.to] += color === "white" ? 1 : -1;
  }
}

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

function sequencesForDice(state, color, dice) {
  const results = [];
  function walk(s, remaining, seq) {
    if (!remaining.length) {
      results.push(seq);
      return;
    }
    let moved = false;
    for (let i = 0; i < remaining.length; i++) {
      const die = remaining[i];
      const moves = legalSingleMoves(s, color, die);
      for (const move of moves) {
        moved = true;
        const next = cloneState(s);
        applyMoveMutable(next, color, move);
        const rem = remaining.slice();
        rem.splice(i, 1);
        walk(next, rem, seq.concat(move));
      }
    }
    if (!moved) results.push(seq);
  }
  walk(state, dice, []);
  return results;
}

function validTurnMoves(state, color) {
  if (!state.rolled) return [];
  const seqs = sequencesForDice(state, color, state.remainingDice);
  const maxLen = Math.max(0, ...seqs.map(s => s.length));
  let best = seqs.filter(s => s.length === maxLen);
  if (state.remainingDice.length === 2 &&
      state.remainingDice[0] !== state.remainingDice[1] &&
      maxLen === 1) {
    const high = Math.max(...state.remainingDice);
    if (best.some(s => s[0] && s[0].die === high)) best = best.filter(s => s[0] && s[0].die === high);
  }
  return best;
}

function legalNextMoves(state, color) {
  const seqs = validTurnMoves(state, color);
  const map = new Map();
  for (const seq of seqs) {
    if (!seq[0]) continue;
    const m = seq[0];
    map.set(`${m.from}-${m.to}-${m.die}`, m);
  }
  return [...map.values()];
}

function publicState(state) {
  return state;
}

function emitRoom(room) {
  io.to(room.roomCode).emit("state", publicState(room));
}

function concludeGame(room, winner) {
  const loser = winner === "white" ? "black" : "white";
  let points = 1;
  if (room.borneOff[loser] === 0) {
    points = 2;
    const [a,b] = homeRange(winner);
    const loserOnBar = room.bar[loser] > 0;
    let loserInWinnerHome = false;
    for (let i = a; i <= b; i++) if (countAt(room, i, loser)) loserInWinnerHome = true;
    if (loserOnBar || loserInWinnerHome) points = 3;
  }
  room.score[winner] += points;
  room.winner = winner;
  room.status = "gameover";
  room.message = `${winner} wins ${points} point${points === 1 ? "" : "s"}`;
}

io.on("connection", socket => {
  socket.on("create-room", async ({ origin } = {}, callback) => {
    let roomCode;
    do roomCode = code(); while (rooms.has(roomCode));
    const room = newGame(roomCode);
    rooms.set(roomCode, room);
    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    socket.data.role = "tv";
    const joinUrl = `${origin || "http://localhost:" + PORT}/?join=${roomCode}`;
    const qr = await QRCode.toDataURL(joinUrl, { margin: 1, width: 360 });
    callback({ roomCode, joinUrl, qr, state: publicState(room) });
  });

  socket.on("join-room", ({ roomCode, name }, callback) => {
    roomCode = String(roomCode || "").toUpperCase().trim();
    const room = rooms.get(roomCode);
    if (!room) return callback({ ok: false, error: "Room not found" });

    let color = null;
    if (!room.players.white) color = "white";
    else if (!room.players.black) color = "black";
    else return callback({ ok: false, error: "This room already has two players" });

    room.players[color] = { id: socket.id, name: String(name || color).slice(0, 24) };
    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    socket.data.role = color;
    room.message = room.players.white && room.players.black
      ? `${room.players.white.name} plays white. ${room.players.black.name} plays black.`
      : "Waiting for the second player";
    if (room.players.white && room.players.black) room.status = "playing";
    emitRoom(room);
    callback({ ok: true, color, state: publicState(room) });
  });

  socket.on("set-theme", ({ theme }) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || socket.data.role !== "tv") return;
    room.theme = theme;
    emitRoom(room);
  });

  socket.on("set-match-length", ({ matchLength }) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || socket.data.role !== "tv" || room.status !== "lobby") return;
    room.matchLength = [1,3,5,7,9,11].includes(Number(matchLength)) ? Number(matchLength) : 5;
    emitRoom(room);
  });

  socket.on("roll", (_, callback) => {
    const room = rooms.get(socket.data.roomCode);
    const color = socket.data.role;
    if (!room || !["white","black"].includes(color)) return;
    if (room.turn !== color || room.rolled || room.status !== "playing") return;
    const a = 1 + Math.floor(Math.random() * 6);
    const b = 1 + Math.floor(Math.random() * 6);
    room.dice = [a,b];
    room.remainingDice = a === b ? [a,a,a,a] : [a,b];
    room.rolled = true;
    room.turnHistory = [];
    const legal = legalNextMoves(room, color);
    room.message = `${room.players[color].name} rolled ${a}-${b}`;
    if (!legal.length) {
      room.message += " — no legal moves";
      setTimeout(() => {
        const current = rooms.get(room.roomCode);
        if (!current || current.turn !== color || !current.rolled) return;
        current.turn = color === "white" ? "black" : "white";
        current.rolled = false;
        current.dice = [];
        current.remainingDice = [];
        current.turnHistory = [];
        current.message = `${current.players[current.turn].name}'s turn`;
        emitRoom(current);
      }, 1200);
    }
    emitRoom(room);
    callback?.({ ok: true });
  });

  socket.on("move", ({ from, to, die }, callback) => {
    const room = rooms.get(socket.data.roomCode);
    const color = socket.data.role;
    if (!room || room.turn !== color || !room.rolled || room.status !== "playing") {
      return callback?.({ ok: false, error: "Not available" });
    }
    const legal = legalNextMoves(room, color);
    const move = legal.find(m => String(m.from) === String(from) && String(m.to) === String(to) && Number(m.die) === Number(die));
    if (!move) return callback?.({ ok: false, error: "Illegal move" });

    room.turnHistory.push({
      points: room.points.slice(),
      bar: { ...room.bar },
      borneOff: { ...room.borneOff },
      remainingDice: room.remainingDice.slice()
    });
    applyMoveMutable(room, color, move);
    const idx = room.remainingDice.indexOf(move.die);
    if (idx >= 0) room.remainingDice.splice(idx, 1);

    if (room.borneOff[color] === 15) {
      concludeGame(room, color);
    } else {
      room.message = `${room.players[color].name} moved ${move.die}`;
    }
    emitRoom(room);
    callback?.({ ok: true });
  });

  socket.on("undo", () => {
    const room = rooms.get(socket.data.roomCode);
    const color = socket.data.role;
    if (!room || room.turn !== color || !room.turnHistory.length || room.status !== "playing") return;
    const snap = room.turnHistory.pop();
    room.points = snap.points;
    room.bar = snap.bar;
    room.borneOff = snap.borneOff;
    room.remainingDice = snap.remainingDice;
    room.message = `${room.players[color].name} undid a move`;
    emitRoom(room);
  });

  socket.on("confirm-turn", (_, callback) => {
    const room = rooms.get(socket.data.roomCode);
    const color = socket.data.role;
    if (!room || room.turn !== color || !room.rolled || room.status !== "playing") return;
    const nextLegal = legalNextMoves(room, color);
    if (nextLegal.length) return callback?.({ ok: false, error: "You still have a legal move" });
    room.turn = color === "white" ? "black" : "white";
    room.rolled = false;
    room.dice = [];
    room.remainingDice = [];
    room.turnHistory = [];
    room.message = `${room.players[room.turn].name}'s turn`;
    emitRoom(room);
    callback?.({ ok: true });
  });

  socket.on("new-game", () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || socket.data.role !== "tv") return;
    room.points = initialPoints();
    room.bar = { white: 0, black: 0 };
    room.borneOff = { white: 0, black: 0 };
    room.turn = "white";
    room.dice = [];
    room.remainingDice = [];
    room.rolled = false;
    room.turnHistory = [];
    room.status = room.players.white && room.players.black ? "playing" : "lobby";
    room.winner = null;
    room.message = room.players.white && room.players.black ? `${room.players.white.name}'s turn` : "Waiting for players";
    emitRoom(room);
  });

  socket.on("disconnect", () => {
    const room = rooms.get(socket.data.roomCode);
    const role = socket.data.role;
    if (!room || !["white","black"].includes(role)) return;
    if (room.players[role]?.id === socket.id) {
      room.players[role] = null;
      room.status = "lobby";
      room.message = `${role} player disconnected`;
      emitRoom(room);
    }
  });
});

server.listen(PORT, () => console.log(`Backgammon running on http://localhost:${PORT}`));
