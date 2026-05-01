import { useEffect, useMemo, useState } from "preact/hooks";
import { render } from "preact";
import type { PatchInfo } from "../patcher";
import { type Change, diffWords } from "diff";
import "./panel.css";

const api = typeof browser !== "undefined" ? browser : chrome;

const getHunks = (
  changes: Change[],
  contextSize: number = 100,
) => {
  const hunks: Change[][] = [];
  let currentHunkParts: Change[] = [];
  let unchangedBuffer: Change | null = null;

  for (const change of changes) {
    if (change.added || change.removed) {
      if (unchangedBuffer) {
        currentHunkParts.push({
          ...unchangedBuffer,
          value: unchangedBuffer.value.length > contextSize * 2
            ? unchangedBuffer.value.slice(-contextSize)
            : unchangedBuffer.value,
        });
        unchangedBuffer = null;
      }
      currentHunkParts.push(change);
      continue;
    }

    if (currentHunkParts.length === 0) {
      unchangedBuffer = {
        ...change,
        value: change.value.slice(0, contextSize),
      };
      continue;
    }

    if (change.value.length > contextSize * 2) {
      currentHunkParts.push({
        ...change,
        value: change.value.slice(0, contextSize),
      });
      hunks.push(currentHunkParts);
      currentHunkParts = [];
      unchangedBuffer = {
        ...change,
        value: change.value.slice(-contextSize),
      };
      continue;
    }

    currentHunkParts.push(change);
  }

  if (currentHunkParts.length > 0) {
    hunks.push(currentHunkParts);
  }
  return hunks;
};

const Patch = ({ patch }: { patch: PatchInfo }) => {
  const hunks = useMemo(() => {
    const changes = diffWords(patch.before, patch.after);
    return getHunks(changes);
  }, [patch.before, patch.after]);

  return (
    <div className="patch">
      <div className="patch-header">
        <strong>{patch.mod.name}</strong> — <span>{patch.target}</span>
      </div>
      {hunks.map((hunk, i) => (
        <div key={i} className="hunk-container">
          {i > 0 && (
            <div className="hunk-separator">@@ Gap in obfuscated source @@</div>
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
};
const App = () => {
  const [patches, setPatches] = useState<PatchInfo[]>([]);

  useEffect(() => {
    const pullState = () => {
      api.devtools.inspectedWindow.eval(
        "window._calciteMethodPatches",
        (result, isException) => {
          if (!isException && result) {
            setPatches((
              prev,
            ) => [...prev, ...result as unknown as PatchInfo[]]);
          } else setPatches([]);
        },
      );

      api.devtools.inspectedWindow.eval(
        "window._calciteScriptPatches",
        (result, isException) => {
          if (!isException && result) {
            setPatches((
              prev,
            ) => [...prev, ...result as unknown as PatchInfo[]]);
          } else setPatches([]);
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

  return (
    <>
      <h1>Patches</h1>
      <div class="patches">
        {patches.map((patch) => <Patch patch={patch} />)}
      </div>
    </>
  );
};

render(<App />, document.querySelector("#container")!);
