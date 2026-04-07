/*
 * @name Custom Background Tint
 */

let originalSetTint;

const settings = api.registerSettings({
  color: {
    name: "Color",
    type: "color",
    default: "#ff0000",
    onChange: (color) => {
      originalSetTint.call(
        window.gdScene._bg,
        parseInt(color.slice(1), 16),
      );
    },
  },
});

api.onLoad(() => {
  originalSetTint = window.gdScene._bg.setTint;
  window.gdScene._bg.setTint = () => {};
  originalSetTint.call(
    window.gdScene._bg,
    parseInt(settings.color.slice(1), 16),
  );
});
