const bgImageThemes = {
  "real-wood": {
    image: "./themes/real-wood/board.svg"
  }
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
  const imageTheme = bgImageThemes[state.theme];
  const imageClass = imageTheme ? "image-board" : "";
  const imageStyle = imageTheme ? `style="--board-skin:url('${imageTheme.image}')"` : "";

  return `<div class="board ${imageClass}" ${imageStyle}>
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
