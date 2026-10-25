# Landmark Piano

A browser app for learning where every note lives on the staff and the keyboard, using **landmark notes**
instead of memorizing every line and space. No install, no network needed after the fonts load.

Open `index.html` in a browser. Works on desktop and phone.

## How it teaches

Nine landmark notes anchor everything: Low C, Low F, Bass C, Bass F, Middle C, Treble G, Treble C, High G, High C.
For any note you find the nearest landmark and count one or two steps. The app shows that route in hints and
after every wrong answer.

16 levels in four tiers:

| Tier | Levels |
| --- | --- |
| Beginner | Keyboard geography, Middle C and octave Cs, three core landmarks, steps, skips (thirds) |
| Intermediate | Treble clef, bass clef, grand staff, ledger lines |
| Advanced | Sharps and flats, key signatures, far ledger lines and 8va/8vb |
| Expert | Enharmonics and double accidentals, alto and tenor clefs, intervals and chords, sight-reading lines |

Question types: read and play, name the note, find the key, name the key, place on the staff,
landmark steps, key signatures, intervals, chords, sight-reading lines. Each level has short lessons
with tappable keyboards, a 20-question round, and a 60-second speed round.

Two interactive machines, built with the Anatomy skill (isometric SVG figures, MIT licence): a **landmark rail**
(a rail of keys with a tape reel at each landmark, a carriage and a step-counting dial) on the Learn page and in
Level 3, and a **key action** (a cutaway of one grand-piano key: key, wippen, jack, hammer, strings, damper)
whose hammer physics drive the animation. Tap a key on the rail, or hold the key in the action, to hear it.

Other features: Smart review (weakest notes first, Leitner-style boxes), landmark guides on the staff and keys,
hints, a free Explore view, a keyboard heat map of what you have mastered, optional MIDI keyboard input
(Chrome or Edge), light and dark themes. Progress is stored in the browser's localStorage.

## Project layout

```
src/js/theory.js      notes, clefs, key signatures, landmarks, landmark routes
src/js/staff.js       SVG staff renderer (clefs, ledger lines, chords, 8va, guides)
src/js/keyboard.js    SVG piano keyboard
src/js/sound.js       Web Audio piano-like synth, Web MIDI input
src/js/store.js       progress and settings (localStorage)
src/js/curriculum.js  the 16 levels and their note pools
src/js/lessons.js     lesson slides
src/js/questions.js   question generators
src/js/ui-*.js        views: learn, lessons, drill, explore, progress, settings
src/js/glyphs.js      clef and accidental outlines extracted from Bravura
figures/              the two machines: landmark-rail/ and key-action/ (build.mjs, plus model.mjs and
                      parts.mjs for the action), shared lib/, and the vendored Anatomy kit in vendor/
tools/build.mjs       builds the figures, then bundles everything into index.html and dist/artifact.html
```

Each figure also builds a standalone page per theme (`figures/<name>/<name>.html` and `-light.html`) for checking in a browser.

Rebuild after editing anything in `src/`:

```
node tools/build.mjs
```

## Credits

Clef, accidental and notehead outlines come from the Bravura music font (SIL Open Font License 1.1),
see `tools/BRAVURA-LICENSE.txt`. The figure kit in `figures/vendor/anatomy/` is from the Anatomy skill by
Ryan (MIT), see its `LICENSE`.
