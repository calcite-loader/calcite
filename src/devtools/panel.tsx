import { useEffect, useState } from "preact/hooks";
import { render } from "preact";
import type { MethodPatch } from "../patcher";
import { diffWords } from "diff";
import "./panel.css";

const api = typeof browser !== "undefined" ? browser : chrome;

const Patch = ({ patch }: { patch: MethodPatch }) => {
  const changes = diffWords(patch.before, patch.after);

  return (
    <div className="patch">
      <h2>
        {patch.mod.name} - <span>{patch.method}</span>
      </h2>
      <pre>
        {changes.map(part => {
          return (
            <span className={part.added ? "added" : part.removed ? "removed" : ""}>
              {part.value}
            </span>
          )
        })}
      </pre>
    </div>
  );
};

const App = () => {
  const [patches, setPatches] = useState<MethodPatch[]>([]);

  useEffect(() => {
    const pullState = () => {
      api.devtools.inspectedWindow.eval(
        "window._calciteMethodPatches",
        (result, isException) => {
          if (!isException && result) {
            setPatches(result as unknown as MethodPatch[]);
          } else setPatches([]);
        },
      );
    };
    pullState();

    const messageListener = (message: any) => {
      if (
        message.type === "DEVTOOLS" && message.payload.type === "METHOD_PATCHES"
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
