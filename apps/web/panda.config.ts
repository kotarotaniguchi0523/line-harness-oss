import { defineConfig } from "@pandacss/dev";

export default defineConfig({
	preflight: true,
	presets: ["@pandacss/preset-base", "@pandacss/preset-panda"],
	strictTokens: false,
	strictPropertyValues: false,

	include: ["./src/**/*.{ts,tsx}"],
	exclude: [],

	outdir: "styled-system",
	cssVarRoot: ":root",
	jsxFramework: "react",

	globalCss: {
		"*": { borderColor: "{colors.gray.200}" },
		body: {
			bg: "white",
			color: "{colors.gray.900}",
			fontFamily: "'Inter Variable', system-ui, sans-serif",
		},
	},

	theme: {
		extend: {
			tokens: {
				colors: {
					line: {
						green: { value: "#06C755" },
						greenHover: { value: "#05B34C" },
						dark: { value: "#1A1A1A" },
					},
				},
			},
			semanticTokens: {
				colors: {
					primary: {
						DEFAULT: { value: { _light: "{colors.line.green}", _dark: "{colors.line.green}" } },
						hover: { value: { _light: "{colors.line.greenHover}", _dark: "{colors.line.greenHover}" } },
					},
					danger: {
						DEFAULT: { value: { _light: "{colors.red.500}", _dark: "{colors.red.400}" } },
						bg: { value: { _light: "{colors.red.50}", _dark: "{colors.red.900}" } },
						text: { value: { _light: "{colors.red.700}", _dark: "{colors.red.400}" } },
					},
					success: {
						DEFAULT: { value: { _light: "{colors.green.500}", _dark: "{colors.green.400}" } },
						bg: { value: { _light: "{colors.green.50}", _dark: "{colors.green.900}" } },
					},
					bg: {
						DEFAULT: { value: { _light: "white", _dark: "{colors.gray.900}" } },
						subtle: { value: { _light: "{colors.gray.50}", _dark: "{colors.gray.800}" } },
						muted: { value: { _light: "{colors.gray.100}", _dark: "{colors.gray.700}" } },
					},
					fg: {
						DEFAULT: { value: { _light: "{colors.gray.900}", _dark: "{colors.gray.50}" } },
						muted: { value: { _light: "{colors.gray.500}", _dark: "{colors.gray.400}" } },
						subtle: { value: { _light: "{colors.gray.400}", _dark: "{colors.gray.500}" } },
					},
					border: {
						DEFAULT: { value: { _light: "{colors.gray.200}", _dark: "{colors.gray.700}" } },
					},
				},
			},
		},
	},
});
