"""Cassino: the Hungarian two-player version, 52-card French deck.

Cards are strings: rank, then suit. Ranks: A 2 3 4 5 6 7 8 9 10 J Q K.
Suits: S H D C.
"""
from dataclasses import dataclass
from itertools import combinations
from typing import NamedTuple, Optional

_RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]
_VALUES = {rank: i + 1 for i, rank in enumerate(_RANKS)}


def value(card):
    """A card's value: A=1, 2..10 face value, J=11, Q=12, K=13."""
    return _VALUES[card[:-1]]


class Move(NamedTuple):
    hand: frozenset
    table: frozenset


@dataclass(frozen=True)
class State:
    hands: tuple
    table: tuple
    talon: tuple
    piles: tuple
    sweeps: tuple
    player: int
    last_capturer: Optional[int] = None


def new_deal(deck, first=0):
    """Deal from `deck`: 3 cards to `first`, 3 to the other, 4 to the table."""
    d = tuple(deck)
    hands = [None, None]
    hands[first] = d[0:3]
    hands[1 - first] = d[3:6]
    return State(
        hands=tuple(hands),
        table=d[6:10],
        talon=d[10:],
        piles=((), ()),
        sweeps=(0, 0),
        player=first,
        last_capturer=None,
    )


def _nonempty_subsets(cards):
    cards = list(cards)
    for size in range(1, len(cards) + 1):
        yield from combinations(cards, size)


def legal_moves(state):
    """Every legal Move for the player to move."""
    hand = state.hands[state.player]
    table = state.table

    moves = {Move(frozenset((c,)), frozenset()) for c in hand}

    table_subsets_by_sum = {}
    for t in _nonempty_subsets(table):
        s = sum(value(c) for c in t)
        table_subsets_by_sum.setdefault(s, []).append(t)

    for h in _nonempty_subsets(hand):
        s = sum(value(c) for c in h)
        for t in table_subsets_by_sum.get(s, ()):
            moves.add(Move(frozenset(h), frozenset(t)))

    return moves


def play(state, move):
    """The state after `move`, including whatever the rules make happen next."""
    if move not in legal_moves(state):
        raise ValueError(f"illegal move: {move}")

    player = state.player
    other = 1 - player

    hands = list(state.hands)
    hands[player] = tuple(c for c in hands[player] if c not in move.hand)

    table = state.table
    table_was_empty = len(table) == 0
    piles = list(state.piles)
    sweeps = list(state.sweeps)
    last_capturer = state.last_capturer

    captured = bool(move.table)
    if captured:
        table = tuple(c for c in table if c not in move.table)
        piles[player] = piles[player] + tuple(move.hand | move.table)
        last_capturer = player
        if not table:
            sweeps[player] += 1
    else:
        (placed,) = move.hand
        table = table + (placed,)

    next_player = (
        player if (not captured and table_was_empty and hands[player]) else other
    )

    talon = state.talon
    if not hands[0] and not hands[1]:
        if talon:
            lead = last_capturer if last_capturer is not None else next_player
            if lead == 0:
                hands[0], hands[1] = talon[0:3], talon[3:6]
            else:
                hands[1], hands[0] = talon[0:3], talon[3:6]
            talon = talon[6:]
            next_player = lead
        elif table:
            collector = last_capturer if last_capturer is not None else player
            piles[collector] = piles[collector] + table
            table = ()
    elif not hands[next_player]:
        # A bonus turn can run one player's hand out ahead of the other's;
        # whoever still holds cards keeps the turn.
        next_player = 1 - next_player

    return State(
        hands=tuple(hands),
        table=table,
        talon=talon,
        piles=tuple(piles),
        sweeps=tuple(sweeps),
        player=next_player,
        last_capturer=last_capturer,
    )


def deal_over(state):
    """True once every card has been taken."""
    return not (
        state.hands[0] or state.hands[1] or state.talon or state.table
    )


def score(state):
    """A pair: the points each player earned in the finished deal."""

    def points(p):
        pile = state.piles[p]
        return (
            (3 if len(pile) >= 27 else 0)
            + (2 if sum(c.endswith("S") for c in pile) >= 7 else 0)
            + sum(c.startswith("A") for c in pile)
            + (2 if "10D" in pile else 0)
            + (1 if "2S" in pile else 0)
            + state.sweeps[p]
        )

    return (points(0), points(1))
