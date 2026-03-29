import type { Preview } from "@storybook/react";

const preview: Preview = {
	parameters: {
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i,
			},
		},
		backgrounds: {
			default: "light",
			values: [
				{ name: "light", value: "#FFFFFF" },
				{ name: "dark", value: "#111827" },
				{ name: "line-green", value: "#06C755" },
			],
		},
	},
};

export default preview;
