const api = typeof browser !== "undefined" ? browser : chrome;

api.devtools.inspectedWindow.eval("window.location.host", (result) => {
  const host = result as unknown as string;
  if (
    host === "web-dashers.github.io" ||
    host === "geometrydash.com"
  ) {
    api.devtools.panels.create(
      "Calcite",
      "/assets/icon32.png",
      "/devtools/panel.html",
    );
  }
});
