import type { Hotkey } from "@calcite-loader/types";
import { getMods, type ModData } from "./mods";

const pressedKeys = new Set<string>();

export const modHotkeysMap: Record<string, Record<string, Hotkey>> = {};

export const initHotkeys = () => {
  window.gdScene.input.keyboard?.on("keydown", async (e: { key: string }) => {
    if (pressedKeys.has(e.key.toLowerCase())) return;

    pressedKeys.add(e.key.toLowerCase());

    const mods = await getMods();
    mods.forEach((mod) => {
      Object.entries(modHotkeysMap[mod.id]!).forEach(([id, hotkey]) => {
        const defaultCombo = typeof hotkey.default === "string"
          ? [hotkey.default]
          : hotkey.default;

        if (
          (mod.hotkeys[id] || defaultCombo).includes(e.key.toLowerCase()) &&
          isHotkeyDown(mod, id)
        ) hotkey.onPressed?.();
      });
    });
  });

  window.gdScene.input.keyboard?.on("keyup", async (e: { key: string }) => {
    const key = e.key.toLowerCase();

    const mods = await getMods();

    const affected: { mod: ModData; id: string; hotkey: Hotkey }[] = [];
    mods.forEach((mod) => {
      Object.entries(modHotkeysMap[mod.id]!).forEach(([id, hotkey]) => {
        const defaultCombo = typeof hotkey.default === "string"
          ? [hotkey.default]
          : hotkey.default;

        if (
          (mod.hotkeys[id] || defaultCombo).includes(key) &&
          isHotkeyDown(mod, id)
        ) {
          affected.push({ mod, id, hotkey });
        }
      });
    });

    pressedKeys.delete(key);

    affected.forEach(({ hotkey }) => {
      hotkey.onReleased?.();
    });
  });

  window.addEventListener("blur", async () => {
    const mods = await getMods();
    mods.forEach((mod) => {
      Object.entries(modHotkeysMap[mod.id]!).forEach(([id, hotkey]) => {
        if (isHotkeyDown(mod, id)) hotkey.onReleased?.();
      });
    });
    pressedKeys.clear();
  });
};

export const isHotkeyDown = (mod: ModData, hotkeyId: string): boolean => {
  return mod.hotkeys[hotkeyId]!.every((key) => pressedKeys.has(key));
};
