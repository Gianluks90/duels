# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # dev server at http://localhost:4200 (auto-reload)
ng build           # production build → dist/duels/browser/
ng test            # run unit tests with Vitest
npx prettier --write .  # format all files
```

Firebase deployment (requires Firebase CLI login):
```bash
npx firebase-tools deploy --only hosting   # deploy static build
npx firebase-tools deploy --only firestore:rules  # deploy Firestore rules
```

## Project Overview

This is a digital companion/implementation for **MAGI**, a 1v1 physical card game. The authoritative rulebook is [documentation/rulebook/v2/rules.md](documentation/rulebook/v2/rules.md) — setup, card types, mana, turn structure (6 phases), spells, and the golden rule. The in-app rulebook dialog (`public/config/rulebook/it/*.md`) is sourced from it.

Earlier design notes in [documentation/rulebook/v1/](documentation/rulebook/v1/) and [documentation/spells_ideas.md](documentation/spells_ideas.md) are superseded brainstorm material, kept for history — not authoritative.

## Architecture

**Stack**: Angular 22 (standalone), Firebase v12, SCSS, TypeScript 6.

```
src/
  main.ts                         # bootstraps app; initializes Firebase once
  app/
    app.ts / app.html / app.scss  # root component with RouterOutlet
    app.config.ts                 # provideRouter + global providers
    app.routes.ts                 # route definitions, all lazy-loaded via loadComponent
    environment/
      firebase.config.ts          # Firebase project config (API keys)
    guards/
      auth.guard.ts               # authGuard / loginGuard route guards
    game/                         # pure game logic — no Angular, no Firestore I/O
      deck-builder.ts             # createInitialGameState, drawUpTo, deck/hand setup
      turn-engine.ts              # reducers: advanceTurnPhase, castSpell, combine*, resolvePreparation...
      derive-events.ts            # deriveGameEvents(prev, next) — diffs two GameState into GameEvent[]
    services/
      firebase.service.ts         # singleton wrapping Firestore instance (exposes `db: Firestore`)
      auth.service.ts             # Firebase Auth wrapper
      game.service.ts             # game document CRUD (GameDoc, surrender, listenToGame, etc.)
      game-engine.service.ts      # wraps turn-engine.ts reducers in Firestore runTransaction
      game-state.service.ts       # component-scoped: holds rawState/gameDoc for BoardComponent
      animation-queue.service.ts  # component-scoped: GameEvent → animation/flash overlay signals
      audio.service.ts            # background music + one-shot fx
      translation.service.ts      # i18n (TranslationService + translate.pipe)
      board-layout.service.ts     # responsive layout tier (mobile/tablet/desktop)
    models/                       # card/element/game/game-event/player/spell/turn-phase/user/wand types
    data/
      spells.ts                   # SPELL_CATALOG — the spell data (formula, mana cost, effects)
    components/                   # reusable presentational components (card, deck, player-hud, phase-tracker, ui/...)
    dialogs/                      # CDK Dialog components (game-settings, grimoire, options, rulebook, cast-spell, combine, socket, pile, profile)
    pages/                        # routed pages (home, login, setup, board, result)
```

**Firebase project**: `duels-2026` (europe-west12 region)
- Firestore: primary data store; rules in [firestore.rules](firestore.rules)
- Hosting: serves `dist/duels/browser/`

**State**: Use signals and `computed()` for all component state. `FirebaseService` exposes `db: Firestore` — build feature services on top of it using the Firestore SDK directly (no AngularFire).

**Animations**: `board.component.ts` never derives animations from Firestore snapshots by hand. Instead: `GameStateService` (component-scoped on `BoardComponent`) holds the raw, always-current `GameState`; on every change, `deriveGameEvents(prev, next)` (`src/app/game/derive-events.ts`) diffs it into a typed `GameEvent[]` (`src/app/models/game-event.model.ts`); `AnimationQueueService` (also component-scoped) consumes those events and owns the ephemeral "overlay" signals (ghosts, flashes, entering/drawing state) that templates read *alongside* the raw state — never a second, delayed copy of it. When adding a new animated transition, add a case to `deriveGameEvents` + a handler in `AnimationQueueService`, don't add another ad-hoc `effect()` in `board.component.ts`.

**Routing**: Feature routes use lazy loading (`loadComponent`); all routes except `login` are behind `authGuard` (`game/:gameId` included).

**Dialogs**: Opened via Angular CDK Dialog (`Dialog`, `DialogRef`, `DIALOG_DATA`) from page components, using the shared `dialog-backdrop` / `dialog-panel` global CSS classes.

**Styling**: Global styles in `src/styles.scss`; component styles are SCSS and kept relative to the component TS file.

## Coding Conventions

See [.claude/CLAUDE.md](.claude/CLAUDE.md) for the full Angular/TypeScript style guide enforced in this repo (signals, `OnPush`, standalone components, `input()`/`output()`, etc.).
