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
    services/
      firebase.service.ts         # singleton wrapping Firestore instance
      auth.service.ts             # Firebase Auth wrapper
      game.service.ts             # game document CRUD (GameDoc, surrender, etc.)
    models/                       # card/element/game/player/spell/turn-phase/user/wand types
    components/                   # reusable presentational components (card, deck, player-hud, ...)
    dialogs/                      # CDK Dialog components (game-settings, grimoire, options, rulebook)
    pages/                        # routed pages (home, login, setup, board, result)
```

**Firebase project**: `duels-2026` (europe-west12 region)
- Firestore: primary data store; rules in [firestore.rules](firestore.rules)
- Hosting: serves `dist/duels/browser/`

**State**: Use signals and `computed()` for all component state. `FirebaseService` exposes `database: Firestore` — build feature services on top of it using the Firestore SDK directly (no AngularFire).

**Routing**: Feature routes use lazy loading (`loadComponent`); most are behind `authGuard`. Note: `game/:gameId` currently has no `canActivate` guard — a known temporary/debug state, not yet cleaned up.

**Dialogs**: Opened via Angular CDK Dialog (`Dialog`, `DialogRef`, `DIALOG_DATA`) from page components, using the shared `dialog-backdrop` / `dialog-panel` global CSS classes.

**Styling**: Global styles in `src/styles.scss`; component styles are SCSS and kept relative to the component TS file.

## Coding Conventions

See [.claude/CLAUDE.md](.claude/CLAUDE.md) for the full Angular/TypeScript style guide enforced in this repo (signals, `OnPush`, standalone components, `input()`/`output()`, etc.).
