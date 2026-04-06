declare global {
  const api: {
    onLoad: (cb: () => void) => void;
    patchMethod: (method: string, modifier: (code: string) => string) => void;
  };
}

export {};
