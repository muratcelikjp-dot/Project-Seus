# Project Seus / Ascend — Handoff

Last updated: 2026-11-28 (Japan time). Source: AO handoff note `project-seus-claude-devir.md`.

## Purpose

Ascend is a mobile-first RPG self-improvement PWA (plain HTML, CSS, global JavaScript) published on GitHub Pages. Preserve LocalStorage saves, GitHub Pages subpath compatibility, offline behavior, script order and visual identity. Project rules live in `AGENTS.md`; Claude-specific notes in `CLAUDE.md`.

## Current status

- `main` (`cf9d1eb`): Home command center and shield interactions merged via PR #2; Home, Quests and offline assets refined in `25b7338`; Home icons sharpened via PR #4 (`cf9d1eb`). The Home report verified HTTP 200 for four PNGs on live Pages (not re-checked for this handoff).
- **Quest radial prototype** is committed as `d28cbef` ("wip: quest radial prototype") on branch `origin/ao/quest-screen/root` (AO worktree `project-seus-5`). It is not on `main` and has no PR yet.
  - Changed: `quests.html`, `js/daily-checkin.js`, `js/app-version.js`, `sw.js`.
  - Added: `assets/quest-radial/`, `css/quest-radial.css`, `css/quest-radial-motion.css`, `js/quest-radial.js`, `js/quest-radial-preview.js`, `quest-radial-preview.html`.
  - Version `v1.5.113-test`, cache `v273`. 65 tests passed; drag-and-drop was emulated at 320/390/430 px. No physical iPhone PWA test recorded.
- Tooling: Agent Orchestrator 0.15.6 sees Project Seus as one repo with `main` as base. Project default agent is Claude Code; existing worker and orchestrator settings are Codex. AO settings were not changed in this transition.

## Open work

- Review the Quest prototype at 320/390/430 px in a browser and check the console.
- Test on a physical iPhone as an installed PWA.
- Decide whether to open a PR from `ao/quest-screen/root` to `main`.

## Key decisions (Quest prototype)

- Map is 2×2 as in the user's sketch: top row Strength and Intelligence, bottom row Charisma and Willpower. Each trait is a large hexagon with six adjacent small slots; right-column slots face left, left-column slots face right.
- The bottom + opens an arc menu adapted from Figma Riff 33 ([Figma source](https://www.figma.com/design/4POgcQSAJY0Yff9tc39zCD/Ascend-Design-System?node-id=199-5949)). Each trait has five preset quests in its own color. Custom Quest opens the existing quest form.
- Short tap prefills the form (title, trait, difficulty). Dragging detaches the button; empty slots of the same trait grow, glow and attract it. A valid drop creates an active quest and the chosen slot persists across reloads. Filled slots and other-trait slots reject the drop.
- Clean view hides the lower list and status areas. Tapping a filled slot opens the existing quest card in a dialog. Home sits below the header. While the Quest focus view is active, the daily check-in does not auto-open.
- URLs: full view `quests.html?sections=full`; 390 px preview `quests.html?preview=390`; add `&menu=strength` to open the Strength menu directly.

## Next step

Open the `project-seus-5` worktree (or check out `ao/quest-screen/root`), run `git status --short --branch` and `npm.cmd run verify`, do the mobile-width and iPhone checks above, then decide on a PR to `main`.
