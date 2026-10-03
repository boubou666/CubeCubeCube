# Cube Cube Cube

A relaxing, original browser puzzle inspired by CubeAway's arrow-clearing idea. Built with Three.js, vanilla JavaScript, and Vite. No account, advertising, timers, or move limits.

**[Play online](https://boubou666.github.io/CubeCubeCube/)** · **[Source code](https://github.com/boubou666/CubeCubeCube)**

**[Changelog](CHANGELOG.md)** · **[Releases](https://github.com/boubou666/CubeCubeCube/releases)**

## Publishing

GitHub Pages serves the production build. Every push to `main` runs the puzzle tests and Chromium gameplay tests, then builds and deploys the game through `.github/workflows/pages.yml`. The workflow supplies the repository base path to Vite, so assets and the home link work under `/CubeCubeCube/`. It can also be run manually from GitHub Actions.

## Releases and changelog

Record notable changes in the `Unreleased` section of `CHANGELOG.md`, under the relevant Keep a Changelog headings. For a release:

1. Update the version in `package.json` and `package-lock.json` together, for example with `npm version 0.2.0 --no-git-tag-version`.
2. Move the pending notes into a dated `## [0.2.0] - YYYY-MM-DD` section and update the comparison links.
3. Commit and push the changes to `main`, then wait for its checks to pass.
4. Create and push an annotated matching tag: `git tag -a v0.2.0 -m "Cube Cube Cube v0.2.0"`, then `git push origin v0.2.0`.

The `Publish release` workflow validates the tag, package versions, dated changelog entry, and membership in `main`. It runs the tests, builds a portable static website, and creates a GitHub release using the matching changelog notes. The release includes a `CubeCubeCube-vX.Y.Z-web.zip` archive; source archives are also provided by GitHub. Prerelease versions such as `v0.2.0-beta.1` are marked as prereleases automatically. Existing tags are never moved.

## Play locally

Requires Node.js 20.19+ or 22.12+ (tested with Node 24).

```powershell
npm install
npm run dev
```

Open **http://127.0.0.1:5173**. The first 23 puzzles introduce the rules, mechanics, and shapes. Puzzle 24 begins a virtually unlimited generated journey. Choose **The collection** to start or resume that journey, browse pages of puzzles, or jump to a puzzle number. Finishing a puzzle always leads to the next one.

## Endless progression

Each numbered puzzle is generated from a stable seed: restart, undo, and reload preserve its identity. Difficulty tiers advance every eight generated puzzles. The curve adds larger boards, more arrows, longer paths, more forks, more colored connections, and a stronger preference for blocking dependencies. Cubes, prisms, tunnels, and integrated terraces alternate along the journey.

Boards grow from 7 to 10 cells per side; density and path length also have practical limits to keep the game readable and responsive. Later tiers continue varying layouts and biasing generation toward deeper dependencies. Difficulty varies between individual shapes while the overall curve rises.

Arrows are built in reverse solution order: their exit routes must be clear of all earlier arrows, both routes for a fork, and solid geometry. Several seeded candidates are compared for dependency depth and opening choices. Circle levels contain protected parking pockets that require parking a short arrow to free a winding one; filler arrows cannot cross those pockets or their routes. This preserves solvability after any legal move and lets hints work on large boards without an expensive global search.

Generation retries and a deterministic density fallback handle crowded seeds. Only a small cache of generated boards and a page of collection cards are kept in memory. Completed endless puzzles are stored as merged number ranges, so thousands of consecutive completions occupy a few bytes rather than thousands of save entries.

## Rules and controls

- Drag the cube to inspect all six sides with unrestricted trackball rotation, including upside-down views. Scroll or pinch to zoom; the small rotation button restores the starting view.
- Tap any part of an arrow. It can leave if no other arrow lies between its head and the edge of that face in its pointing direction.
- Its tail follows its winding path, including around cube edges, before flying away.
- A blocked arrow briefly turns red and highlights its blocker. Attempts are unlimited.
- Colored ridges redirect an arrow onto the neighboring face. Movement continues across painted edges until an ordinary edge or a pause circle; blockers are checked on every face along that route. A completely closed route cannot leave the board.
- Opposite-ended two-headed arrows move toward the head you tap. Forks count as one arrow and move both heads along their own routes simultaneously. Both routes must be clear, whichever head or part of the body you tap.
- A small circle pauses an arrow when its head reaches it. Its new body position changes which arrows it blocks; tap again to resume. Level 17 requires parking an arrow to break a dependency cycle.
- Later boards include rectangular prisms, a tunnel through a solid, and a larger solid with a stepped section cut into one corner. Arrows use the exposed surface, including inner walls, treads, and risers. An exit must clear the solid itself; generated arrows cannot fly into a tunnel wall or another part of the shape.
- Clear every arrow to finish the level. Undo, hints, and restart are always available.
- Keyboard: **arrow keys** rotate; **H** highlights a removable arrow and turns the camera toward it; **Enter** releases the highlighted arrow; **U** undoes; **R** restarts.
- Sound is optional. Choose from Warm ivory, Garden mint, and Quiet dusk palettes.

Current puzzle progress, undo history, completed puzzles, journey position, sound, and palette preferences are saved in browser local storage. Saved moves include the chosen head and circle parking, so reloading restores the moved board and undo history. Original saves are migrated automatically. Only the active puzzle's partial progress is retained when switching levels. Completed level badges remain earned if you replay or undo. Clearing browser storage resets progress.

## Verification

```powershell
npm test
npm run test:browser
npm run build
```

Local browser tests use an installed Microsoft Edge. CI uses Playwright-managed Chromium, installed with `npx playwright install --with-deps chromium`.

The tests verify the 23 opening solutions and generated samples across early, late, billionth, and safe-integer-limit puzzle numbers. They check surface topology, arrow and branch connectivity, solid exits, obstruction rules, circle parking, difficulty progression, undo, compact completion ranges, save replay, actual mouse picking, rotation, complete keyboard play, endless continuation, collection paging, dialogs, preferences, and desktop/mobile layouts. The production bundle is generated in `dist/`; use `npm run preview` to serve it locally.

## Structure

- `src/puzzle.js`: discrete surface topology for cubes and voxel solids, branching arrows, movement rules, seeded level generation, solution search, and game state. No Three.js or DOM dependencies.
- `src/scene.js`: rounded cube, arrow meshes, occlusion-aware picking, free trackball controls, quaternion camera transitions, and path-following animations.
- `src/main.js`: interface, input, sound, preferences, and progress orchestration.
- `src/storage.js`: versioned browser save format, validation, and graceful handling of unavailable storage.
- `src/style.css`: desktop and touch layouts, dialogs, and reduced-motion support.

The opening puzzle and mechanic tutorials are handcrafted. Larger boards use fixed, audited seeds. Generation constructs arrows in reverse removal order, so every selected board has a complete solution. On boards without circles, picking any removable arrow cannot introduce a deadlock because removal only clears occupied cells. Circle puzzles can change occupancy; hints search board states to find the next move in a complete solution.

The game implements the described mechanics with its own branding, art, and levels. It does not reproduce CubeAway's complete level catalog or special power-ups. WebGL is required; all assets and dependencies are served locally, with no CDN requests.
