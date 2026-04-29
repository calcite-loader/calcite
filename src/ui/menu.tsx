import { useEffect, useRef, useState } from "preact/hooks";
import "./menu.css";
import {
  disableMod,
  enableMod,
  executeMod,
  getMods,
  type ModData,
  modSettingsMap,
  parseMod,
  removeMod,
  saveMod,
} from "../mods";
import { getAssetUrl } from "../assets";
import { Settings } from "./settings";
import { openOfficialMods } from "./officialMods";
import { modHotkeysMap } from "../hotkeys";

let openMenuInternal: () => void;

const ModItem = (props: {
  mod: ModData;
  mods: ModData[];
  onRemove: (mod: ModData) => void;
  onToggle: (mod: ModData) => void;
}) => {
  const [showSettings, setShowSettings] = useState(false);

  let forceDisable = false;
  for (const mod of props.mods) {
    if (!mod.enabled) continue;
    if (
      mod.conflicts.includes(props.mod.id) ||
      props.mod.conflicts.includes(mod.id)
    ) forceDisable = true;
  }

  return (
    <div>
      <label>
        <input
          type="checkbox"
          checked={props.mod.enabled && !forceDisable}
          onChange={() => props.onToggle(props.mod)}
          disabled={props.mod.type == "library" || forceDisable}
        />
        {props.mod.name}
      </label>
      <div className="right">
        {props.mod.enabled &&
          (modSettingsMap[props.mod.id] != null ||
            modHotkeysMap[props.mod.id] != null) &&
          (
            <button onClick={() => setShowSettings(true)}>
              ⚙️
            </button>
          )}
        <button onClick={() => props.onRemove(props.mod)}>
          🗙
        </button>
      </div>
      {showSettings && (
        <Settings
          open={showSettings}
          onClose={() => setShowSettings(false)}
          mod={props.mod}
        />
      )}
    </div>
  );
};

export const Menu = () => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [logoUrl, setLogoUrl] = useState("");

  const [needRefresh, setNeedRefresh] = useState(false);
  const [mods, setMods] = useState<ModData[]>([]);

  useEffect(() => {
    openMenuInternal = () => {
      if (dialogRef.current) dialogRef.current.showModal();
    };

    const fetchMods = async () => {
      const data = await getMods();
      setMods(data);
    };
    fetchMods();

    const fetchLogoUrl = async () => {
      setLogoUrl(await getAssetUrl("assets/full.png"));
    };
    fetchLogoUrl();
  }, []);

  const handleUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0] as File;
    const reader = new FileReader();
    reader.onload = async () => {
      const newMod = await parseMod(file.name, reader.result as string);

      setMods((prevMods) => {
        const existingIndex = prevMods.findIndex((m) => m.id === newMod.id);

        if (existingIndex !== -1) {
          const updatedMods = [...prevMods];
          updatedMods[existingIndex] = newMod;
          setNeedRefresh(true);
          return updatedMods;
        } else {
          if (newMod.needsRefresh) setNeedRefresh(true);
          else executeMod(newMod);
          return [...prevMods, newMod];
        }
      });

      await saveMod(newMod);

      (e.target as HTMLInputElement).value = "";
    };
    reader.readAsText(file);
  };

  const handleRemoveMod = async (mod: ModData) => {
    await removeMod(mod);
    setMods(mods.filter((i) => i != mod));
    setNeedRefresh(true);
  };

  const handleToggleMod = async (mod: ModData) => {
    if (mod.enabled) {
      await disableMod(mod);
      setNeedRefresh(true);
    } else {
      await enableMod(mod);
      if (mod.needsRefresh) setNeedRefresh(true);
      else await executeMod(mod);
    }

    setMods((prevMods) =>
      prevMods.map((m) => m.id === mod.id ? { ...m, enabled: !m.enabled } : m)
    );
  };

  const handleClose = () => {
    if (needRefresh) window.location.reload();
    dialogRef.current?.close();
  };

  return (
    <dialog ref={dialogRef} className="main">
      <header>
        <img src={logoUrl} alt="Calcite" />
        <button onClick={handleClose}>
          🗙
        </button>
      </header>
      <input type="file" accept=".js" onChange={handleUpload} />
      <button onClick={openOfficialMods}>Official Mods</button>
      {mods.length > 0 && (
        <fieldset>
          {mods.map((mod) => (
            <ModItem
              key={mod.id}
              mod={mod}
              mods={mods}
              onRemove={handleRemoveMod}
              onToggle={handleToggleMod}
            />
          ))}
        </fieldset>
      )}
    </dialog>
  );
};

export const openMenu = () => openMenuInternal();
