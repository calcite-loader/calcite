import { Fragment, render } from "preact";
import { Menu } from "./menu";
import { OfficialMods } from "./officialMods";
import styles from "./index.css" with { type: "text" };

const Index = () => {
  return (
    <Fragment>
      <Menu />
      <OfficialMods />
    </Fragment>
  );
};

export const initMenu = () => {
  const container = document.createElement("div");
  container.id = "calcite-container";
  document.body.appendChild(container);
  render(<Index />, container);

  const styleElem = document.createElement("style");
  styleElem.textContent = styles;
  document.head.appendChild(styleElem);
};
