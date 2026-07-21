/* Enhanced checker selection, legal-move highlighting, and center-bar display. */

function bgOwnerOf(value) {
  if (value > 0) return "white";
  if (value < 0) return "black";
  return null;
}

function bgCountAt(gameState, point, color) {
  const value = gameState.points[point];
  return bgOwnerOf(value) === color ? Math.abs(value) : 0;
}

function bgDirection(color) {
  return color === "white" ? 1 : -1;
}

function bgHomeRange(color) {
  return color === "white" ? [18, 23] : [0, 5];
}

function bgAllInHome(gameState, color) {
  if (gameState.bar[color] > 0) return false;
  const [start, end] = bgHomeRange(color);
  for (let point = 0; point < 24; point++) {
    if (bgCountAt(gameState, point, color) && (point < start || point > end)) return false;
  }
  return true;
}

function bgCanLand(gameState, point, color) {
  if (point < 0 || point > 23) return false;
  const value = gameState.points[point];
  const owner = bgOwnerOf(value);
  return owner === null || owner === color || Math.abs(value) === 1;
}

function bgEntryPoint(color, die) {
  return color === "white" ? die - 1 : 24 - die;
}

function bgBearOffDistance(color, from) {
  return color === "white" ? 24 - from : from + 1;
}

function bgFartherCheckerExists(gameState, color, from) {
  if (color === "white") {
    for (let point = 18; point < from; point++) {
      if (bgCountAt(gameState, point, color)) return true;
    }
  } else {
    for (let point = 5; point > from; point--) {
      if (bgCountAt(gameState, point, color)) return true;
    }
  }
  return false;
}

function bgLegalSingleMoves(gameState, color, die) {
  const moves = [];
  if (gameState.bar[color] > 0) {
    const to = bgEntryPoint(color, die);
    if (bgCanLand(gameState, to, color)) moves.push({ from: "bar", to, die });
    return moves;
  }

  for (let from = 0; from < 24; from++) {
    if (!bgCountAt(gameState, from, color)) continue;
    const to = from + bgDirection(color) * die;

    if (to >= 0 && to <= 23 && bgCanLand(gameState, to, color)) {
      moves.push({ from, to, die });
      continue;
    }

    if (bgAllInHome(gameState, color)) {
      const distance = bgBearOffDistance(color, from);
      if (die === distance || (die > distance && !bgFartherCheckerExists(gameState, color, from))) {
        moves.push({ from, to: "off", die });
      }
    }
  }
  return moves;
}

function bgApplyMoveToCopy(gameState, color, move) {
  const next = JSON.parse(JSON.stringify(gameState));
  if (move.from === "bar") next.bar[color]--;
  else next.points[move.from] += color === "white" ? -1 : 1;

  if (move.to === "off") {
    next.borneOff[color]++;
  } else {
    const opponent = color === "white" ? "black" : "white";
    if (bgOwnerOf(next.points[move.to]) === opponent && Math.abs(next.points[move.to]) === 1) {
      next.points[move.to] = 0;
      next.bar[opponent]++;
    }
    next.points[move.to] += color === "white" ? 1 : -1;
  }
  return next;
}

function bgMoveSequences(gameState, color, dice) {
  const results = [];

  function walk(position, remaining, sequence) {
    if (!remaining.length) {
      results.push(sequence);
      return;
    }

    let moved = false;
    const triedDice = new Set();
    for (let index = 0; index < remaining.length; index++) {
      const die = remaining[index];
      if (triedDice.has(die)) continue;
      triedDice.add(die);

      const moves = bgLegalSingleMoves(position, color, die);
      for (const move of moves) {
        moved = true;
        const nextRemaining = remaining.slice();
        nextRemaining.splice(index, 1);
        walk(bgApplyMoveToCopy(position, color, move), nextRemaining, sequence.concat(move));
      }
    }

    if (!moved) results.push(sequence);
  }

  walk(gameState, dice, []);
  return results;
}

