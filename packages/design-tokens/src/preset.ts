import { definePreset } from "@pandacss/dev";

export const lineHarnessPreset = definePreset({
	name: "line-harness",
	theme: {
		tokens: {
			colors: {
				// LINE Brand
				line: {
					green: { value: "#06C755" },
					greenHover: { value: "#05B34C" },
					dark: { value: "#1A1A1A" },
				},
				// Neutral
				white: { value: "#FFFFFF" },
				black: { value: "#000000" },
				gray: {
					50: { value: "#F9FAFB" },
					100: { value: "#F3F4F6" },
					200: { value: "#E5E7EB" },
					300: { value: "#D1D5DB" },
					400: { value: "#9CA3AF" },
					500: { value: "#6B7280" },
					600: { value: "#4B5563" },
					700: { value: "#374151" },
					800: { value: "#1F2937" },
					900: { value: "#111827" },
				},
				// Semantic base
				blue: {
					50: { value: "#EFF6FF" },
					100: { value: "#DBEAFE" },
					400: { value: "#60A5FA" },
					500: { value: "#3B82F6" },
					600: { value: "#2563EB" },
				},
				red: {
					50: { value: "#FEF2F2" },
					100: { value: "#FEE2E2" },
					200: { value: "#FECACA" },
					400: { value: "#F87171" },
					500: { value: "#EF4444" },
					600: { value: "#DC2626" },
					700: { value: "#B91C1C" },
				},
				yellow: {
					50: { value: "#FFFBEB" },
					100: { value: "#FEF3C7" },
					400: { value: "#FBBF24" },
					500: { value: "#F59E0B" },
					600: { value: "#D97706" },
				},
				green: {
					50: { value: "#ECFDF5" },
					100: { value: "#D1FAE5" },
					400: { value: "#34D399" },
					500: { value: "#10B981" },
					600: { value: "#059669" },
				},
			},
			spacing: {
				xs: { value: "4px" },
				sm: { value: "8px" },
				md: { value: "12px" },
				lg: { value: "16px" },
				xl: { value: "24px" },
				"2xl": { value: "32px" },
				"3xl": { value: "48px" },
				"4xl": { value: "64px" },
			},
			radii: {
				sm: { value: "4px" },
				md: { value: "8px" },
				lg: { value: "12px" },
				xl: { value: "16px" },
				full: { value: "9999px" },
			},
			fontSizes: {
				xs: { value: "0.75rem" },
				sm: { value: "0.875rem" },
				md: { value: "1rem" },
				lg: { value: "1.125rem" },
				xl: { value: "1.25rem" },
				"2xl": { value: "1.5rem" },
				"3xl": { value: "1.875rem" },
			},
			fontWeights: {
				normal: { value: "400" },
				medium: { value: "500" },
				semibold: { value: "600" },
				bold: { value: "700" },
			},
			lineHeights: {
				tight: { value: "1.25" },
				normal: { value: "1.5" },
				relaxed: { value: "1.75" },
			},
			shadows: {
				sm: { value: "0 1px 2px 0 rgb(0 0 0 / 0.05)" },
				md: { value: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)" },
				lg: { value: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)" },
			},
		},
		semanticTokens: {
			colors: {
				// Primary actions
				primary: {
					DEFAULT: { value: { _light: "{colors.line.green}", _dark: "{colors.line.green}" } },
					hover: { value: { _light: "{colors.line.greenHover}", _dark: "{colors.line.greenHover}" } },
					text: { value: { _light: "{colors.white}", _dark: "{colors.white}" } },
				},
				// Status
				danger: {
					DEFAULT: { value: { _light: "{colors.red.500}", _dark: "{colors.red.400}" } },
					bg: { value: { _light: "{colors.red.50}", _dark: "{colors.red.500/10}" } },
					border: { value: { _light: "{colors.red.200}", _dark: "{colors.red.400/30}" } },
					text: { value: { _light: "{colors.red.700}", _dark: "{colors.red.400}" } },
				},
				warning: {
					DEFAULT: { value: { _light: "{colors.yellow.500}", _dark: "{colors.yellow.400}" } },
					bg: { value: { _light: "{colors.yellow.50}", _dark: "{colors.yellow.500/10}" } },
				},
				success: {
					DEFAULT: { value: { _light: "{colors.green.500}", _dark: "{colors.green.400}" } },
					bg: { value: { _light: "{colors.green.50}", _dark: "{colors.green.500/10}" } },
				},
				info: {
					DEFAULT: { value: { _light: "{colors.blue.500}", _dark: "{colors.blue.400}" } },
					bg: { value: { _light: "{colors.blue.50}", _dark: "{colors.blue.500/10}" } },
				},
				// Surface
				bg: {
					DEFAULT: { value: { _light: "{colors.white}", _dark: "{colors.gray.900}" } },
					subtle: { value: { _light: "{colors.gray.50}", _dark: "{colors.gray.800}" } },
					muted: { value: { _light: "{colors.gray.100}", _dark: "{colors.gray.700}" } },
				},
				// Text
				fg: {
					DEFAULT: { value: { _light: "{colors.gray.900}", _dark: "{colors.gray.50}" } },
					muted: { value: { _light: "{colors.gray.500}", _dark: "{colors.gray.400}" } },
					subtle: { value: { _light: "{colors.gray.400}", _dark: "{colors.gray.500}" } },
				},
				// Border
				border: {
					DEFAULT: { value: { _light: "{colors.gray.200}", _dark: "{colors.gray.700}" } },
					subtle: { value: { _light: "{colors.gray.100}", _dark: "{colors.gray.800}" } },
				},
			},
		},
	},
});
