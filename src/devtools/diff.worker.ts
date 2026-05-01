import { type Change, diffWords } from "diff";

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
          value: unchangedBuffer.value.length > contextSize
            ? unchangedBuffer.value.slice(-contextSize)
            : unchangedBuffer.value,
        });
        unchangedBuffer = null;
      }
      currentHunkParts.push(change);
      continue;
    }

    if (currentHunkParts.length === 0) {
      unchangedBuffer = change;
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

onmessage = (
  e: MessageEvent<{ before: string; after: string; id: string }>,
) => {
  const { before, after, id } = e.data;
  const changes = diffWords(before, after);
  const hunks = getHunks(changes);
  postMessage({ id, hunks });
};
