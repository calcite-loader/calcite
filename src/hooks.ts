import type { EventCallback } from "@calcite-loader/types";
import type { ModData } from "./mods";
import { reportError } from "./ui/error";

type Callbacks = {
  before: {
    cb: (prevented: boolean, preventDefault: () => void) => void;
    mod?: ModData;
  }[];
  after: { cb: (prevented: boolean) => void; mod?: ModData }[];
};

const callbacks = {
  start: { before: [], after: [] } as Callbacks,
  complete: { before: [], after: [] } as Callbacks,
  pause: { before: [], after: [] } as Callbacks,
  death: { before: [], after: [] } as Callbacks,
  spawn: { before: [], after: [] } as Callbacks,
  ship: { before: [], after: [] } as Callbacks,
  cube: { before: [], after: [] } as Callbacks,
  update: { before: [], after: [] } as Callbacks,
};

export const createEventCallback =
  (name: keyof typeof callbacks, mod?: ModData): EventCallback =>
  (
    cb: (prevented: boolean, preventDefault: () => void) => void,
    when: "before" | "after" = "after",
  ) => {
    callbacks[name][when].push({ cb: cb as any, mod });
  };

interface HookConfig {
  hookName: keyof typeof callbacks;
  target: any;
  method: string;
}

const createHookWrapper = (
  { hookName, target, method }: HookConfig,
) => {
  const ignoredErrors = new Set<string>();

  const processError = (e: Error, mod?: ModData) => {
    const errorKey = (mod?.id ?? "UNKNOWN") + "-" + e.message;
    if (ignoredErrors.has(errorKey)) return;

    const errorMessage = `${e.name}: ${e.message}${
      ("lineNumber" in e && "columnNumber" in e)
        ? ` at ${e.lineNumber}:${e.columnNumber}`
        : ""
    }`;

    reportError(
      errorMessage,
      mod ? [mod] : [],
      false,
      () => ignoredErrors.add(errorKey),
    );
  };

  const original = target[method];
  return function (...callArgs: any[]) {
    let prevented = false;

    for (const cb of callbacks[hookName].before) {
      try {
        cb.cb(prevented, () => {
          prevented = true;
        });
      } catch (e) {
        processError(e as Error, cb.mod);
      }
    }

    if (!prevented) {
      original.call(target, ...callArgs);
    }

    for (const cb of callbacks[hookName].after) {
      try {
        cb.cb(prevented);
      } catch (e) {
        processError(e as Error, cb.mod);
      }
    }
  };
};

export const registerHooks = () => {
  window.gdScene._startGame = createHookWrapper({
    hookName: "start",
    target: window.gdScene,
    method: "_startGame",
  });

  window.gdScene._pauseGame = createHookWrapper({
    hookName: "pause",
    target: window.gdScene,
    method: "_pauseGame",
  });

  window.gdScene._levelComplete = createHookWrapper({
    hookName: "complete",
    target: window.gdScene,
    method: "_levelComplete",
  });

  window.gdScene._player.reset = createHookWrapper({
    hookName: "spawn",
    target: window.gdScene._player,
    method: "reset",
  });

  window.gdScene._player.killPlayer = createHookWrapper({
    hookName: "death",
    target: window.gdScene._player,
    method: "killPlayer",
  });

  window.gdScene._player.enterShipMode = createHookWrapper({
    hookName: "ship",
    target: window.gdScene._player,
    method: "enterShipMode",
  });

  window.gdScene._player.exitShipMode = createHookWrapper({
    hookName: "cube",
    target: window.gdScene._player,
    method: "exitShipMode",
  });

  window.gdScene.update = createHookWrapper({
    hookName: "update",
    target: window.gdScene,
    method: "update",
  });
};
