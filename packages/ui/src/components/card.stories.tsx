import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "./card";

const meta = {
	title: "UI/Card",
	component: Card,
	parameters: {
		layout: "centered",
	},
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render: () => (
		<Card className="w-80">
			<CardHeader>
				<CardTitle>カードタイトル</CardTitle>
				<CardDescription>カードの説明文がここに入ります。</CardDescription>
			</CardHeader>
			<CardContent>
				<p>カードのコンテンツエリアです。</p>
			</CardContent>
			<CardFooter>
				<Button variant="default" size="sm">
					アクション
				</Button>
			</CardFooter>
		</Card>
	),
};

export const SmallSize: Story = {
	render: () => (
		<Card size="sm" className="w-80">
			<CardHeader>
				<CardTitle>スモールカード</CardTitle>
				<CardDescription>size="sm" が適用されたカードです。</CardDescription>
			</CardHeader>
			<CardContent>
				<p>コンパクトなレイアウト。</p>
			</CardContent>
			<CardFooter>
				<Button variant="outline" size="xs">
					閉じる
				</Button>
			</CardFooter>
		</Card>
	),
};

export const WithAction: Story = {
	render: () => (
		<Card className="w-80">
			<CardHeader>
				<CardTitle>アクション付きカード</CardTitle>
				<CardDescription>右端にアクションボタンが配置されます。</CardDescription>
				<CardAction>
					<Button variant="ghost" size="icon-sm">
						✕
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				<p>CardAction は CardHeader 内で右端に配置されます。</p>
			</CardContent>
		</Card>
	),
};

export const ContentOnly: Story = {
	render: () => (
		<Card className="w-80">
			<CardContent>
				<p>CardContent のみのシンプルなカードです。</p>
			</CardContent>
		</Card>
	),
};

export const WithForm: Story = {
	render: () => (
		<Card className="w-96">
			<CardHeader>
				<CardTitle>ログイン</CardTitle>
				<CardDescription>アカウント情報を入力してください。</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<div className="flex flex-col gap-1">
					<Label htmlFor="email">メールアドレス</Label>
					<Input id="email" type="email" placeholder="example@example.com" />
				</div>
				<div className="flex flex-col gap-1">
					<Label htmlFor="password">パスワード</Label>
					<Input id="password" type="password" placeholder="••••••••" />
				</div>
			</CardContent>
			<CardFooter className="gap-2">
				<Button variant="default" className="flex-1">
					ログイン
				</Button>
				<Button variant="outline" className="flex-1">
					キャンセル
				</Button>
			</CardFooter>
		</Card>
	),
};
