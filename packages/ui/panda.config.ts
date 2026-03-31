import { lineHarnessPreset } from "@line-crm/design-tokens";
import { defineConfig } from "@pandacss/dev";

export default defineConfig({
	preflight: false,
	presets: [lineHarnessPreset],
	strictTokens: true,
	include: ["./src/**/*.{ts,tsx}"],
	exclude: ["./src/**/*.stories.{ts,tsx}"],
	outdir: "styled-system",
	jsxFramework: "react",
});
