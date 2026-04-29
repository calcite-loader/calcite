import { render } from "preact";
import { Menu } from "./menu";
import { OfficialMods } from "./officialMods";
import { ErrorDialog } from "./error";
import styles from "./index.css" with { type: "text" };

const Index = () => {
  return (
    <>
      <Menu />
      <OfficialMods />
    </>
  );
};

export const initMenu = () => {
  const container = document.createElement("div");
  container.id = "calcite-container";
  container.classList.add("calcite-container");
  document.body.appendChild(container);
  render(<Index />, container);
};

export const initErrorDialog = () => {
  window.addEventListener("DOMContentLoaded", () => {
    const container = document.createElement("div");
    container.id = "calcite-container-error";
    container.classList.add("calcite-container");
    document.body.appendChild(container);
    render(<ErrorDialog />, container);

    const styleElem = document.createElement("style");
    styleElem.textContent = styles;
    document.head.appendChild(styleElem);
  });
};
