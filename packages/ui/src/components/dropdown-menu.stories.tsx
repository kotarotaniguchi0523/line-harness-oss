import type { Meta, StoryObj } from "@storybook/react";
import {
	BellIcon,
	CloudIcon,
	CreditCardIcon,
	KeyboardIcon,
	LogOutIcon,
	MailIcon,
	MessageSquareIcon,
	PlusCircleIcon,
	SettingsIcon,
	UserIcon,
	UsersIcon,
} from "lucide-react";
import { Button } from "./button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "./dropdown-menu";

const meta = {
	title: "UI/DropdownMenu",
	component: DropdownMenu,
	parameters: {
		layout: "centered",
	},
} satisfies Meta<typeof DropdownMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render: () => (
		<DropdownMenu defaultOpen>
			<DropdownMenuTrigger render={<Button variant="outline" />}>
				メニューを開く
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuItem>プロフィール</DropdownMenuItem>
				<DropdownMenuItem>設定</DropdownMenuItem>
				<DropdownMenuItem>ログアウト</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	),
};

export const WithCheckbox: Story = {
	render: () => (
		<DropdownMenu defaultOpen>
			<DropdownMenuTrigger render={<Button variant="outline" />}>
				チェックボックス
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuLabel>表示設定</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuCheckboxItem checked>ステータスバー</DropdownMenuCheckboxItem>
				<DropdownMenuCheckboxItem>アクティビティバー</DropdownMenuCheckboxItem>
				<DropdownMenuCheckboxItem>パネル</DropdownMenuCheckboxItem>
			</DropdownMenuContent>
		</DropdownMenu>
	),
};

export const WithRadioGroup: Story = {
	render: () => (
		<DropdownMenu defaultOpen>
			<DropdownMenuTrigger render={<Button variant="outline" />}>
				ラジオグループ
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuLabel>位置</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuRadioGroup value="bottom">
					<DropdownMenuRadioItem value="top">上</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="bottom">下</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="right">右</DropdownMenuRadioItem>
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	),
};

export const WithSubmenu: Story = {
	render: () => (
		<DropdownMenu defaultOpen>
			<DropdownMenuTrigger render={<Button variant="outline" />}>
				サブメニュー
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuItem>新規作成</DropdownMenuItem>
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>その他のオプション</DropdownMenuSubTrigger>
					<DropdownMenuSubContent>
						<DropdownMenuItem>サブ項目 1</DropdownMenuItem>
						<DropdownMenuItem>サブ項目 2</DropdownMenuItem>
						<DropdownMenuItem>サブ項目 3</DropdownMenuItem>
					</DropdownMenuSubContent>
				</DropdownMenuSub>
				<DropdownMenuItem>削除</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	),
};

export const WithIcons: Story = {
	render: () => (
		<DropdownMenu defaultOpen>
			<DropdownMenuTrigger render={<Button variant="outline" />}>
				アイコン付き
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuGroup>
					<DropdownMenuItem>
						<UserIcon />
						プロフィール
					</DropdownMenuItem>
					<DropdownMenuItem>
						<CreditCardIcon />
						お支払い
					</DropdownMenuItem>
					<DropdownMenuItem>
						<SettingsIcon />
						設定
					</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuItem>
					<LogOutIcon />
					ログアウト
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	),
};

export const WithShortcuts: Story = {
	render: () => (
		<DropdownMenu defaultOpen>
			<DropdownMenuTrigger render={<Button variant="outline" />}>
				ショートカット
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuItem>
					新規タブ
					<DropdownMenuShortcut>⌘T</DropdownMenuShortcut>
				</DropdownMenuItem>
				<DropdownMenuItem>
					新規ウィンドウ
					<DropdownMenuShortcut>⌘N</DropdownMenuShortcut>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem>
					印刷
					<DropdownMenuShortcut>⌘P</DropdownMenuShortcut>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	),
};

export const WithSeparators: Story = {
	render: () => (
		<DropdownMenu defaultOpen>
			<DropdownMenuTrigger render={<Button variant="outline" />}>
				セパレーター
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuLabel>アカウント</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem>プロフィール</DropdownMenuItem>
					<DropdownMenuItem>設定</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuLabel>チーム</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem>メンバー</DropdownMenuItem>
					<DropdownMenuItem>招待</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	),
};

export const DestructiveItem: Story = {
	render: () => (
		<DropdownMenu defaultOpen>
			<DropdownMenuTrigger render={<Button variant="outline" />}>
				危険な操作
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuItem>編集</DropdownMenuItem>
				<DropdownMenuItem>複製</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem variant="destructive">削除</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	),
};

export const DisabledItems: Story = {
	render: () => (
		<DropdownMenu defaultOpen>
			<DropdownMenuTrigger render={<Button variant="outline" />}>
				無効項目
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuItem>有効な項目</DropdownMenuItem>
				<DropdownMenuItem disabled>無効な項目（disabled）</DropdownMenuItem>
				<DropdownMenuItem>有効な項目 2</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	),
};

export const FullKitchen: Story = {
	render: () => (
		<DropdownMenu defaultOpen>
			<DropdownMenuTrigger render={<Button variant="outline" />}>
				全機能
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-56">
				<DropdownMenuLabel>マイアカウント</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem>
						<UserIcon />
						プロフィール
						<DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
					</DropdownMenuItem>
					<DropdownMenuItem>
						<CreditCardIcon />
						お支払い
						<DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
					</DropdownMenuItem>
					<DropdownMenuItem>
						<SettingsIcon />
						設定
						<DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
					</DropdownMenuItem>
					<DropdownMenuItem>
						<KeyboardIcon />
						キーボードショートカット
						<DropdownMenuShortcut>⌘K</DropdownMenuShortcut>
					</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem>
						<UsersIcon />
						チーム
					</DropdownMenuItem>
					<DropdownMenuSub>
						<DropdownMenuSubTrigger>
							<PlusCircleIcon />
							新しいチーム
						</DropdownMenuSubTrigger>
						<DropdownMenuSubContent>
							<DropdownMenuItem>
								<MailIcon />
								メール
							</DropdownMenuItem>
							<DropdownMenuItem>
								<MessageSquareIcon />
								メッセージ
							</DropdownMenuItem>
							<DropdownMenuItem>
								<CloudIcon />
								クラウド
							</DropdownMenuItem>
						</DropdownMenuSubContent>
					</DropdownMenuSub>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuCheckboxItem checked>ステータスバー</DropdownMenuCheckboxItem>
				<DropdownMenuCheckboxItem>アクティビティバー</DropdownMenuCheckboxItem>
				<DropdownMenuSeparator />
				<DropdownMenuRadioGroup value="bottom">
					<DropdownMenuRadioItem value="top">上部に表示</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="bottom">下部に表示</DropdownMenuRadioItem>
				</DropdownMenuRadioGroup>
				<DropdownMenuSeparator />
				<DropdownMenuItem>
					<BellIcon />
					通知
					<DropdownMenuShortcut>⌘N</DropdownMenuShortcut>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem variant="destructive">
					<LogOutIcon />
					ログアウト
					<DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	),
};
