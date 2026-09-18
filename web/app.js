/* Cassino table UI: wires the casino.js engine to the DOM. */

const HUMAN = 0;
const COMPUTER = 1;
const SUIT_SYMBOL = { S: "♠", H: "♥", D: "♦", C: "♣" };
const THINK_DELAY_MS = 650;

let game = null;
let thinking = false;
const selectedHand = new Set();
const selectedTable = new Set();

function makeCardElement(card) {
  const suit = card.slice(-1);
  const rank = card.slice(0, -1);
  const symbol = SUIT_SYMBOL[suit];
  const color = suit === "H" || suit === "D" ? "red" : "black";

  const el = document.createElement("div");
  el.className = `card ${color}`;
  el.dataset.card = card;

  const topLeft = document.createElement("div");
  topLeft.className = "corner top-left";
  topLeft.innerHTML = `${rank}<br>${symbol}`;

  const bottomRight = document.createElement("div");
  bottomRight.className = "corner bottom-right";
  bottomRight.innerHTML = `${rank}<br>${symbol}`;

  const pip = document.createElement("div");
  pip.className = "pip";
  pip.textContent = symbol;

  el.append(topLeft, pip, bottomRight);
  return el;
}

function makeCardBack() {
  const el = document.createElement("div");
  el.className = "card back";
  return el;
}

function renderHand(container, cards, { faceDown, selectable, selected, onToggle }) {
  container.innerHTML = "";
  if (faceDown) {
    for (let i = 0; i < cards.length; i++) container.appendChild(makeCardBack());
    return;
  }
  for (const card of cards) {
    const el = makeCardElement(card);
    if (selectable) {
      el.classList.add("selectable");
      el.addEventListener("click", () => onToggle(card));
    } else {
      el.classList.add("disabled");
    }
    if (selected && selected.has(card)) el.classList.add("selected");
    container.appendChild(el);
  }
}

function renderTable() {
  const container = document.getElementById("table-cards");
  container.innerHTML = "";
  const selectable = !thinking && game.player === HUMAN && !dealOver(game);
  for (const card of game.table) {
    const el = makeCardElement(card);
    if (selectable) {
      el.classList.add("selectable");
      el.addEventListener("click", () => toggleTableCard(card));
    } else {
      el.classList.add("disabled");
    }
    if (selectedTable.has(card)) el.classList.add("selected");
    container.appendChild(el);
  }
}

function toggleHandCard(card) {
  if (selectedHand.has(card)) selectedHand.delete(card);
  else selectedHand.add(card);
  render();
}

function toggleTableCard(card) {
  if (selectedTable.has(card)) selectedTable.delete(card);
  else selectedTable.add(card);
  render();
}

function updateStatus() {
  const el = document.getElementById("status");
  if (dealOver(game)) {
    el.textContent = "Deal over.";
  } else if (thinking) {
    el.textContent = "Computer is thinking…";
  } else {
    el.textContent = game.player === HUMAN ? "Your turn" : "Computer's turn";
  }
}

function updateSelectionInfo() {
  const el = document.getElementById("selection-info");
  if (dealOver(game) || thinking || game.player !== HUMAN) {
    el.textContent = "";
    return;
  }
  if (selectedHand.size === 0) {
    el.textContent = "Select a card from your hand.";
    return;
  }
  const hand = [...selectedHand];
  const handSum = sumValues(hand);
  if (selectedTable.size === 0) {
    el.textContent = `Playing ${hand.join(", ")} (value ${handSum}). Place it, or select table cards summing to ${handSum} to capture.`;
    return;
  }
  const table = [...selectedTable];
  const tableSum = sumValues(table);
  const legal = findLegalMove(game, hand, table);
  el.textContent = legal
    ? `Hand ${handSum} = table ${tableSum} — capture is legal.`
    : `Hand ${handSum} ≠ table ${tableSum} — not a legal capture.`;
}

function updateButtons() {
  const placeBtn = document.getElementById("place-btn");
  const captureBtn = document.getElementById("capture-btn");
  const humanTurn = !thinking && !dealOver(game) && game.player === HUMAN;
  placeBtn.disabled = !(humanTurn && selectedHand.size === 1 && selectedTable.size === 0);
  captureBtn.disabled = !(
    humanTurn &&
    selectedHand.size > 0 &&
    selectedTable.size > 0 &&
    findLegalMove(game, [...selectedHand], [...selectedTable])
  );
}

function render() {
  renderHand(document.getElementById("computer-hand"), game.hands[COMPUTER], {
    faceDown: true,
  });
  renderHand(document.getElementById("player-hand"), game.hands[HUMAN], {
    faceDown: false,
    selectable: !thinking && game.player === HUMAN && !dealOver(game),
    selected: selectedHand,
    onToggle: toggleHandCard,
  });
  renderTable();

  document.getElementById("talon-count").textContent = game.talon.length;
  document.getElementById("computer-pile-count").textContent = game.piles[COMPUTER].length;
  document.getElementById("player-pile-count").textContent = game.piles[HUMAN].length;

  const [youPts, computerPts] = score(game);
  document.getElementById("score-you").textContent = youPts;
  document.getElementById("score-computer").textContent = computerPts;

  updateStatus();
  updateSelectionInfo();
  updateButtons();
}

function clearSelection() {
  selectedHand.clear();
  selectedTable.clear();
  render();
}

function showOverlay() {
  const [youPts, computerPts] = score(game);
  let verdict;
  if (youPts > computerPts) verdict = "You win this deal!";
  else if (computerPts > youPts) verdict = "Computer wins this deal.";
  else verdict = "It's a tie.";
  document.getElementById("overlay-title").textContent = "Deal over";
  document.getElementById("overlay-detail").textContent =
    `${verdict} Final score — You: ${youPts}, Computer: ${computerPts}.`;
  document.getElementById("overlay").classList.remove("hidden");
}

function hideOverlay() {
  document.getElementById("overlay").classList.add("hidden");
}

/** Renders the state, then, if it's the computer's turn, plays it (looping
 * through any bonus turns) before handing control back to the human. */
function proceed() {
  thinking = !dealOver(game) && game.player === COMPUTER;
  render();
  if (dealOver(game)) {
    showOverlay();
  } else if (thinking) {
    setTimeout(() => {
      game = play(game, chooseMove(game));
      proceed();
    }, THINK_DELAY_MS);
  }
}

function afterHumanMove() {
  selectedHand.clear();
  selectedTable.clear();
  proceed();
}

function newGame() {
  const deck = shuffled(allCards());
  const first = Math.random() < 0.5 ? HUMAN : COMPUTER;
  game = newDeal(deck, first);
  thinking = false;
  hideOverlay();
  selectedHand.clear();
  selectedTable.clear();
  proceed();
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("place-btn").addEventListener("click", () => {
    if (document.getElementById("place-btn").disabled) return;
    const move = { hand: [...selectedHand], table: [] };
    game = play(game, move);
    afterHumanMove();
  });

  document.getElementById("capture-btn").addEventListener("click", () => {
    if (document.getElementById("capture-btn").disabled) return;
    const move = { hand: [...selectedHand], table: [...selectedTable] };
    game = play(game, move);
    afterHumanMove();
  });

  document.getElementById("clear-btn").addEventListener("click", clearSelection);
  document.getElementById("new-deal").addEventListener("click", newGame);
  document.getElementById("overlay-new-deal").addEventListener("click", newGame);

  newGame();
});
