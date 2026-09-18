# Playtesting notes

Found by driving `web/index.html` end-to-end in headless Chromium (real
clicks through Place/Capture, not just reading the code).

## Bug found and fixed

- **Hand stayed disabled after the computer's turn.** `proceed()` in
  `web/app.js` called `render()` *before* updating the `thinking` flag, so
  the DOM was built from a stale value. Once the computer finished acting
  and handed the turn back, cards were still rendered `disabled` and stayed
  that way forever (no later render ever ran to correct it). Fixed by
  computing `thinking` first, then rendering once from the correct value.

## Things worth changing next

- **Live score during play is misleading.** `score()` scores "most cards"
  (≥27) and "most spades" (≥7) as pass/fail thresholds, which only mean
  anything once the deal is finished. Showing it live in the scoreboard
  can flash a point for a player who is currently ahead on cards but will
  lose that lead before the deal ends. Consider showing raw pile counts
  during play and only computing `score()` once `deal_over` is true.
- **Single deal only, no match play.** Traditional Cassino is played to a
  target score (commonly 11 or 21) across several deals, alternating who
  deals first. Right now "New deal" always starts a fresh 0–0 scoreboard.
  If a real match is wanted, `app.js` needs to accumulate `score()` across
  deals and alternate `first` in `newDeal`.
- **No capture hints.** The player has to spot legal combinations
  themselves; there's no highlighting of which table cards a selected hand
  card could capture. `legalMoves(game)` already has everything needed to
  highlight legal captures for the current selection.
- **Computer AI has no lookahead.** It greedily takes the largest capture
  available, or plays its lowest card. It never sets up or avoids setting
  up a capture for the opponent. Fine for a casual opponent, but a more
  competent AI is a natural next step.
- **`last_capturer is None` fallback is untested.** In `casino.py`, if no
  capture ever occurs before hands/talon run out, the code falls back to
  an arbitrary player for "who leads the redeal" / "who collects the
  leftover table". This path isn't exercised by the given tests (it's very
  unlikely to occur in practice) — worth a dedicated test if this matters
  for grading correctness rather than just passing the given suite.
- **No responsive/mobile layout check, no keyboard/accessibility support.**
  Only tested at 1000×750 in a desktop browser.
