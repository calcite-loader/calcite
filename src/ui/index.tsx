import { render } from "preact";
import { Menu } from "./menu";
import styles from "./index.css" with { type: "text" };

export const initMenu = () =>
  document.addEventListener("DOMContentLoaded", () => {
    const container = document.createElement("div");
    container.id = "calcite-container";
    document.body.appendChild(container);
    render(<Menu />, container);

    const styleElem = document.createElement("style");
    styleElem.textContent = styles;
    document.head.appendChild(styleElem);
  });
