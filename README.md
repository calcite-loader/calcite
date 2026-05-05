<p align="center">
  <img src="./assets/full.png" alt="Calcite" />
</p>

---

<div>
  <a href="https://addons.mozilla.org/en-US/firefox/addon/calcite/"><img src="https://blog.mozilla.org/addons/files/2020/04/get-the-addon-fx-apr-2020.svg" height="50" /></a>
  <a href="https://chromewebstore.google.com/detail/calcite/jgdekaolmcndccoomhomapdfhciiglfg"><img src="https://developer.chrome.com/static/docs/webstore/branding/image/iNEddTyWiMfLSwFD6qGq.png" height="50" /></a>
</div>

A simple mod loader for Geometry Dash's web port.

## Usage

Mods are written in JavaScript and have access to `window.gdGame` (the
`Phaser.Game` object) and `window.gdScene` (the main `Phaser.Scene` object).

Mods can optionally contain a header comment to dictate the naming and other
metadata about mods, otherwise mods will be added with the name "Untitled mod".

Uploading a mod with the same file name as a pre-existing mod will update the
contents of the mod.

## Roadmap

- [ ] Actions menu (for if a mod is completely breaking the site)
- [ ] Updating
  - [ ] Mod versioning
  - [ ] Auto update
- [x] Dependencies
- [x] Libraries
- [ ] Userscript build target
- [x] More event hooks (e.g. `onStart`, `onUpdate`, `onPause`)
- [x] Make patcher auto-extract required function names (and offset)
- [x] Broaden patcher method matching
- [x] Source mod compatibility
- [ ] Mod dev auto reload
- [ ] `file` setting type
- [x] Hotkeys API

---

## Disclaimer

This project is not affiliated with RobTop Games or Geometry Dash. This is a
community project containing none of the original code.
