/*
 * @name Level Loader
 * @needsRefresh true
 */

const settings = api.registerSettings({
  levelstring: {
    type: "string",
    name: "Level String",
    default: "",
  },
});

api.patchMethod("loadLevel", (code) => {
  const argName = code.match(/\((_0x[\da-f]+)\)/)[1];

  return code.replace("{", `{var ${argName} = "${settings.levelstring}";`);
});
