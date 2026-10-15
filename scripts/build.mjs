import * as esbuild from "esbuild";

try {
  await esbuild.build({
    entryPoints: {
      cli: "src/cli.ts",
      action: "src/action.ts",
    },
    bundle: true,
    platform: "node",
    target: "node22",
    format: "esm",
    outdir: "dist",
    logLevel: "info",
  });
} catch {
  process.exit(1);
}
