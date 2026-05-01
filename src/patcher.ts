import { getMods, type ModData, onModsLoaded } from "./mods";
import { reportError } from "./ui/error";

interface Hook {
  mod?: ModData;
  target: string;
  modifier: (code: string) => string;
}

const methodHooks: Hook[] = [];
const scriptHooks: Hook[] = [];

const patchedMethods: Record<string, ModData[]> = {};

export const patchMethod = (
  method: string,
  modifier: (code: string) => string,
  mod?: ModData,
) => {
  if (mod) {
    if (!patchedMethods[method]) patchedMethods[method] = [];
    patchedMethods[method].push(mod);
  }
  methodHooks.push({ target: method, modifier, mod });
};

export const patchScript = (
  script: string,
  modifier: (code: string) => string,
  mod?: ModData,
) => {
  scriptHooks.push({ target: script, modifier, mod });
};

export const extractFunction = (
  code: string,
  funcName: string,
): string | null => {
  const start = code.indexOf("function " + funcName);
  if (start === -1) return null;

  let braces = 0;
  let started = false;
  for (let i = start; i < code.length; i++) {
    if (code[i] === "{") {
      braces++;
      started = true;
    } else if (code[i] === "}") {
      braces--;
    }

    if (started && braces === 0) {
      return code.substring(start, i + 1);
    }
  }

  return null;
};

const extractMethodAt = (code: string, startIndex: number): string | null => {
  let braces = 0;
  let started = false;
  let blockStart = -1;

  for (let i = startIndex; i < code.length; i++) {
    if (code[i] === "{") {
      if (!started) {
        blockStart = i;
        started = true;
      }
      braces++;
    } else if (code[i] === "}") {
      braces--;
    }

    if (started && braces === 0) {
      return code.substring(startIndex, i + 1);
    }
  }
  return null;
};

const getMethodRegex = (method: string, id: number) => {
  const hexStr = "0x" + id.toString(16);
  const decStr = id.toString(10);
  const escapedMethod = method.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
  return new RegExp(
    `(?:\\[(?:(?:"${escapedMethod}"|'${escapedMethod}'|\`${escapedMethod}\`)|(?:_0x[\\da-f]+\\s*\\(\\s*(?:${hexStr}|${decStr})\\s*\\)))\\]|${escapedMethod})\\s*\\([^\\)]*\\)\\s*{`,
  );
};

const getDeobfuscateMap = async (
  code: string,
): Promise<Record<string, number>> => {
  const deobfMatch = code.match(/var\s+_0x[\da-f]+\s*=\s*(_0x[\da-f]+)/);
  if (!deobfMatch || !deobfMatch[1]) {
    console.error("Failed to find name of debobfuscator function.");
    return {};
  }
  const deobfSource = extractFunction(code, deobfMatch[1])!;

  const offsetMatch = deobfSource.match(
    /(_0x[\da-f]+)\s*=\s*\1\s*-\s*(0x[\da-f]+|\d+)/,
  );
  if (!offsetMatch || !offsetMatch[2]) {
    console.error("Failed to find offset.");
    return {};
  }
  const offset = parseInt(offsetMatch[2]);

  const arrayMatch = code.match(
    /var\s+_0x[\da-f]+\s*=\s*(_0x[\da-f]+)\s*\(\s*\)/,
  );
  if (!arrayMatch || !arrayMatch[1]) {
    console.error("Failed to find name of array source method.");
    return {};
  }
  const arraySource = extractFunction(code, arrayMatch[1]);

  const rotationSource = code.match(
    new RegExp(
      `\\(function\\s*\\(_0x\\w+,\\s*_0x\\w+\\)\\s*\\{[\\s\\S]*?\\}\\(${
        arrayMatch[1]
      },\\s*0x\\w+\\)\\);`,
    ),
  )?.[0];

  const workerCode = `
    onmessage = function(e) {
      const { arraySource, deobfSource, rotationSource, arrayName, deobfName, offset } = e.data;
      
      try {
        // Fucking magic
        (0, eval)(arraySource);
        (0, eval)(deobfSource);
        (0, eval)(rotationSource);
        
        const map = {};
        const finalArray = self[arrayName]();
        
        for (let i = 0; i < finalArray.length; i++) {
          try {
            const val = self[deobfName](i + offset);
            if (val && typeof val === 'string') {
              map[val] = i + offset;
            }
          } catch(e) {}
        }
        postMessage({ success: true, map });
      } catch (err) {
        postMessage({ success: false, error: err.message });
      }
    };
  `;

  return new Promise((resolve) => {
    const blob = new Blob([workerCode], { type: "application/javascript" });
    const worker = new Worker(URL.createObjectURL(blob));
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        console.error("Deobfuscation worker timed out.");
        worker.terminate();
        resolve({});
      }
    }, 4000);

    worker.onmessage = (e) => {
      resolved = true;
      clearTimeout(timeout);
      worker.terminate();
      if (e.data.success) resolve(e.data.map);
      else {
        console.error("Deobfuscation worker execution error:", e.data.error);
        resolve({});
      }
    };

    worker.onerror = (err) => {
      console.error("Deobfuscation worker crashed:", err);
      worker.terminate();
      resolved = true;
      resolve({});
    };

    worker.postMessage({
      arraySource,
      deobfSource,
      rotationSource,
      arrayName: arrayMatch[1],
      deobfName: deobfMatch[1],
      offset,
    });
  });
};

export let mainDeobfuscateMap: Record<string, number> = {};

export interface PatchInfo {
  target: string;
  mod: ModData;
  before: string;
  after: string;
}

