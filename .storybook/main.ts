import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
	stories: ["../apps/web/src/**/*.stories.@(ts|tsx)", "../packages/ui/src/**/*.stories.@(ts|tsx)"],
	addons: [],
	framework: {
		name: "@storybook/react-vite",
		options: {},
	},
	typescript: {
		reactDocgen: "react-docgen-typescript",
	},
	viteFinal(config) {
		config.resolve ??= {};
		config.resolve.alias = {
			...config.resolve.alias,
			"@line-crm/ui": resolve(__dirname, "../packages/ui/src"),
		};
		return config;
	},
};

export default config;
