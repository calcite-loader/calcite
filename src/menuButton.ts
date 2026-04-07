import { openMenu } from "./ui/menu";
import { getAssetUrl } from "./assets";

const watchMenuState = (
  scene: any,
  cb: (active: boolean) => void,
) => {
  let value = scene._menuActive;

  Object.defineProperty(scene, "_menuActive", {
    get: () => value,
    set: (newValue) => {
      const changed = value !== newValue;
      value = newValue;
      if (changed) cb(value);
    },
    configurable: true,
  });
};

export const injectMenuButton = async () => {
  console.log("Injecting mod menu...");

  const iconURL = await getAssetUrl("assets/small.png");
  window.gdScene.load.image("calcite", iconURL);

  window.gdScene.load.once("complete", () => {
    if (!window.gdScene._menuActive) return;

    const { width, height } = window.gdScene.cameras.main;

    const menuBtn = window.gdScene.add.sprite(
      width - 75,
      height - 240,
      "calcite",
    );
    menuBtn.setInteractive({ useHandCursor: true });
    menuBtn.setDepth(999);
    menuBtn.setInteractive();
    menuBtn.setScale(0.15);

    menuBtn.on("pointerdown", () => {
      window.gdScene.tweens.killTweensOf(menuBtn);
      window.gdScene.tweens.add({
        targets: menuBtn,
        scale: 0.18,
        duration: 75,
        ease: "Power2",
      });
    });

    menuBtn.on("pointerup", () => {
      window.gdScene.tweens.killTweensOf(menuBtn);
      window.gdScene.tweens.add({
        targets: menuBtn,
        scale: 0.15,
        duration: 75,
        ease: "Back.easeOut",
      });

      openMenu();
    });

    menuBtn.on("pointerover", () => {
      window.gdScene.tweens.killTweensOf(menuBtn);
      window.gdScene.tweens.add({
        targets: menuBtn,
        scale: 0.20,
        duration: 200,
        ease: "Back.easeOut",
      });
    });

    menuBtn.on("pointerout", () => {
      window.gdScene.tweens.killTweensOf(menuBtn);
      window.gdScene.tweens.add({
        targets: menuBtn,
        scale: 0.15,
        duration: 200,
        ease: "Power2",
      });
    });

    watchMenuState(window.gdScene, (active) => {
      if (!active) menuBtn.visible = false;
      else { // it seems to complete reset? We'll just reload for now.
        window.location.reload();
      }
    });
  });
  window.gdScene.load.start();
};
