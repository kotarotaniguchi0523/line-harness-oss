import { lineHarnessPreset } from "@line-crm/design-tokens";
import { defineConfig } from "@pandacss/dev";

export default defineConfig({
	preflight: true,
	presets: [lineHarnessPreset],
	strictTokens: true,

	include: ["./src/**/*.{ts,tsx}"],
	exclude: [],

	outdir: "styled-system",
	cssVarRoot: ":root",
	jsxFramework: "react",
});
