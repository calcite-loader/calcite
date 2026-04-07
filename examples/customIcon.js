/*
 * @name Custom Icon
 */

const settings = api.registerSettings({
  url: {
    name: "Icon URL",
    type: "string",
    default: "https://picsum.photos/61/60",
    onChange: reload,
  },
});

function reload() {
  window.gdScene.load.image("custom_player", settings.url);

  window.gdScene.load.once("complete", () => {
    window.gdScene._player.playerSprite.setTexture("custom_player");
    window.gdScene._player.playerSprite.clearTint();
  });

  window.gdScene.load.start();
}

api.onLoad(reload);
