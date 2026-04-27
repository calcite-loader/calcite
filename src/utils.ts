import { patchScript } from "./patcher";

export const initUtils = () => {
  // Makes pako available at window.pako
  patchScript("index-game.js", (code) => {
    return code.replace(
      /(var\s+(\w+)\s*=\s*{\s*'Deflate'\s*:[^}]+'constants'\s*:\s*\w+(?:\s*,)?\s*})/,
      "$1;window.pako=$2;",
    );
  });
};
