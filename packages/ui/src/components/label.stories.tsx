import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "./input";
import { Label } from "./label";

const meta = {
	title: "UI/Label",
	component: Label,
	tags: ["autodocs"],
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: { children: "Label text" },
};

export const WithInput: Story = {
	render: () => (
		<div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 300 }}>
			<Label htmlFor="name-input">Name</Label>
			<Input id="name-input" placeholder="Enter your name" />
		</div>
	),
};

export const Disabled: Story = {
	render: () => (
		<div data-disabled="true" className="group" style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 300 }}>
			<Label>Disabled label</Label>
			<Input disabled placeholder="Disabled" />
		</div>
	),
};
