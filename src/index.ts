import * as Phaser from "phaser";
import { injectMenuButton } from "./menuButton";

import { initMenu } from "./ui";
import { hasLoaded, loadMods, modInitCallbacks } from "./mods";
import { initPatcher } from "./patcher";
import { registerHooks } from "./hooks";
import { initHotkeys } from "./hotkeys";
import { initUtils } from "./utils";

initUtils();
initPatcher();

const executeHook = () => {
  loadMods();

  let _phaser: typeof Phaser | undefined = undefined;

  Object.defineProperty(window, "Phaser", {
    get: function () {
      return _phaser;
    },
    set: function (value) {
      _phaser = value;

      console.log("Phaser loaded! Injecting Phaser.Game hook...");

      setTimeout(() => {
        (window as any).phaserLoaded = true;
        window.dispatchEvent(new Event("phaser-loaded"));
      }, 0);

      const OriginalGame = _phaser?.Game;
      (_phaser!.Game as any) = function (
        config: Phaser.Types.Core.GameConfig,
      ) {
        const instance = new OriginalGame!(config);
        window.gdGame = instance;

        // Scene Hook
        if (config.scene != null) {
          const scenes = Array.isArray(config.scene)
            ? config.scene
            : [config.scene];

          for (const scene of scenes) {
            const target = (typeof scene === "function")
              ? scene.prototype
              : scene;
            if (!target) continue;

            // IDK this was the most consistant method i could find, hooking .create woudln't give me access to the `this` object fsr.
            Object.defineProperty(target, "sys", {
              get: function () {
                if (!this._hooked) {
                  this._hooked = true;
                  if (this._sys.settings.key == "GameScene") {
                    window.gdScene = this;

                    const checkReady = () => {
                      if (this._sys && this._sys.events) {
                        this._sys.events.once("start", () => {
                          console.log("Geometry Dash Loaded!");
                          setTimeout(() => {
                            initHotkeys();
                            hasLoaded();
                            initMenu();
                            injectMenuButton();
                            modInitCallbacks.forEach((cb) => cb());

                            registerHooks();
                          }, 0);
                        });
                        return;
                      }
                      requestAnimationFrame(checkReady);
                    };

                    checkReady();
                  }
                }
                return this._sys;
              },
              set: function (value) {
                this._sys = value;
              },
              configurable: true,
            });
          }
        }

        return instance;
      };
    },
    configurable: true,
  });

  console.log("Calcite Hook Loaded!");
};

executeHook();
