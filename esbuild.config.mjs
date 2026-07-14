import esbuild from "esbuild";
import process from "process";
import { builtinModules } from "module";
import esbuildSvelte from "esbuild-svelte";
import { sveltePreprocess } from "svelte-preprocess";
import { compileModule } from "svelte/compiler";
import { readFileSync } from "fs";

const banner = `/* BUNDLED FILE VIA ESBUILD */`;
const prod = process.argv[2] === "production";

/**
 * esbuild plugin that compiles Svelte 5 runes modules (.svelte.ts)
 */
const svelteRunesModulePlugin = {
  name: "svelte-runes-module",
  setup(build) {
    build.onLoad({ filter: /\.svelte\.[jt]s$/ }, async (args) => {
      const source = readFileSync(args.path, "utf8");
      const isTs = args.path.endsWith(".ts");
      try {
        let jsSource = source;
        if (isTs) {
          const tsResult = await esbuild.transform(source, {
            loader: "ts",
            target: "es2022",
            tsconfigRaw: {
              compilerOptions: { verbatimModuleSyntax: false },
            },
          });
          jsSource = tsResult.code;
        }
        const result = compileModule(jsSource, {
          filename: args.path.replace(/\.ts$/, ".js"),
                                     dev: !prod,
                                     generate: "client",
        });
        return {
          contents: result.js.code,
          loader: "js",
          resolveDir: args.resolveDir,
        };
      } catch (err) {
        return {
          errors: [
            {
              text: err instanceof Error ? err.message : String(err),
                 detail: err,
            },
          ],
        };
      }
    });
  },
};

const context = await esbuild.context({
  banner: {
    js: banner,
  },
  entryPoints: ["src/main.ts"],
  bundle: true,
  plugins: [
    svelteRunesModulePlugin,
    esbuildSvelte({
      compilerOptions: {
        css: true,
        dev: !prod,
        warningFilter: (warning) => {
          const suppressed = [
            'state_referenced_locally',
            'a11y_label_has_associated_control',
            'a11y_no_static_element_interactions'
          ];
          return !suppressed.includes(warning.code);
        }
      },
      preprocess: sveltePreprocess(),
    }),
  ],
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtinModules,
    ...builtinModules.map((m) => `node:${m}`),

  ],
  format: "cjs",
    target: "es2022",
    logLevel: "info",
    sourcemap: prod ? false : "inline",
    treeShaking: true,
    outfile: "main.js",
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
