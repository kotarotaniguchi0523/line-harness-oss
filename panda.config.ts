import { lineHarnessPreset } from "@line-crm/design-tokens";
import { defineConfig } from "@pandacss/dev";

export default defineConfig({
	preflight: true,
	presets: [lineHarnessPreset],

	// Type-safe token enforcement: unknown tokens cause TypeScript errors
	strictTokens: true,

	// Source files to scan for Panda CSS usage
	include: ["./apps/web/src/**/*.{ts,tsx}", "./packages/ui/src/**/*.{ts,tsx}"],
	exclude: [],

	// Output directory for generated CSS utilities
	outdir: "styled-system",

	// Use CSS variables for runtime token access
	cssVarRoot: ":root",

	// JSX factory for type-safe styled components
	jsxFramework: "react",
});
