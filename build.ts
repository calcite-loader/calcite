#!/usr/bin/env bun

import { createWriteStream } from "node:fs";
import { cp, rm } from "node:fs/promises";
import sharp from "sharp";
import archiver from "archiver";

const shouldZip = Bun.argv.includes("--zip");

(async () => {
  try {
    await rm("./dist", { recursive: true, force: true });
  } catch (e) {}

  const result = await Bun.build({
    entrypoints: ["./src/index.ts", "./src/bridge.ts"],
    outdir: "./dist",
    naming: "[name].js",
    minify: true,
  });

  if (!result.success) {
    console.error("Build failed :(", result.logs);
    return;
  }

  // Copy Manifest
  await Bun.write("./dist/manifest.json", Bun.file("./manifest.json"));

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
