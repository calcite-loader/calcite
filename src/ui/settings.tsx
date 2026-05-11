import { useEffect, useRef, useState } from "preact/hooks";
import "./settings.css";
import { type ModData, modSettingsMap, setHotkey, setSetting } from "../mods";
import { modHotkeysMap } from "../hotkeys";
import type { Hotkey, ModSetting } from "@calcite-loader/types";

let openMenuInternal: () => void;

const Dropdown = ({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Record<string, string>;
  onChange: (value: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      window.addEventListener("click", handleClickOutside);
    }

    return () => window.removeEventListener("click", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="dropdown-container">
      <button
        className="dropdown-button"
        onClick={() => setOpen(!open)}
      >
        {options[value] || value}
      </button>
      {open && (
        <div className="dropdown-menu">
          {Object.entries(options).map(([optionValue, optionLabel]) => (
            <div
              key={optionValue}
              className="dropdown-option"
              onClick={() => {
                onChange(optionValue);
                setOpen(false);
              }}
            >
              {optionLabel}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const SettingInput = ({
  setting,
  settingId,
  mod,
  onSettingChange,
}: {
  setting: ModSetting;
  settingId: string;
  mod: ModData;
  onSettingChange?: () => void;
}) => {
  const [value, setValue] = useState(
    mod.settings[settingId] ?? setting.default,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = async (
    newValue: string | number | boolean | ArrayBuffer,
  ) => {
    setValue(newValue);
    mod.settings[settingId] = newValue;
    await setSetting(settingId, newValue, mod);
    setting.onChange?.(newValue as never);
    onSettingChange?.();
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

  if (setting.type === "file") {
    const handleFileUpload = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          handleChange(reader.result as ArrayBuffer);
        };
        reader.readAsArrayBuffer(file);
      }
      (e.target as HTMLInputElement).value = "";
    };

    return (
      <div className="file-input-container">
        <input
          type="file"
          ref={fileInputRef}
          hidden={true}
          onChange={handleFileUpload}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="file-button"
        >
          {value instanceof ArrayBuffer || value
            ? "Change File"
            : "Select File"}
        </button>
      </div>
    );
  }

  if (setting.type === "select") {
    return (
      <Dropdown
        value={String(value)}
        options={setting.options}
        onChange={(newValue) => handleChange(newValue)}
      />
    );
  }

  return null;
};

export const Settings = (
  props: { open: boolean; onClose: () => void; mod: ModData },
) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [, setSettingsVersion] = useState(0);

  useEffect(() => {
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

  const settings = modSettingsMap[props.mod.id] ?? {};
  const hotkeys = modHotkeysMap[props.mod.id] ?? {};

  const notifySettingsChange = () => {
    setSettingsVersion((v) => v + 1);
  };

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
        <button onClick={handleClose} />
      </header>
      {Object.entries(settings).length > 0 && (
        <ul>
          {Object.entries(settings).map(([id, setting]) => {
            const shouldShow = (setting.condition ?? (() => true))(
              Object.fromEntries(
                Object.entries(settings).map(([settingId, s]) => [
                  settingId,
                  props.mod.settings[settingId] ?? s.default,
                ]),
              ),
            );

            if (!shouldShow) return null;

            return (
              <li key={id}>
                <label>{setting.name}</label>
                <SettingInput
                  setting={setting}
                  settingId={id}
                  mod={props.mod}
                  onSettingChange={notifySettingsChange}
                />
              </li>
            );
          })}
        </ul>
      )}

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
