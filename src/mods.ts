import { createEventCallback } from "./hooks";
import { isHotkeyDown, modHotkeysMap } from "./hotkeys";
import {
  extractFunction,
  mainDeobfuscateMap,
  patchMethod,
  patchScript,
} from "./patcher";
import type { Api, Hotkey, ModSetting } from "@calcite-loader/types";

interface Dependency {
  id: string;
  downloadUrl?: string;
}

export interface ModData {
  id: string;
  type: "library" | "mod";
  deps: Dependency[];
  code: string;
  name: string;
  needsRefresh: boolean;
  enabled: boolean;
  settings: Record<string, number | string | boolean>;
  hotkeys: Record<string, string[]>;
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

const parseDeps = (text: string): Dependency[] => {
  return text.split(",").map((dep) => dep.trim()).map((dep) =>
    dep.includes(";")
      ? {
        id: dep.split(";", 2)[0]!.trim(),
        downloadUrl: dep.split(";", 2)[1]!.trim(),
      }
      : { id: dep }
  );
};

export const parseMod = async (
  fileName: string,
  code: string,
): Promise<ModData> => {
  const fields = parseHeaderFields(code);
  const id = fields.id ?? fileName.split(".").slice(0, -1).join(".");

  let deps: Dependency[] = [];
  if (fields.deps) {
    deps = parseDeps(fields.deps);
    const mods = await getMods();
    for (const dep of deps) {
      if (
        mods.find((mod) => mod.id === dep.id) != null || id === dep.id ||
        !dep.downloadUrl
      ) {
        continue;
      }

      const result = await fetch(dep.downloadUrl);
      const parsedMod = await parseMod(dep.id + ".js", await result.text());
      if (parsedMod.type !== "library") continue;
      await saveMod(parsedMod);
    }
  }

  return {
    id,
    type: fields.type === "library" ? "library" : "mod",
    deps,
    code,
    name: fields.name || "Untitled Mod",
    needsRefresh: fields.needsRefresh === "true",
    enabled: true,
    settings: {},
    hotkeys: {},
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

export const setHotkey = (
  id: string,
  value: string | string[],
  mod: ModData,
): Promise<void> => {
  return new Promise((resolve) => {
    const handler = (e: MessageEvent) => {
      if (
        e.data.type === "SET_HOTKEY_SUCCESS" && mod.id === e.data.modId &&
        id === e.data.id
      ) {
        window.removeEventListener("message", handler);
        resolve();
      }
    };
    window.addEventListener("message", handler);
    window.postMessage({
      type: "SET_HOTKEY",
      id,
      value: typeof value === "string" ? [value] : value,
      modId: mod.id,
    }, "*");
  });
};

const loadedLibs: Record<string, Record<string, any>> = {};

let gdLoaded = false;
export const hasLoaded = () => {
  gdLoaded = true;
};

export const modInitCallbacks: (() => void)[] = [];

declare global {
  interface Window {
    gdApis: Record<string, Api>;
  }
}
window.gdApis = {};

export const executeMod = async (mod: ModData) => {
  console.log("Injecting Mod: " + mod.name);

  const mods = await getMods();
  for (const dep of mod.deps) {
    if (dep.id in loadedLibs) continue;

    const lib = mods.find((mod) => mod.id === dep.id);
    if (!lib) continue;
    loadedLibs[dep.id] = await executeMod(lib);
  }

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
    onUpdate: createEventCallback("update"),
    patchMethod,
    patchScript,
    createPatchedMethod: (
      method: Function,
      modifier: (code: string) => string,
    ) => {
      const code = method.toString();

      const firstBrace = code.indexOf("{");
      const lastParenBeforeBrace = code.lastIndexOf(")", firstBrace);
      const firstParenBeforeBrace = code.lastIndexOf("(", lastParenBeforeBrace);

      const args = code.substring(
        firstParenBeforeBrace + 1,
        lastParenBeforeBrace,
      );
      const body = code.slice(firstBrace + 1, code.lastIndexOf("}"));

      return new Function(args, modifier(body));
    },
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
    registerHotkeys: (hotkeys: Record<string, Hotkey>) => {
      modHotkeysMap[mod.id] = hotkeys;

      const ret = {};
      for (const id of Object.keys(modHotkeysMap[mod.id]!)) {
        Object.defineProperty(ret, id, {
          get: () => isHotkeyDown(mod, id),
        });
      }
      return ret;
    },
    getObfuscatedId: (val: string) => mainDeobfuscateMap[val],
    extractFunction,
    lib: (id: string) => loadedLibs[id],
  } as unknown as Api;

  if (mod.type === "mod") {
    const runner = new Function("api", mod.code);
    runner(api);
    return;
  }

  window.gdApis[mod.id] = api;

  const blob = new Blob(
    [`const api = window.gdApis["${mod.id}"];\n`, mod.code],
    {
      type: "application/javascript",
    },
  );
  const url = URL.createObjectURL(blob);

  try {
    return await import(url);
  } finally {
    URL.revokeObjectURL(url);
    delete window.gdApis[mod.id];
  }
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
    if (mod.enabled && mod.type !== "library") await executeMod(mod);
  }
  modsLoaded = true;
  modsLoadedCallbacks.forEach((cb) => cb());
};
