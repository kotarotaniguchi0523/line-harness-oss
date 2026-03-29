import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
	stories: ["../apps/web/src/**/*.stories.@(ts|tsx)", "../packages/ui/src/**/*.stories.@(ts|tsx)"],
	addons: ["@storybook/addon-essentials"],
	framework: {
		name: "@storybook/react-vite",
		options: {},
	},
	typescript: {
		reactDocgen: "react-docgen-typescript",
	},
};

export default config;
