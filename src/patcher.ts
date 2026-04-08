import { onModsLoaded } from "./mods";

interface Hook {
  method: string;
  modifier: (code: string) => string;
}

const hooks: Hook[] = [];

export const patchMethod = (
  method: string,
  modifier: (code: string) => string,
) => {
  hooks.push({ method, modifier });
};

const extractFunction = (code: string, funcName: string): string | null => {
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
  return new RegExp(
    `\\[(?:(?:"${method}"|'${method}')|(?:_0x[\\da-f]+\\s*\\(\\s*(?:${hexStr}|${decStr})\\s*\\)))\\]`,
  );
};

const getDeobfuscateMap = (code: string): Record<string, number> => {
  const offset = 0x103;
  const arraySource = extractFunction(code, "_0x4491");
  const deobfSource = extractFunction(code, "_0x46a7");
  const rotationSource = code.match(
    /\(function\s*\(_0x\w+,\s*_0x\w+\)\s*\{[\s\S]*?\}\(_0x4491,\s*0x\w+\)\);/,
  )?.[0];

  const deobfuscateMap: Record<string, number> = {};

  try {
    const sandbox = `(function() {
      ${arraySource}
      ${deobfSource}
      ${rotationSource}
      
      const map = {};
      const finalArray = _0x4491();
      
      for (let i = 0; i < finalArray.length; i++) {
        try {
          const val = _0x46a7(i + ${offset});
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
      "Patcher: Sandbox failed. Check if _0x46a7 is correctly extracted.",
      e,
    );
  }

  return deobfuscateMap;
};

const interceptScript = async (scriptNode: HTMLScriptElement) => {
  const originalSrc = scriptNode.src;
  if (!originalSrc.startsWith("http")) return; // Filter out other browser extensions

  scriptNode.type = "javascript/blocked";
  scriptNode.addEventListener("beforescriptexecute", (e) => e.preventDefault());
  scriptNode.remove();

  await new Promise<void>((resolve) => onModsLoaded(resolve));

  const response = await fetch(originalSrc);
  let code = await response.text();

  const deobfuscateMap = getDeobfuscateMap(code);

  for (const hook of hooks) {
    const id = deobfuscateMap[hook.method];

    const match = code.match(getMethodRegex(hook.method, id || -1));
    if (!match || match.index == null) {
      continue;
    }

    const originalCode = extractMethodAt(code, match.index);
    if (!originalCode) continue;

    code = code.replace(originalCode, hook.modifier(originalCode));
  }

  code = `(function() {${code}})()`;

  const patchedScript = document.createElement("script");
  patchedScript.textContent = code;
  patchedScript.dataset.patched = "true";
  document.documentElement.appendChild(patchedScript);
};

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
};
