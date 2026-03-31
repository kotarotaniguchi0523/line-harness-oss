import { Fragment } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Heart, Loader2, Mail, Plus } from "lucide-react";
import { Button } from "./button";

const meta = {
	title: "UI/Button",
	component: Button,
	tags: ["autodocs"],
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: { children: "Button" },
};

export const AllVariants: Story = {
	render: () => (
		<div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
			<Button variant="default">Default</Button>
			<Button variant="outline">Outline</Button>
			<Button variant="secondary">Secondary</Button>
			<Button variant="ghost">Ghost</Button>
			<Button variant="destructive">Destructive</Button>
			<Button variant="link">Link</Button>
		</div>
	),
};

export const AllSizes: Story = {
	render: () => (
		<div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
			<Button size="xs">XS</Button>
			<Button size="sm">SM</Button>
			<Button size="default">Default</Button>
			<Button size="lg">LG</Button>
			<Button size="icon"><Plus /></Button>
			<Button size="icon-xs"><Plus /></Button>
			<Button size="icon-sm"><Plus /></Button>
			<Button size="icon-lg"><Plus /></Button>
		</div>
	),
};

export const WithIcon: Story = {
	render: () => (
		<div style={{ display: "flex", gap: 8 }}>
			<Button><Mail /> Send Email</Button>
			<Button variant="outline"><Heart /> Like</Button>
		</div>
	),
};

export const Disabled: Story = {
	args: { children: "Disabled", disabled: true },
};

export const Invalid: Story = {
	args: { children: "Invalid", "aria-invalid": true },
};

export const Loading: Story = {
	render: () => (
		<Button disabled>
			<Loader2 className="animate-spin" /> Loading...
		</Button>
	),
};

export const VariantMatrix: Story = {
	render: () => {
		const variants = ["default", "outline", "secondary", "ghost", "destructive", "link"] as const;
		const sizes = ["xs", "sm", "default", "lg"] as const;
		return (
			<div style={{ display: "grid", gridTemplateColumns: `auto repeat(${variants.length}, 1fr)`, gap: 8, alignItems: "center" }}>
				<div />
				{variants.map((v) => (
					<div key={v} style={{ fontSize: 11, textAlign: "center", fontWeight: 600 }}>{v}</div>
				))}
				{sizes.map((s) => (
					<Fragment key={s}>
						<div style={{ fontSize: 11, fontWeight: 600 }}>{s}</div>
						{variants.map((v) => (
							<Button key={`${v}-${s}`} variant={v} size={s}>
								{v}
							</Button>
						))}
					</Fragment>
				))}
			</div>
		);
	},
};
