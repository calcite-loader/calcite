import { useEffect, useMemo, useState } from "preact/hooks";
import { render } from "preact";
import type { PatchInfo } from "../patcher";
import { type Change } from "diff";
import "./panel.css";
import { memo } from "preact/compat";

const api = typeof browser !== "undefined" ? browser : chrome;

const Patch = memo(({ patch }: { patch: PatchInfo }) => {
  const [hunks, setHunks] = useState<Change[][] | null>(null);

  useEffect(() => {
    const worker = new Worker("/devtools/diff.worker.js");

    worker.onmessage = (e) => {
      setHunks(e.data.hunks);
      worker.terminate();
    };

    worker.postMessage({
      before: patch.before,
      after: patch.after,
    });

    return () => worker.terminate();
  }, [patch.before, patch.after]);

  return (
    <div className="patch">
      <div className="patch-header">
        <strong>{(patch.mod ?? { name: "Internal" }).name}</strong> —{" "}
        <span>{patch.target}</span>
      </div>
      {!hunks
        ? <div className="loading">Loading...</div>
        : hunks.map((hunk, i) => (
          <div key={i} className="hunk-container">
            {i > 0 && (
              <div className="hunk-separator">
                @@ Gap in obfuscated source @@
              </div>
            )}
            <pre>
            {hunk.map((part, index) => (
              <span
                key={index}
                className={part.added ? "added" : part.removed ? "removed" : "unchanged"}
              >
                {part.value}
              </span>
            ))}
            </pre>
          </div>
        ))}
    </div>
  );
});

const App = () => {
  const [patches, setPatches] = useState<PatchInfo[]>([]);

  useEffect(() => {
    const pullState = () => {
      api.devtools.inspectedWindow.eval(
        "({ methods: window._calciteMethodPatches ?? [], scripts: window._calciteScriptPatches ?? [] })",
        (
          result: { methods: PatchInfo[]; scripts: PatchInfo[] },
          isException,
        ) => {
          if (!isException && result) {
            setPatches([...result.methods, ...result.scripts]);
          } else {
            setPatches([]);
          }
        },
      );
    };
    pullState();

    const messageListener = (message: any) => {
      if (
        message.type === "DEVTOOLS" &&
        (message.payload.type === "METHOD_PATCHES" ||
          message.payload.type === "SCRIPT_PATCHES")
      ) {
        setPatches((prev) => [...prev, ...message.payload.data]);
      }
    };

    const navigateListener = () => {
      setPatches([]);
      pullState();
    };

    api.runtime.onMessage.addListener(messageListener);
    api.devtools.network.onNavigated.addListener(navigateListener);
    return () => {
      api.runtime.onMessage.removeListener(messageListener);
      api.devtools.network.onNavigated.removeListener(navigateListener);
    };
  }, []);

  const [showInternal, setShowInternal] = useState(false);

  const filteredPatches = useMemo(() => {
    return patches.map((p, i) => ({ data: p, key: i })).filter((p) =>
      showInternal || p.data.mod
    );
  }, [patches, showInternal]);

  return (
    <>
      <h1>Patches</h1>
      <label>
        <input
          type="checkbox"
          checked={showInternal}
          onChange={(e) => {
            setShowInternal((e.target as HTMLInputElement).checked);
          }}
        />
        Show Internal
      </label>
      {filteredPatches.length === 0
        ? <div class="missing">No patches found...</div>
        : (
          <div class="patches">
            {filteredPatches.map((patch) => (
              <Patch patch={patch.data} key={patch.key} />
            ))}
          </div>
        )}
    </>
  );
};

render(<App />, document.querySelector("#container")!);
