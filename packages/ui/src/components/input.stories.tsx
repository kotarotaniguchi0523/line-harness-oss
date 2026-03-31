import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "./input";
import { Label } from "./label";

const meta = {
	title: "UI/Input",
	component: Input,
	tags: ["autodocs"],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: { type: "text", placeholder: "Enter text..." },
};

export const WithPlaceholder: Story = {
	args: { placeholder: "you@example.com" },
};

export const Password: Story = {
	args: { type: "password", placeholder: "Password" },
};

export const Email: Story = {
	args: { type: "email", placeholder: "you@example.com" },
};

export const FileInput: Story = {
	args: { type: "file" },
};

export const Disabled: Story = {
	args: { placeholder: "Disabled input", disabled: true },
};

export const Invalid: Story = {
	args: { placeholder: "Invalid input", "aria-invalid": true, defaultValue: "bad value" },
};

export const WithLabel: Story = {
	render: () => (
		<div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 300 }}>
			<Label htmlFor="email-input">Email</Label>
			<Input id="email-input" type="email" placeholder="you@example.com" />
		</div>
	),
};
