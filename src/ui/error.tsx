import { useEffect, useRef, useState } from "preact/hooks";
import { disableMod, getMods, type ModData } from "../mods";

export interface ErrorDetail {
  message: string;
  mods: ModData[];
  showDisableAll: boolean;
  onIgnore?: () => void;
}

export const reportError = (
  message: string,
  mods: ModData[] = [],
  showDisableAll: boolean = false,
  onIgnore?: () => void,
) => {
  window.dispatchEvent(
    new CustomEvent("calcite-error", {
      detail: { message, mods, showDisableAll, onIgnore },
    }),
  );
};

export const ErrorDialog = () => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<ErrorDetail | null>(null);

  useEffect(() => {
    const handleError = (e: any) => {
      setError(e.detail);
      dialogRef.current?.showModal();
    };

    window.addEventListener("calcite-error", handleError);
    return () => window.removeEventListener("calcite-error", handleError);
  }, []);

  const handleDisable = async (mod: ModData) => {
    await disableMod(mod);
    window.location.reload();
  };

  const handleDisableAll = async () => {
    for (const mod of await getMods()) {
      if (mod.type === "library") continue;
      await disableMod(mod);
    }
    window.location.reload();
  };

  const handleDismiss = () => {
    dialogRef.current?.close();
    if (error?.onIgnore) error.onIgnore();
  };

  return (
    <dialog ref={dialogRef}>
      <header>
        <h3>Oops :(</h3>
        <button onClick={() => dialogRef.current?.close()} />
      </header>
      <p>{error?.message}</p>
      {error?.mods.length! > 1 && (
        <>
          <h4>The Following Mods Could've Been Involved:</h4>
          <ul>
            {error?.mods.map((mod) => <ul>{mod.name}</ul>)}
          </ul>
        </>
      )}
      <footer>
        {error?.mods.map((mod) => (
          <button onClick={() => handleDisable(mod)}>
            Disable {mod.name}
          </button>
        ))}
        {error?.showDisableAll && (
          <button onClick={handleDisableAll}>
            Disable All Mods
          </button>
        )}
        <button onClick={handleDismiss}>Dismiss</button>
      </footer>
    </dialog>
  );
};
