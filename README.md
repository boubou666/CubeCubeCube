# Cube Cube Cube

A small collection of relaxing browser puzzles, built with Three.js, vanilla JavaScript, and Vite. The home page offers illustrated cards for the 3D cube, 2D picture puzzles, and a 3D ant colony. No account, advertising, timers, or move limits.

**[Play online](https://boubou666.github.io/CubeCubeCube/)** · **[Source code](https://github.com/boubou666/CubeCubeCube)**

**[Play picture puzzles in 2D](https://boubou666.github.io/CubeCubeCube/image.html)**

**[Play the cube](https://boubou666.github.io/CubeCubeCube/cube.html)** · **[Play Colony](https://boubou666.github.io/CubeCubeCube/colony.html)**

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

Open **http://127.0.0.1:5173** and choose a game from the home cards. The cube is at `cube.html`; its existing progress remains intact. Its first 28 puzzles introduce the rules, mechanics, and shapes. Puzzle 29 begins a virtually unlimited generated journey. Choose **The collection** to browse opening puzzles by family, start or resume the journey, browse pages, or jump to a puzzle number. Finishing a puzzle always leads to the next one.

## Endless progression

Each numbered puzzle is generated from a stable seed: restart, undo, and reload preserve its identity. Difficulty tiers advance every eight generated puzzles. The curve adds larger boards, more arrows, longer paths, more forks, more colored connections, and a stronger preference for blocking dependencies. Cubes, prisms, tunnels, and integrated terraces alternate along the journey.

Boards grow from 7 to 10 cells per side; density and path length also have practical limits to keep the game readable and responsive. Later tiers continue varying layouts and biasing generation toward deeper dependencies. Difficulty varies between individual shapes while the overall curve rises.

Families cover foundations, connections, parking, branches, tunnels, terraces, deflection, rotation, and mixed mechanics. Endless tiers introduce pressure buttons at tier 2, fixed deflectors at tier 3, alternating deflectors at tier 4, rotating crowns at tier 5, and mixed pressure/deflection on terraces at tier 6. Stateful pockets reserve their surface and exit corridors so the surrounding filler cannot break their solutions.

Arrows are built in reverse solution order: their exit routes must be clear of all earlier arrows, both routes for a fork, and solid geometry. Several seeded candidates are compared for dependency depth and opening choices. Circle levels draw from 38 audited dependency layouts with three to five arrows, several stops, opposite-head choices, and coordinated forks. Early groups need at least three parking moves; later groups require four, five, then seven. Circle challenges continue appearing on unequal-face boards throughout the journey.

Parking groups reserve their surface so filler cannot break their solutions. Hints search each small group independently, then solve the surrounding arrows, avoiding an expensive search of the entire board. Choosing another head or parking order can block a solution: undo remains available, and hints explicitly explain when a step must be undone.

Generation retries and a deterministic density fallback handle crowded seeds. Only a small cache of generated boards and a page of collection cards are kept in memory. Completed endless puzzles are stored as merged number ranges, so thousands of consecutive completions occupy a few bytes rather than thousands of save entries.

## Rules and controls

- Drag the cube to inspect all six sides with unrestricted trackball rotation, including upside-down views. Scroll or pinch to zoom; the small rotation button restores the starting view.
- Tap any part of an arrow. It can leave if no other arrow lies between its head and the edge of that face in its pointing direction.
- Its tail follows its winding path, including around cube edges, before flying away.
- A blocked arrow briefly turns red and highlights its blocker. Attempts are unlimited.
- Colored ridges redirect an arrow onto the neighboring face. Movement continues across painted edges until an ordinary edge or a pause circle; blockers are checked on every face along that route. A completely closed route cannot leave the board.
- Opposite-ended two-headed arrows move toward the head you tap. Forks count as one arrow and move both heads along their own routes simultaneously. Both routes must be clear, whichever head or part of the body you tap.
- A small circle pauses an arrow when its head reaches it. Its new body position changes which arrows it blocks; tap again to resume. Level 17 requires parking an arrow to break a dependency cycle.
- A pressure button also pauses a head. It holds gates of the same color open while the head stays there; its gates close as soon as that head departs. A departing head cannot use its own released gate.
- Every arrow and either live fork head can operate a button. Mechanism levels briefly lock all arrow input during movement, then unlock when it finishes. If an animation fails, the committed final state is restored and play continues.
- Blue bent tiles turn a passing head 90 degrees left or right. Striped purple tiles do the same, then reverse their turn for the next head. A blocked move never changes a deflector. These tiles are operated by arrows, with no direct tile controls.
- Parking a head on a blue spiral turns the upper section 90 degrees around the vertical axis. Its arrows, tiles, and colored ridges rotate with it. Arrows spanning the moving seam prevent rotation until cleared. The first rotating shape uses a square crown above a fixed base, so all four orientations preserve the solid geometry.
- Later boards include rectangular prisms, a tunnel through a solid, and a larger solid with a stepped section cut into one corner. Arrows use the exposed surface, including inner walls, treads, and risers. An exit must clear the solid itself; generated arrows cannot fly into a tunnel wall or another part of the shape.
- An ordinary exit still checks its flight against other arrows. An arrow across a hole on the same face blocks it, while a visually overlapping arrow at another depth does not.
- Clear every arrow to finish the level. Undo, hints, and restart are always available.
- Keyboard: **arrow keys** rotate; **H** highlights a removable arrow and turns the camera toward it; **Enter** releases the highlighted arrow; **U** undoes; **R** restarts.
- Sound is optional. Choose from Warm ivory, Garden mint, and Quiet dusk palettes.

Current puzzle progress, undo history, completed puzzles, journey position, sound, and palette preferences are saved in browser local storage. Saved moves include the chosen head and circle parking, so reloading restores the moved board and undo history. Original saves are migrated automatically. Only the active puzzle's partial progress is retained when switching levels. Completed level badges remain earned if you replay or undo. Clearing browser storage resets progress.

Save format 4 also replays button parking, alternating turns, and section rotations. Earlier endless indices and completion ranges shift by five to make room for the new lessons. An existing endless session retains the previous mechanic generation until the player starts another puzzle; all movement uses the corrected collision rules.

Generator 3 adds the richer circle layouts. Saves from generators 1 and 2 keep the active puzzle and its move history intact, including after restart. Starting another numbered puzzle uses generator 3.

## Verification

```powershell
npm test
npm run test:browser
npm run build
```

Local browser tests use an installed Microsoft Edge. CI uses Playwright-managed Chromium, installed with `npx playwright install --with-deps chromium`.

The tests verify the 28 opening solutions and generated samples across early, late, billionth, and safe-integer-limit puzzle numbers. They check surface topology, arrow and branch connectivity, solid exits and gap-flight collisions, obstruction rules, circle and button parking, gate closure, deflector transactions, moving sections and seams, difficulty progression, undo, compact completion ranges, save replay, actual mouse picking, rotation, complete keyboard play, endless continuation, family filtering, collection paging, dialogs, preferences, and desktop/mobile layouts. The production bundle is generated in `dist/`; use `npm run preview` to serve it locally.

## Structure

- `src/home-main.js`, `src/home-style.css`: illustrated home cards and links to each independent game.
- `src/colony-puzzle.js`: outside-space reachability, color quotas, guaranteed-solution level construction, five-slot simulation, hints, undo, and validated saves.
- `src/colony-scene.js`: Three.js pixel cubes, original ant meshes, path-following pickup/return animation, and a garden tray.
- `src/colony-main.js`, `src/colony-style.css`: Colony controls, queues, collection, responsive layouts, and independent local-storage progress.
- `src/puzzle.js`: discrete surface topology for cubes and voxel solids, branching arrows, movement rules, seeded level generation, solution search, and game state. No Three.js or DOM dependencies.
- `src/mechanics.js`: pressure occupancy, gates, fixed and alternating turns, rigid section rotation, transactional movement, stateful solution search, and mechanic lesson layouts.
- `src/parking.js`: audited circle dependency patterns, tier selection, and seeded surface placement.
- `src/scene.js`: rounded cube, arrow meshes, occlusion-aware picking, free trackball controls, quaternion camera transitions, and path-following animations.
- `src/main.js`: interface, input, sound, preferences, and progress orchestration.
- `src/storage.js`: versioned browser save format, validation, and graceful handling of unavailable storage.
- `src/style.css`: desktop and touch layouts, dialogs, and reduced-motion support.

The opening puzzle and mechanic tutorials are handcrafted. Larger boards use fixed, audited seeds. Generation constructs arrows in reverse removal order, so every selected board has a complete solution. On boards without circles, picking any removable arrow cannot introduce a deadlock because removal only clears occupied cells. Circle puzzles can change occupancy; hints search board states to find the next move in a complete solution.

## Picture puzzles (2D)

Open `image.html`, or choose **Picture puzzles** from the cube game. A sample landscape is playable immediately. Upload a photo or screenshot, drop an image, paste with Ctrl+V / Command+V, or use the clipboard button. Direct image links work when the source allows CORS; webpage links require uploading a screenshot for this first version. There is no screenshot backend.

Drag in the preview to select a crop, or choose Whole image, Square, Portrait, or Wide. Choose Gentle, Thoughtful, or Tangled difficulty and Soft, Balanced, or Fine detail, then **Create puzzle**. **Try different paths** makes a fresh seeded arrangement of the same image. Restart keeps the current arrangement. All image processing and puzzle generation run locally; uploads are never sent to a server.

The flat generator partitions visible image cells in removal order, growing tails into the remaining image while each new head has a clear exit. Every arrow spans at least five cells; target lengths are longer to reduce repetitive clicking. Short fragments join existing tails or body detours when that preserves a clear solution; fragments that cannot join stay empty. Crops too fragmented to form any long arrow show a message asking for a larger visible area or more detail. The construction order proves solvability, and any available removal keeps the puzzle solvable. Paths favour neighbouring colours and avoid strong colour boundaries. Each body segment and head samples the corresponding image pixels, retaining those colours during departure. Partial transparency is composited against white; fully transparent cells are left empty. Uploaded sources are resized to at most 1200 pixels on their longest edge and saved losslessly. Grid resolution follows the crop's aspect ratio, with a 72-cell limit per axis and a minimum of four cells for very thin crops. Saved boards with shorter arrows regenerate once, retaining the source, crop, and settings and resetting that board's move history.

Tap an arrow to release it. Blocked paths are outlined, and **H** highlights a clear arrow; **Enter** releases the hint, **U** undoes, and **R** restarts. Scroll or pinch to zoom, drag to pan, and use **Fit** to centre the board. **Original** shows the cropped source image for comparison. Images, exact generated boards, and move history are saved in IndexedDB separately from the cube's local-storage progress. Invalid saves fall back to a fresh sample puzzle. File imports are limited to 15 MB and 40 megapixels.

The picture page uses Canvas 2D and a small module Worker, and does not load Three.js. Its modules are `src/image-puzzle.js` (rules and generation), `src/image-scene.js` (rendering and picking), `src/image-main.js` (import/crop and UI), `src/image-worker.js` (generation), and `src/image-storage.js` (local persistence). Both HTML entry points are included in GitHub Pages and release builds.

The game implements the described mechanics with its own branding, art, and levels. It does not reproduce CubeAway's complete level catalog or special power-ups. WebGL is required; all assets and dependencies are served locally, with no CDN requests.

## Colony (3D)

Open `colony.html`, choose **Colony** from either game's navigation, or use its home card. This original implementation takes inspiration from [Colony Flow's color-box and ant collection mechanics](https://play.google.com/store/apps/details?id=com.abi.colony.flow). The artwork, levels, interface and models are created for this project.

Select the top box of one of four queues. It occupies one of five active slots and sends up to four workers to cubes of its color. Only cubes adjacent to outside-connected empty space are accessible; enclosed holes remain blocked. Workers follow those empty corridors, remove a cube on arrival and carry it back. The box counter decreases on delivery, and a filled box releases its slot. Boxes whose color is still buried wait. Five waiting boxes cause a deadlock; undo is always available.

Six 16×16 original pictures introduce the game: a plant, mushroom, fox, rocket, ice cream and flower. Later numbered puzzles add borders and smaller color quotas. Reserves are generated from a complete legal harvest sequence, with exact totals for every color. The collection shows twelve puzzles around the current journey page, and a number field allows jumping up to puzzle 1,000,000.

Use **Un petit indice** for a move verified by a bounded state search, **Annuler** to restore the complete previous state, and **Recommencer** to reset the same puzzle. Pause and ×2 change the animation pace. H asks for a hint, Enter sends the indicated box, U undoes, R restarts, 1–4 choose a queue, and Space pauses when the canvas is focused. Dialogs and hidden tabs suspend simulation.

Colony uses its own versioned local-storage key. Saves include queue positions, active boxes, trips in progress, undo states, completed puzzles and speed. Invalid saves fall back to the first puzzle. Storage failures do not prevent playing. Cube and picture progress remain independent. The static build includes `index.html`, `cube.html`, `image.html` and `colony.html`, with links compatible with the configured GitHub Pages base path.
