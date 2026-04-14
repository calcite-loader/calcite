import { extractFunction, patchMethod, patchScript } from "./patcher";

let createImageFromAtlasName: string;

export const initUtils = () => {
  // The following two make createImageFromAtlas available at window.createImageFromAtlas
  patchMethod("_addGlowSprite", (code) => {
    createImageFromAtlasName = code.match(/let\s+_0x[\da-f]+\s*=\s*(\w+)\s*\(/)
      ?.[1]!;
    return code;
  });

  patchScript("index-game.js", (code) => {
    const originalFunction = extractFunction(
      code,
      createImageFromAtlasName,
    ) as string;
    return code.replace(
      originalFunction,
      originalFunction +
        `;window.createImageFromAtlas=${createImageFromAtlasName};`,
    );
  });

  // Makes pako available at window.pako
  patchScript("index-game.js", (code) => {
    return code.replace(
      /(var\s+(\w+)\s*=\s*{\s*'Deflate'\s*:[^}]+'constants'\s*:\s*\w+(?:\s*,)?\s*})/,
      "$1;window.pako=$2;",
    );
  });
};
