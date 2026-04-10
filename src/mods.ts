import { createEventCallback } from "./hooks";
import { patchMethod, patchScript } from "./patcher";
import type { ModSetting } from "@calcite-loader/types";

export interface ModData {
  id: string;
  code: string;
  name: string;
  needsRefresh: boolean;
  enabled: boolean;
  settings: Record<string, number | string | boolean>;
}

export const modSettingsMap: Record<string, Record<string, ModSetting>> = {};

const parseHeaderFields = (code: string): Record<string, string> => {
  const fields: Record<string, string> = {};

  const headerCommentMatch = code.match(/^\/\*[\s\S]*?\*\//);
  if (!headerCommentMatch) return fields;

  const headerComment = headerCommentMatch[0];
  const fieldRegex = /@(\w+)\s+(.+?)(?=\n|$)/g;

  let match;
  while ((match = fieldRegex.exec(headerComment)) !== null) {
    fields[match[1]!] = match[2]!.trim();
  }

  return fields;
};

export const parseMod = (fileName: string, code: string): ModData => {
  const fields = parseHeaderFields(code);

  return {
    id: fileName.split(".").slice(0, -1).join("."),
    code,
    name: fields.name || "Untitled Mod",
    needsRefresh: fields.needsRefresh === "true",
    enabled: true,
    settings: {},
  };
};

export const getMods = (): Promise<ModData[]> => {
  return new Promise((resolve) => {
    const handler = (e: MessageEvent) => {
      if (e.data.type === "RECEIVE_MODS") {
        window.removeEventListener("message", handler);
        resolve(e.data.mods);
      }
    };
    window.addEventListener("message", handler);
    window.postMessage({ type: "FETCH_MODS" }, "*");
  });
};

export const saveMod = (mod: ModData): Promise<void> => {
  return new Promise((resolve) => {
    const handler = (e: MessageEvent) => {
      if (e.data.type === "SAVE_MOD_SUCCESS" && mod.id === e.data.id) {
        window.removeEventListener("message", handler);
        resolve();
      }
    };
    window.addEventListener("message", handler);
    window.postMessage({ type: "SAVE_MOD", mod }, "*");
  });
};

export const removeMod = (mod: ModData): Promise<void> => {
  return new Promise((resolve) => {
    const handler = (e: MessageEvent) => {
      if (e.data.type === "REMOVE_MOD_SUCCESS" && mod.id === e.data.id) {
        window.removeEventListener("message", handler);
        resolve();
      }
    };
    window.addEventListener("message", handler);
    window.postMessage({ type: "REMOVE_MOD", id: mod.id }, "*");
  });
};

export const enableMod = (mod: ModData): Promise<void> => {
  return new Promise((resolve) => {
    const handler = (e: MessageEvent) => {
      if (e.data.type === "ENABLE_MOD_SUCCESS" && mod.id === e.data.id) {
        window.removeEventListener("message", handler);
        resolve();
      }
    };
    window.addEventListener("message", handler);
    window.postMessage({ type: "ENABLE_MOD", id: mod.id }, "*");
  });
};

export const disableMod = (mod: ModData): Promise<void> => {
  return new Promise((resolve) => {
    const handler = (e: MessageEvent) => {
      if (e.data.type === "DISABLE_MOD_SUCCESS" && mod.id === e.data.id) {
        window.removeEventListener("message", handler);
        resolve();
      }
    };
    window.addEventListener("message", handler);
    window.postMessage({ type: "DISABLE_MOD", id: mod.id }, "*");
  });
};

export const setSetting = (
  id: string,
  value: string | boolean | number,
  mod: ModData,
): Promise<void> => {
  return new Promise((resolve) => {
    const handler = (e: MessageEvent) => {
      if (
        e.data.type === "SET_SETTING_SUCCESS" && mod.id === e.data.modId &&
        id === e.data.id
      ) {
        window.removeEventListener("message", handler);
        resolve();
      }
    };
    window.addEventListener("message", handler);
    window.postMessage({ type: "SET_SETTING", id, value, modId: mod.id }, "*");
  });
};

let gdLoaded = false;
export const hasLoaded = () => {
  gdLoaded = true;
};

export const modInitCallbacks: (() => void)[] = [];

export const executeMod = (mod: ModData) => {
  console.log("Injecting Mod: " + mod.name);

  const api = {
    onLoad: (cb: () => void) => {
      if (gdLoaded) cb();
      else modInitCallbacks.push(cb);
    },
    onStart: createEventCallback("start"),
    onPause: createEventCallback("pause"),
    onComplete: createEventCallback("complete"),
    onCube: createEventCallback("cube"),
    onShip: createEventCallback("ship"),
    onDeath: createEventCallback("death"),
    onSpawn: createEventCallback("spawn"),
    patchMethod,
    patchScript,
    registerSettings: (settings: Record<string, ModSetting>) => {
      modSettingsMap[mod.id] = settings;

      const ret = {};
      for (const [id, setting] of Object.entries(modSettingsMap[mod.id]!)) {
        Object.defineProperty(ret, id, {
          get: () => mod.settings[id] ?? setting.default,
        });
      }
      return ret;
    },
  };

  const runner = new Function("api", mod.code);
  runner(api);
};

let modsLoaded = false;
let modsLoadedCallbacks: (() => void)[] = [];
export const onModsLoaded = (cb: () => void) => {
  if (modsLoaded) cb();
  else modsLoadedCallbacks.push(cb);
};

export const loadMods = async () => {
  const mods = await getMods();
  for (const mod of mods) {
    if (mod.enabled) executeMod(mod);
  }
  modsLoaded = true;
  modsLoadedCallbacks.forEach((cb) => cb());
};
