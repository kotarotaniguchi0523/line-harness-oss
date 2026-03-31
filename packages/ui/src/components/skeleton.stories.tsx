import type { Meta, StoryObj } from "@storybook/react";
import { Skeleton } from "./skeleton";

const meta = {
	title: "UI/Skeleton",
	component: Skeleton,
	parameters: {
		layout: "centered",
	},
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render: () => <Skeleton className="h-12 w-64" />,
};

export const Circle: Story = {
	render: () => <Skeleton className="size-12 rounded-full" />,
};

export const TextLine: Story = {
	render: () => (
		<div className="flex flex-col gap-2 w-64">
			<Skeleton className="h-4 w-full" />
			<Skeleton className="h-4 w-5/6" />
			<Skeleton className="h-4 w-4/6" />
		</div>
	),
};

export const CardSkeleton: Story = {
	render: () => (
		<div className="flex flex-col gap-4 w-80 rounded-none ring-1 ring-foreground/10 p-4">
			<div className="flex items-center gap-3">
				<Skeleton className="size-10 rounded-full" />
				<div className="flex flex-col gap-2 flex-1">
					<Skeleton className="h-4 w-3/4" />
					<Skeleton className="h-3 w-1/2" />
				</div>
			</div>
			<Skeleton className="h-32 w-full" />
			<div className="flex flex-col gap-2">
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-5/6" />
				<Skeleton className="h-4 w-4/6" />
			</div>
		</div>
	),
};

export const ListSkeleton: Story = {
	render: () => (
		<div className="flex flex-col gap-3 w-80">
			{Array.from({ length: 5 }).map((_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: storybook display only
				<div key={i} className="flex items-center gap-3">
					<Skeleton className="size-8 rounded-full" />
					<div className="flex flex-col gap-1 flex-1">
						<Skeleton className="h-3.5 w-3/4" />
						<Skeleton className="h-3 w-1/2" />
					</div>
					<Skeleton className="h-8 w-16" />
				</div>
			))}
		</div>
	),
};
