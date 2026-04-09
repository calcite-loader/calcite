import type { EventCallback } from "@calcite-loader/types";

type Callbacks = {
  before: ((prevented: boolean, preventDefault: () => void) => void)[];
  after: ((prevented: boolean) => void)[];
};

const callbacks = {
  start: { before: [], after: [] } as Callbacks,
  complete: { before: [], after: [] } as Callbacks,
  pause: { before: [], after: [] } as Callbacks,
  death: { before: [], after: [] } as Callbacks,
  spawn: { before: [], after: [] } as Callbacks,
  ship: { before: [], after: [] } as Callbacks,
  cube: { before: [], after: [] } as Callbacks,
};

export const createEventCallback =
  (name: keyof typeof callbacks): EventCallback =>
  (
    cb: (prevented: boolean, preventDefault: () => void) => void,
    when: "before" | "after" = "after",
  ) => {
    callbacks[name][when].push(cb as any);
  };

interface HookConfig {
  hookName: keyof typeof callbacks;
  target: any;
  method: string;
}

const createHookWrapper = (
  { hookName, target, method }: HookConfig,
) => {
  const original = target[method];
  return function (...callArgs: any[]) {
    let prevented = false;

    for (const cb of callbacks[hookName].before) {
      cb(prevented, () => {
        prevented = true;
      });
    }

    if (!prevented) {
      original.call(target, ...callArgs);
    }

    for (const cb of callbacks[hookName].after) {
      cb(prevented);
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
};
