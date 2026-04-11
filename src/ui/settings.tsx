import { useEffect, useRef, useState } from "preact/hooks";
import styles from "./settings.css" with { type: "text" };
import { type ModData, modSettingsMap, setHotkey, setSetting } from "../mods";
import { modHotkeysMap } from "../hotkeys";
import type { Hotkey, ModSetting } from "@calcite-loader/types";

let openMenuInternal: () => void;

const SettingInput = ({
  setting,
  settingId,
  mod,
}: {
  setting: ModSetting;
  settingId: string;
  mod: ModData;
}) => {
  const [value, setValue] = useState(
    mod.settings[settingId] ?? setting.default,
  );

  const handleChange = async (newValue: string | number | boolean) => {
    setValue(newValue);
    mod.settings[settingId] = newValue;
    await setSetting(settingId, newValue, mod);
    setting.onChange?.(newValue as never);
  };

  if (setting.type === "string" || setting.type === "color") {
    return (
      <input
        type={setting.type === "color" ? "color" : "text"}
        value={String(value)}
        onChange={(e) => handleChange((e.target as HTMLInputElement).value)}
      />
    );
  }

  if (setting.type === "slider") {
    return (
      <div className="slider-container">
        <input
          type="range"
          min={setting.min}
          max={setting.max}
          step={setting.step}
          value={Number(value)}
          onChange={(e) =>
            handleChange(Number((e.target as HTMLInputElement).value))}
          className="setting-slider"
        />
        <span className="slider-value">{value}</span>
      </div>
    );
  }

  if (setting.type === "number") {
    return (
      <input
        type="number"
        value={Number(value)}
        onChange={(e) =>
          handleChange(Number((e.target as HTMLInputElement).value))}
        className="setting-input"
      />
    );
  }

  if (setting.type === "toggle") {
    return (
      <label className="toggle-container">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => handleChange((e.target as HTMLInputElement).checked)}
          className="setting-toggle"
        />
        <span className="toggle-switch" />
      </label>
    );
  }

  return null;
};

export const Settings = (
  props: { open: boolean; onClose: () => void; mod: ModData },
) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const styleElem = document.createElement("style");
    styleElem.textContent = styles;
    document.head.appendChild(styleElem);

    openMenuInternal = () => {
      if (dialogRef.current) dialogRef.current.showModal();
    };
  }, []);

  useEffect(() => {
    if (props.open && dialogRef.current) {
      dialogRef.current.showModal();
    }
  }, [props.open]);

  const handleClose = () => {
    if (props.mod.needsRefresh) window.location.reload();
    else {
      dialogRef.current?.close();
      props.onClose();
    }
  };

  const settings = modSettingsMap[props.mod.id] as Record<string, ModSetting>;
  const hotkeys = modHotkeysMap[props.mod.id] ?? {};

  const HotkeyRow = ({
    id,
    hotkey,
  }: {
    id: string;
    hotkey: Hotkey;
  }) => {
    const [listening, setListening] = useState(false);
    const [pressed, setPressed] = useState<string[]>(
      props.mod.hotkeys[id] ||
        (typeof hotkey.default === "string"
          ? [hotkey.default]
          : hotkey.default),
    );

    useEffect(() => {
      if (!listening) return;

      const current = new Set<string>();

      const down = (e: { key: string }) => {
        const k = e.key.toLowerCase();
        current.add(k);
        setPressed(Array.from(current));
      };

      window.gdScene.input.keyboard?.on("keydown", down);

      const onBlur = () => {
        window.gdScene.input.keyboard?.off("keydown", down);
        setListening(false);
      };

      window.addEventListener("blur", onBlur);

      return () => {
        window.gdScene.input.keyboard?.off("keydown", down);
        window.removeEventListener("blur", onBlur);
      };
    }, [listening]);

    const startListening = () => {
      setPressed([]);
      setListening(true);
    };

    const cancel = () => {
      setPressed(
        props.mod.hotkeys[id] ||
          (typeof hotkey.default === "string"
            ? [hotkey.default]
            : hotkey.default),
      );
      setListening(false);
    };

    const confirm = async () => {
      const keys = pressed.map((k) => k.toLowerCase());
      props.mod.hotkeys = props.mod.hotkeys || {};
      props.mod.hotkeys[id] = keys;
      await setHotkey(id, keys, props.mod as ModData);
      setListening(false);
    };

    return (
      <li key={id} className="hotkey">
        <label>{hotkey?.name ?? id}</label>
        <div>
          <div className="hotkey-display">
            {(pressed.length ? pressed : (props.mod.hotkeys[id] ||
              (typeof hotkey.default === "string"
                ? [hotkey.default]
                : hotkey.default))).map((key) =>
                key[0]?.toUpperCase() + key.slice(1)).join(
                " + ",
              ) || "Unassigned"}
          </div>
          {!listening ? <button onClick={startListening}>Change</button> : (
            <>
              <button onClick={confirm}>Save</button>
              <button onClick={cancel}>Cancel</button>
            </>
          )}
        </div>
      </li>
    );
  };

  return (
    <dialog ref={dialogRef} className="settings">
      <header>
        <h3>Settings</h3>
        <button onClick={handleClose}>
          🗙
        </button>
      </header>
      <ul>
        {Object.entries(settings).map(([id, setting]) => (
          <li key={id}>
            <label>{setting.name}</label>
            <SettingInput
              setting={setting}
              settingId={id}
              mod={props.mod}
            />
          </li>
        ))}
      </ul>

      {Object.entries(hotkeys).length > 0 && (
        <>
          <h4>Hotkeys</h4>
          <ul className="hotkeys-list">
            {Object.entries(hotkeys).map(([id, hk]) => (
              <HotkeyRow id={id} hotkey={hk} />
            ))}
          </ul>
        </>
      )}
    </dialog>
  );
};
