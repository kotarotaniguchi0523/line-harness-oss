import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { ThemeProvider } from "next-themes";
import { toast } from "sonner";
import { Button } from "./button";
import { Toaster } from "./sonner";

const withThemeProvider: Decorator = (Story) => (
	<ThemeProvider attribute="class" defaultTheme="light">
		<Story />
	</ThemeProvider>
);

const withToaster: Decorator = (Story) => (
	<>
		<Toaster />
		<Story />
	</>
);

const meta = {
	title: "UI/Sonner",
	component: Toaster,
	decorators: [withThemeProvider, withToaster],
	parameters: {
		layout: "centered",
	},
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {
	render: () => (
		<Button variant="outline" onClick={() => toast.success("成功しました", { id: "success" })}>
			成功トースト
		</Button>
	),
};

export const Error: Story = {
	render: () => (
		<Button variant="outline" onClick={() => toast.error("エラーが発生しました", { id: "error" })}>
			エラートースト
		</Button>
	),
};

export const Warning: Story = {
	render: () => (
		<Button variant="outline" onClick={() => toast.warning("警告: 確認してください", { id: "warning" })}>
			警告トースト
		</Button>
	),
};

export const Info: Story = {
	render: () => (
		<Button variant="outline" onClick={() => toast.info("情報をお知らせします", { id: "info" })}>
			情報トースト
		</Button>
	),
};

export const Loading: Story = {
	render: () => (
		<Button variant="outline" onClick={() => toast.loading("読み込み中...", { id: "loading" })}>
			ローディングトースト
		</Button>
	),
};

export const WithDescription: Story = {
	render: () => (
		<Button
			variant="outline"
			onClick={() =>
				toast.success("保存しました", {
					id: "with-desc",
					description: "変更内容が正常に保存されました。",
				})
			}
		>
			説明付きトースト
		</Button>
	),
};

export const CustomAction: Story = {
	render: () => (
		<Button
			variant="outline"
			onClick={() =>
				toast("メッセージを送信しました", {
					id: "with-action",
					action: {
						label: "元に戻す",
						onClick: () => toast.dismiss("with-action"),
					},
				})
			}
		>
			アクション付きトースト
		</Button>
	),
};