declare global {
  interface Window {
    _calciteMethodPatches: PatchInfo[];
    _calciteScriptPatches: PatchInfo[];
  }
}
window._calciteMethodPatches = window._calciteMethodPatches ?? [];
window._calciteScriptPatches = window._calciteScriptPatches ?? [];

const interceptScript = async (scriptNode: HTMLScriptElement) => {
  const originalSrc = scriptNode.src;
  const isModule = scriptNode.type === "module";
  if (!originalSrc.startsWith("http")) return; // Filter out other browser extensions

  scriptNode.type = "javascript/blocked";
  scriptNode.addEventListener("beforescriptexecute", (e) => e.preventDefault());
  scriptNode.remove();

  await new Promise<void>((resolve) => onModsLoaded(resolve));

  const response = await fetch(originalSrc);
  let code = await response.text();

  const deobfuscateMap = await getDeobfuscateMap(code);
  if (originalSrc.split("/").at(-1) === "index-game.js") {
    mainDeobfuscateMap = deobfuscateMap;
  }

  const methodPatches: PatchInfo[] = [];
  const scriptPatches: PatchInfo[] = [];

  for (const hook of methodHooks) {
    const id = deobfuscateMap[hook.target];

    const match = code.match(getMethodRegex(hook.target, id || -1));
    if (!match || match.index == null) {
      continue;
    }

    const originalCode = extractMethodAt(code, match.index);
    if (!originalCode) continue;

    const modifiedCode = hook.modifier(originalCode);

    if (hook.mod) {
      methodPatches.push({
        target: hook.target,
        mod: hook.mod,
        before: originalCode,
        after: modifiedCode,
      });
    }

    const firstBraceIndex = modifiedCode.indexOf("{");
    if (firstBraceIndex === -1) continue;

    const codeBody = modifiedCode.slice(
      firstBraceIndex + 1,
      modifiedCode.lastIndexOf("}"),
    );

    const signature = modifiedCode.slice(0, firstBraceIndex + 1);

    code = code.replace(
      originalCode,
      `${signature} try { ${codeBody} } catch (e) { window.dispatchEvent(new CustomEvent("calcite-patch-error", { detail: { script: "${
        originalSrc.split("/").at(-1)
      }", method: "${hook.target}", error: e } })) } }`,
    );
  }

  for (const hook of scriptHooks) {
    if (originalSrc.split("/").at(-1) != hook.target) continue;
    const originalCode = code;
    code = hook.modifier(code);

    if (hook.mod) {
      scriptPatches.push({
        target: hook.target,
        mod: hook.mod,
        before: originalCode,
        after: code,
      });
    }
  }

  code =
    `try { ${code} } catch (e) { window.dispatchEvent(new CustomEvent("calcite-patch-error", { detail: { script: "${
      originalSrc.split("/").at(-1)
    }", error: e } })) }`;

  const patchedScript = document.createElement("script");

  if (isModule && window.location.host === "web-dashers.github.io") {
    patchedScript.type = "module";
    code =
      `const execute = () => { ${code} }; if (window.phaserLoaded) { execute() } else { window.addEventListener("phaser-loaded", execute) }`;
  }

  code = `(function() {${code}})()`;

  patchedScript.textContent = code;
  patchedScript.dataset.patched = "true";
  document.documentElement.appendChild(patchedScript);

  window._calciteMethodPatches.push(...methodPatches);
  window.postMessage({
    type: "DEVTOOLS",
    payload: {
      type: "METHOD_PATCHES",
      data: methodPatches,
    },
  }, "*");

  window._calciteScriptPatches.push(...scriptPatches);
  window.postMessage({
    type: "DEVTOOLS",
    payload: {
      type: "SCRIPT_PATCHES",
      data: scriptPatches,
    },
  }, "*");
};

const ignoredErrors = new Set<string>();

export const initPatcher = () => {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (
          "tagName" in node && node.tagName === "SCRIPT" &&
          (node as HTMLScriptElement).src &&
          !(node as HTMLScriptElement).dataset.patched
        ) interceptScript(node as HTMLScriptElement);
      });
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  window.addEventListener("error", (e) => {
    if (e.filename !== "" && !e.error) return;
    reportError(
      `${e.message}, at ${e.lineno}:${e.colno}`,
      [],
      true,
    );
  });

  window.addEventListener("calcite-patch-error", async (e: any) => {
    const data: {
      script: string;
      method?: string;
      error: Error | string;
    } = e.detail;

    if (typeof data.error === "string") {
      data.error = new Error(data.error);
    }

    const errorKey = `${data.script}-${
      data.method || "global"
    }-${data.error.message}`;

    if (ignoredErrors.has(errorKey)) return;

    const errorMessage = `${data.error.name}: ${data.error.message}${
      ("lineNumber" in data.error && "columnNumber" in data.error)
        ? ` at ${data.error.lineNumber}:${data.error.columnNumber}`
        : ""
    }`;

    if (data.method && patchedMethods[data.method]) {
      const possibleMods = new Set<ModData>();

      const mods = await getMods();
      for (const mod of patchedMethods[data.method] ?? []) {
        if (mod.type === "mod") {
          possibleMods.add(mod);
          continue;
        }
        mods.filter((possibleDependent) =>
          possibleDependent.enabled &&
          possibleDependent.type === "mod" &&
          possibleDependent.deps.find((dep) => dep.id === mod.id)
        ).forEach((dependent) => possibleMods.add(dependent));
      }

      reportError(
        `${errorMessage} in ${data.method}`,
        Array.from(possibleMods),
        true,
        () => ignoredErrors.add(errorKey),
      );
      return;
    }
    reportError(errorMessage, [], true, () => ignoredErrors.add(errorKey));
  });
};
