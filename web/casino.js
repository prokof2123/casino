/*
 * Cassino engine — a faithful JS port of casino.py, for the browser table.
 * Cards are strings: rank then suit. Ranks A 2 3 4 5 6 7 8 9 10 J Q K, suits S H D C.
 */

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const VALUES = Object.fromEntries(RANKS.map((r, i) => [r, i + 1]));
const SUITS = ["S", "H", "D", "C"];

function cardValue(card) {
  return VALUES[card.slice(0, -1)];
}

function allCards() {
  const cards = [];
  for (const s of SUITS) for (const r of RANKS) cards.push(r + s);
  return cards;
}

function shuffled(cards) {
  const d = cards.slice();
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function newDeal(deck, first = 0) {
  const hands = [null, null];
  hands[first] = deck.slice(0, 3);
  hands[1 - first] = deck.slice(3, 6);
  return {
    hands,
    table: deck.slice(6, 10),
    talon: deck.slice(10),
    piles: [[], []],
    sweeps: [0, 0],
    player: first,
    lastCapturer: null,
  };
}

function* nonemptySubsets(cards) {
  const n = cards.length;
  for (let mask = 1; mask < (1 << n); mask++) {
    const subset = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) subset.push(cards[i]);
    yield subset;
  }
}

function sumValues(cards) {
  return cards.reduce((total, c) => total + cardValue(c), 0);
}

function moveKey(hand, table) {
  return JSON.stringify([hand.slice().sort(), table.slice().sort()]);
}

function legalMoves(state) {
  const hand = state.hands[state.player];
  const table = state.table;
  const moves = [];
  const seen = new Set();

  function add(handArr, tableArr) {
    const h = handArr.slice().sort();
    const t = tableArr.slice().sort();
    const key = moveKey(h, t);
    if (!seen.has(key)) {
      seen.add(key);
      moves.push({ hand: h, table: t });
    }
  }

  for (const c of hand) add([c], []);

  const tableBySum = new Map();
  for (const t of nonemptySubsets(table)) {
    const s = sumValues(t);
    if (!tableBySum.has(s)) tableBySum.set(s, []);
    tableBySum.get(s).push(t);
  }

  for (const h of nonemptySubsets(hand)) {
    const s = sumValues(h);
    const candidates = tableBySum.get(s);
    if (candidates) for (const t of candidates) add(h, t);
  }

  return moves;
}

function findLegalMove(state, hand, table) {
  const key = moveKey(hand, table);
  return legalMoves(state).find((m) => moveKey(m.hand, m.table) === key) || null;
}

function play(state, move) {
  const found = findLegalMove(state, move.hand, move.table);
  if (!found) throw new Error("illegal move: " + JSON.stringify(move));
  move = found;

  const player = state.player;
  const other = 1 - player;

  const hands = [state.hands[0].slice(), state.hands[1].slice()];
  const handSet = new Set(move.hand);
  hands[player] = hands[player].filter((c) => !handSet.has(c));

  let table = state.table.slice();
  const tableWasEmpty = table.length === 0;
  const piles = [state.piles[0].slice(), state.piles[1].slice()];
  const sweeps = state.sweeps.slice();
  let lastCapturer = state.lastCapturer;

  const captured = move.table.length > 0;
  if (captured) {
    const tableSet = new Set(move.table);
    table = table.filter((c) => !tableSet.has(c));
    piles[player] = piles[player].concat(move.hand, move.table);
    lastCapturer = player;
    if (table.length === 0) sweeps[player] += 1;
  } else {
    table.push(move.hand[0]);
  }

  let nextPlayer =
    !captured && tableWasEmpty && hands[player].length > 0 ? player : other;

  let talon = state.talon.slice();
  if (hands[0].length === 0 && hands[1].length === 0) {
    if (talon.length > 0) {
      const lead = lastCapturer !== null ? lastCapturer : nextPlayer;
      if (lead === 0) {
        hands[0] = talon.slice(0, 3);
        hands[1] = talon.slice(3, 6);
      } else {
        hands[1] = talon.slice(0, 3);
        hands[0] = talon.slice(3, 6);
      }
      talon = talon.slice(6);
      nextPlayer = lead;
    } else if (table.length > 0) {
      const collector = lastCapturer !== null ? lastCapturer : player;
      piles[collector] = piles[collector].concat(table);
      table = [];
    }
  } else if (hands[nextPlayer].length === 0) {
    nextPlayer = 1 - nextPlayer;
  }

  return { hands, table, talon, piles, sweeps, player: nextPlayer, lastCapturer };
}

function dealOver(state) {
  return (
    state.hands[0].length === 0 &&
    state.hands[1].length === 0 &&
    state.talon.length === 0 &&
    state.table.length === 0
  );
}

function score(state) {
  function points(p) {
    const pile = state.piles[p];
    let s = 0;
    if (pile.length >= 27) s += 3;
    if (pile.filter((c) => c.endsWith("S")).length >= 7) s += 2;
    s += pile.filter((c) => c.startsWith("A")).length;
    if (pile.includes("10D")) s += 2;
    if (pile.includes("2S")) s += 1;
    s += state.sweeps[p];
    return s;
  }
  return [points(0), points(1)];
}

/** A reasonably competent, non-lookahead computer player. */
function chooseMove(state) {
  const moves = legalMoves(state);
  const cardsLeft = state.hands[0].length + state.hands[1].length + state.talon.length;
  const captures = moves.filter((m) => m.table.length > 0);

  if (captures.length > 0 && cardsLeft > 1) {
    captures.sort((a, b) => {
      if (a.table.length !== b.table.length) return b.table.length - a.table.length;
      const at = moveKey(a.hand, a.table);
      const bt = moveKey(b.hand, b.table);
      return at < bt ? -1 : at > bt ? 1 : 0;
    });
    return captures[0];
  }

  const placements = moves.filter((m) => m.table.length === 0);
  placements.sort((a, b) => (a.hand[0] < b.hand[0] ? -1 : a.hand[0] > b.hand[0] ? 1 : 0));
  return placements[0];
}
