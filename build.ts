#!/usr/bin/env bun

import { createWriteStream } from "node:fs";
import { cp, rm } from "node:fs/promises";
import sharp from "sharp";
import archiver from "archiver";
import { browserslistToTargets, transform } from "lightningcss";
import browserslist from "browserslist";
import type { BunPlugin } from "bun";

const cssPlugin: BunPlugin = {
  name: "css-injector",
  setup: (build) => {
    build.onLoad({ filter: /\.css$/ }, async (args) => {
      const raw = await Bun.file(args.path).bytes();

      const { code } = transform({
        filename: args.path,
        code: raw,
        minify: true,
        targets: browserslistToTargets(browserslist("defaults")),
      });

      const elementId = "css-" +
        Bun.hash(args.path).toString(16).substring(0, 8);
      const contents = `
(function () {
  const inject = () => {
    if (document.getElementById("${elementId}")) return;
    const style = document.createElement('style');
    style.id = "${elementId}";
    style.textContent = ${JSON.stringify(code.toString())};
    document.head.appendChild(style);
  };

  if (document.head) inject();
  else {
    const observer = new MutationObserver(() => {
      if (document.head) {
        inject();
        observer.disconnect();
      }
    });
    observer.observe(document.documentElement, { childList: true });
  }
})()
`;

      return {
        contents,
        loader: "js",
      };
    });
  },
};

const shouldZip = Bun.argv.includes("--zip");

(async () => {
  try {
    await rm("./dist", { recursive: true, force: true });
  } catch (e) {}

  const result = await Bun.build({
    entrypoints: [
      "./src/index.ts",
      "./src/bridge.ts",
      "./src/background.ts",
      "./src/devtools/devtools.html",
      "./src/devtools/panel.html",
      "./src/devtools/diff.worker.ts",
    ],
    outdir: "./dist",
    minify: true,
    plugins: [cssPlugin],
    target: "browser",
  });

  if (!result.success) {
    console.error("Build failed :(", result.logs);
    return;
  }

  // Copy Manifest
  const manifest = await Bun.file("./manifest.json").json();
  delete manifest["$schema"];
  await Bun.write("./dist/manifest.json", JSON.stringify(manifest));

  // Copy Assets
  try {
    await cp("./assets", "./dist/assets", { recursive: true });
  } catch (e) {
    console.warn("No assets folder found.");
  }

  // Generate Icons
  const iconSizes: number[] = [16, 32, 48, 128];
  await Promise.all(
    iconSizes.map((size) =>
      sharp("./assets/small.png").resize(size, size, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      }).toFile(`./dist/assets/icon${size}.png`)
    ),
  );

  if (shouldZip) {
    const output = createWriteStream("./dist/calcite.zip");
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.pipe(output);
    archive.directory("./dist", false);
    await archive.finalize();
  }

  console.log("Build complete!");
})();
