import { type ModData, onModsLoaded } from "./mods";
import { reportError } from "./ui/error";

interface Hook {
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
  methodHooks.push({ target: method, modifier });
};

export const patchScript = (
  script: string,
  modifier: (code: string) => string,
) => {
  scriptHooks.push({ target: script, modifier });
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

const getDeobfuscateMap = (code: string): Record<string, number> => {
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

  const deobfuscateMap: Record<string, number> = {};

  try {
    const sandbox = `(function() {
      ${arraySource}
      ${deobfSource}
      ${rotationSource}
      
      const map = {};
      const finalArray = ${arrayMatch[1]}();
      
      for (let i = 0; i < finalArray.length; i++) {
        try {
          const val = ${deobfMatch[1]}(i + ${offset});
          if (val && typeof val === 'string') {
            map[val] = i + ${offset};
          }
        } catch(e) {}
      }
      return map;
    })()`;

    const resultMap = eval(sandbox);
    Object.assign(deobfuscateMap, resultMap);
  } catch (e) {
    console.error(
      "Patcher: Sandbox failed.",
      e,
    );
  }

  return deobfuscateMap;
};

export let mainDeobfuscateMap: Record<string, number> = {};

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

  const deobfuscateMap = getDeobfuscateMap(code);
  if (originalSrc.split("/").at(-1) === "index-game.js") {
    mainDeobfuscateMap = deobfuscateMap;
  }

  for (const hook of methodHooks) {
    const id = deobfuscateMap[hook.target];

    const match = code.match(getMethodRegex(hook.target, id || -1));
    if (!match || match.index == null) {
      continue;
    }

    const originalCode = extractMethodAt(code, match.index);
    if (!originalCode) continue;

    const modifiedCode = hook.modifier(originalCode);

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
    code = hook.modifier(code);
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

  window.addEventListener("calcite-patch-error", (e: any) => {
    const data: {
      script: string;
      method?: string;
      error: Error;
    } = e.detail;

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
      reportError(
        `${errorMessage} in ${data.method}`,
        patchedMethods[data.method],
        true,
        () => ignoredErrors.add(errorKey),
      );
      return;
    }
    reportError(errorMessage, [], true, () => ignoredErrors.add(errorKey));
  });
};