currentLegalMoves = function enhancedCurrentLegalMoves() {
  if (!state || !state.rolled || state.turn !== role || !["white", "black"].includes(role)) return [];
  const sequences = bgMoveSequences(state, role, state.remainingDice);
  const maximumLength = Math.max(0, ...sequences.map(sequence => sequence.length));
  let best = sequences.filter(sequence => sequence.length === maximumLength);

  if (state.remainingDice.length === 2 &&
      state.remainingDice[0] !== state.remainingDice[1] &&
      maximumLength === 1) {
    const higherDie = Math.max(...state.remainingDice);
    if (best.some(sequence => sequence[0]?.die === higherDie)) {
      best = best.filter(sequence => sequence[0]?.die === higherDie);
    }
  }

  const unique = new Map();
  for (const sequence of best) {
    const move = sequence[0];
    if (!move) continue;
    unique.set(`${move.from}-${move.to}-${move.die}`, move);
  }
  return [...unique.values()];
};

function bgSameLocation(a, b) {
  return String(a) === String(b);
}

function bgMovesFrom(moves, from) {
  return moves.filter(move => bgSameLocation(move.from, from));
}

checkerHtml = function enhancedCheckerHtml(color, count) {
  const show = Math.min(count, 5);
  return Array(show).fill(0).map(() => `<span class="checker ${color}"></span>`).join("") +
    (count > 5 ? `<b class="checker-count">${count}</b>` : "");
};

pointHtml = function enhancedPointHtml(index, top, alt, moves = currentLegalMoves()) {
  const value = state.points[index];
  const color = value > 0 ? "white" : value < 0 ? "black" : "";
  const count = Math.abs(value);
  const isSource = moves.some(move => bgSameLocation(move.from, index));
  const isSelected = selectedFrom !== null && bgSameLocation(selectedFrom, index);
  const destinationMoves = selectedFrom === null
    ? []
    : moves.filter(move => bgSameLocation(move.from, selectedFrom) && bgSameLocation(move.to, index));
  const targetDice = [...new Set(destinationMoves.map(move => move.die))].join("/");

  return `<div class="point ${top ? "top":"bottom"} ${alt ? "alt":""} ${isSource ? "legal-source":""} ${isSelected ? "selected-source":""} ${destinationMoves.length ? "legal-target":""}" data-point="${index}">
    <div class="stack">${color ? checkerHtml(color,count):""}</div>
    ${destinationMoves.length ? `<span class="target-marker">${targetDice}</span>` : ""}
  </div>`;
};

halfHtml = function enhancedHalfHtml(topIndices, bottomIndices, moves = currentLegalMoves()) {
  return `<div class="half">
    ${topIndices.map((number,index)=>pointHtml(number,true,index%2,moves)).join("")}
    ${bottomIndices.map((number,index)=>pointHtml(number,false,(index+1)%2,moves)).join("")}
  </div>`;
};

boardHtml = function enhancedBoardHtml(providedMoves = null) {
  const order = pointOrder();
  const moves = providedMoves || currentLegalMoves();
  const barIsSource = moves.some(move => move.from === "bar");
  const barIsSelected = selectedFrom === "bar";
  const offMoves = selectedFrom === null ? [] : bgMovesFrom(moves, selectedFrom).filter(move => move.to === "off");
  const whiteOffTarget = role === "white" && offMoves.length;
  const blackOffTarget = role === "black" && offMoves.length;
  const offDice = [...new Set(offMoves.map(move => move.die))].join("/");

  return `<div class="board">
    ${halfHtml(order.topLeft,order.bottomLeft,moves)}
    <div class="bar ${barIsSource ? "legal-source":""} ${barIsSelected ? "selected-source":""}" data-bar>
      <div class="bar-stack bar-black">${checkerHtml("black",state.bar.black)}</div>
      <div class="bar-title">BAR</div>
      <div class="bar-stack bar-white">${checkerHtml("white",state.bar.white)}</div>
    </div>
    ${halfHtml(order.topRight,order.bottomRight,moves)}
    ${state.dice.length ? `<div class="dice-float">${state.dice.map(die=>`<div class="die">${die}</div>`).join("")}</div>`:""}
    <div class="off left ${whiteOffTarget ? "legal-target":""}" data-off="white">W<br>${state.borneOff.white}${whiteOffTarget ? `<span class="target-marker off-marker">${offDice}</span>` : ""}</div>
    <div class="off right ${blackOffTarget ? "legal-target":""}" data-off="black">B<br>${state.borneOff.black}${blackOffTarget ? `<span class="target-marker off-marker">${offDice}</span>` : ""}</div>
  </div>`;
};

