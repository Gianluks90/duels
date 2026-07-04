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

This is a digital companion/implementation for **MAGI**, a 1v1 physical card game. The full game rules and card definitions are in [documentation/](documentation/):

- [regolamento.md](documentation/regolamento.md) — turn structure, Fonte Elementale, wand mechanics
- [idee.md](documentation/idee.md) — approved game elements, mana spheres, card counts
- [grimorio.md](documentation/grimorio.md) — wand-tip spells (Incantesimi Legati)

## Architecture

**Stack**: Angular 22 (standalone), Firebase v12, SCSS, TypeScript 6.

```
src/
  main.ts                         # bootstraps app; initializes Firebase once
  app/
    app.ts / app.html / app.scss  # root component with RouterOutlet
    app.config.ts                 # provideRouter + global providers
    app.routes.ts                 # route definitions (currently empty)
    environment/
      firebase.config.ts          # Firebase project config (API keys)
    services/
      firebase-service.ts         # singleton wrapping Firestore instance
```

**Firebase project**: `duels-2026` (europe-west12 region)
- Firestore: primary data store; rules in [firestore.rules](firestore.rules)
- Hosting: serves `dist/duels/browser/`

**State**: Use signals and `computed()` for all component state. `FirebaseService` exposes `database: Firestore` — build feature services on top of it using the Firestore SDK directly (no AngularFire).

**Routing**: Feature routes should use lazy loading (`loadComponent`).

**Styling**: Global styles in `src/styles.scss`; component styles are SCSS and kept relative to the component TS file.

## Coding Conventions

See [.claude/CLAUDE.md](.claude/CLAUDE.md) for the full Angular/TypeScript style guide enforced in this repo (signals, `OnPush`, standalone components, `input()`/`output()`, etc.).
