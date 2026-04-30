import { useEffect, useRef, useState } from "preact/hooks";
import "./officialMods.css";
import { executeMod, getMods, parseMod, saveMod } from "../mods";

let openMenuInternal: () => void;

interface ManifestItem {
  id: string;
  name: string;
  downloadUrl: string;
}

const installMod = async (mod: ManifestItem) => {
  const result = await fetch(mod.downloadUrl);
  const code = await result.text();
  const parsedMod = await parseMod(mod.id + ".js", code);

  const currentMods = await getMods();

  await saveMod(parsedMod);

  if (!Object.keys(currentMods).includes(mod.id) && !parsedMod.needsRefresh) {
    await executeMod(parsedMod);
  }
};

// From Remix Icon
const DownloadIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
  >
    <path
      fill="#fff"
      d="M3 19h18v2H3zm10-5.828L19.071 7.1l1.414 1.414L12 17L3.515 8.515L4.929 7.1L11 13.173V2h2z"
    />
  </svg>
);

const ModItem = (
  props: {
    mod: ManifestItem;
  },
) => {
  return (
    <div>
      <span>
        {props.mod.name}
      </span>
      <div className="right">
        <button onClick={() => installMod(props.mod)}>
          <DownloadIcon />
        </button>
      </div>
    </div>
  );
};

export const OfficialMods = () => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [mods, setMods] = useState<ManifestItem[]>([]);

  useEffect(() => {
    openMenuInternal = () => {
      if (dialogRef.current) dialogRef.current.showModal();
    };

    const fetchMods = async () => {
      const result = await fetch(
        "https://calcite-loader.github.io/mods/manifest.json",
      );
      const manifest = (await result.json()) as { mods: ManifestItem[] };
      setMods(manifest.mods);
    };
    fetchMods();
  }, []);

  return (
    <dialog ref={dialogRef} className="official-mods">
      <header>
        <h3>Official Mods</h3>
        <button onClick={() => window.location.reload()} />
      </header>
      <ul>
        {mods.map((mod) => (
          <ModItem
            key={mod.id}
            mod={mod}
          />
        ))}
      </ul>
    </dialog>
  );
};

export const openOfficialMods = () => openMenuInternal();