function bgDescribeSource(from) {
  return from === "bar" ? "checker on the bar" : `checker on point ${Number(from) + 1}`;
}

function bgShowError(message) {
  const error = document.querySelector("#err");
  if (error) error.textContent = message;
}

function bgSendMove(move) {
  socket.emit("move", move, response => {
    if (response && !response.ok) bgShowError(response.error);
  });
}

function bgBindBoardInteractions(moves) {
  document.querySelectorAll(".phone [data-point]").forEach(pointElement => {
    pointElement.addEventListener("click", () => {
      const point = Number(pointElement.dataset.point);

      if (selectedFrom !== null) {
        const destinationMove = moves.find(move =>
          bgSameLocation(move.from, selectedFrom) && bgSameLocation(move.to, point)
        );
        if (destinationMove) {
          bgSendMove(destinationMove);
          return;
        }
      }

      if (moves.some(move => bgSameLocation(move.from, point))) {
        selectedFrom = bgSameLocation(selectedFrom, point) ? null : point;
        renderPhone();
      }
    });
  });

  document.querySelector(".phone [data-bar]")?.addEventListener("click", () => {
    if (!moves.some(move => move.from === "bar")) return;
    selectedFrom = selectedFrom === "bar" ? null : "bar";
    renderPhone();
  });

  document.querySelectorAll(".phone [data-off]").forEach(offElement => {
    offElement.addEventListener("click", () => {
      if (offElement.dataset.off !== role || selectedFrom === null) return;
      const move = moves.find(candidate => bgSameLocation(candidate.from, selectedFrom) && candidate.to === "off");
      if (move) bgSendMove(move);
    });
  });
}

renderPhone = function enhancedRenderPhone() {
  const me = state.players[role]?.name || role;
  const myTurn = state.turn === role && state.status === "playing";
  const moves = currentLegalMoves();
  const selectedMoves = selectedFrom === null ? [] : bgMovesFrom(moves, selectedFrom);

  let guidance = "";
  if (myTurn && state.rolled) {
    if (!moves.length) guidance = "No legal moves remain. Confirm your turn.";
    else if (selectedFrom === null && state.bar[role] > 0) guidance = "Tap your checker on the center bar.";
    else if (selectedFrom === null) guidance = "Tap a glowing checker to select it.";
    else guidance = `Selected ${bgDescribeSource(selectedFrom)}. Tap a glowing destination.`;
  }

  app.innerHTML = `<section class="phone">
    <div class="phone-head"><strong>${me} · ${role}</strong><span>${state.score[role]} points</span></div>
    <div class="notice">${state.message}</div>
    <div class="board-wrap">${boardHtml(moves)}</div>
    <div class="controls">
      ${!myTurn ? `<div class="notice">Waiting for ${state.players[state.turn]?.name || state.turn}</div>` : ""}
      ${myTurn && !state.rolled ? `<button class="primary big" id="roll">Roll Dice</button>` : ""}
      ${myTurn && state.rolled ? `
        <div class="turn-guidance">${guidance}</div>
        <div class="dice-status"><strong>Remaining dice:</strong> ${state.remainingDice.join(", ") || "none"}</div>
        ${selectedMoves.length ? `<div class="destination-text">Available: ${selectedMoves.map(move => move.to === "off" ? `Bear off (${move.die})` : `Point ${Number(move.to)+1} (${move.die})`).join(" · ")}</div>` : ""}
        <div class="row">
          <button class="secondary" id="undo" ${state.turnHistory.length?"":"disabled"}>Undo</button>
          <button class="primary" id="confirm" ${moves.length?"disabled":""}>Confirm Turn</button>
        </div>
        <div id="err" class="error"></div>` : ""}
    </div>
  </section>`;

  document.querySelector("#roll")?.addEventListener("click",()=>socket.emit("roll",{}));
  bgBindBoardInteractions(moves);
  document.querySelector("#undo")?.addEventListener("click",()=>socket.emit("undo"));
  document.querySelector("#confirm")?.addEventListener("click",()=>socket.emit("confirm-turn",{},response=>{
    if (response && !response.ok) bgShowError(response.error);
  }));
};

render = function enhancedRender() {
  if (!state) return;
  selectedFrom = null;
  applyTheme(state.theme);
  if (role === "tv") renderTV();
  else renderPhone();
};
