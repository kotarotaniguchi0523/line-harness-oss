import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import { z } from "zod";
import { css } from "../../../styled-system/css";
import { queryKeys, queryOptionsConfig } from "../../lib/query-config";
import { fetchApi } from "../../lib/rpc";

// ---------------------------------------------------------------------------
// Types (will be replaced by z.infer<> from @line-crm/contracts)
// ---------------------------------------------------------------------------
interface Chat {
	id: string;
	friendId: string;
	friendName: string | null;
	status: string;
	lastMessageAt: string | null;
}

interface ChatMessage {
	id: string;
	direction: string;
	messageType: string;
	content: string;
	createdAt: string;
}

interface ChatDetail extends Chat {
	messages: ChatMessage[];
}

interface GroupChat {
	id: string;
	groupId: string;
	groupName: string;
	groupPictureUrl: string | null;
	memberCount: number;
	lastMessageAt: string | null;
	status: string;
	sourceType: "group" | "room";
}

interface GroupChatMessage {
	id: string;
	senderName: string | null;
	senderPictureUrl: string | null;
	direction: string;
	messageType: string;
	content: string;
	createdAt: string;
}

interface GroupChatDetail extends GroupChat {
	messages: GroupChatMessage[];
}

// ---------------------------------------------------------------------------
// Chat mode tabs configuration
// ---------------------------------------------------------------------------
const CHAT_MODE_TABS = [
	{ value: "direct" as const, label: "1:1チャット" },
	{ value: "group" as const, label: "グループチャット" },
] as const;

type ChatMode = (typeof CHAT_MODE_TABS)[number]["value"];

// ---------------------------------------------------------------------------
// Status filter configuration (shared between direct and group chats)
// ---------------------------------------------------------------------------
const STATUS_STYLES: Record<string, { label: string; bg: string; color: string }> = {
	unread: { label: "未読", bg: "red.100", color: "red.700" },
	in_progress: { label: "対応中", bg: "yellow.100", color: "yellow.700" },
	resolved: { label: "解決済", bg: "green.100", color: "green.700" },
};

const STATUS_FILTER_TABS = [
	{ value: "", label: "全て" },
	{ value: "unread", label: "未読" },
	{ value: "in_progress", label: "対応中" },
	{ value: "resolved", label: "解決済" },
] as const;

// ---------------------------------------------------------------------------
// Search schema: URL-based state for chat mode and status filter
// ---------------------------------------------------------------------------
const chatsSearchSchema = z.object({
	mode: z.enum(["direct", "group"]).default("direct").catch("direct"),
	status: z.string().default("").catch(""),
});

// ---------------------------------------------------------------------------
// Route definition
// ---------------------------------------------------------------------------
export const Route = createFileRoute("/_authed/chats")({
	validateSearch: chatsSearchSchema,
	loader: async ({ context: { queryClient }, search: { mode, status } }) => {
		if (mode === "group") {
			await queryClient.ensureQueryData({
				...queryOptionsConfig.groupChats.list(status ? { status } : undefined),
				queryFn: () =>
					fetchApi<{ success: true; data: GroupChat[] }>(`/api/chats/groups${status ? `?status=${status}` : ""}`),
			});
		} else {
			await queryClient.ensureQueryData({
				...queryOptionsConfig.chats.list(status ? { status } : undefined),
				queryFn: () => fetchApi<{ success: true; data: Chat[] }>(`/api/chats${status ? `?status=${status}` : ""}`),
			});
		}
	},
	component: ChatsPage,
});

// ---------------------------------------------------------------------------
// Route Component (orchestrates Suspense boundaries + mode toggle)
// ---------------------------------------------------------------------------
function ChatsPage() {
	const { mode, status } = Route.useSearch();
	const navigate = Route.useNavigate();

	const handleModeChange = (nextMode: ChatMode) => {
		navigate({ search: { mode: nextMode, status: "" } });
	};

	const handleStatusChange = (nextStatus: string) => {
		navigate({ search: (prev) => ({ ...prev, status: nextStatus }) });
	};

	return (
		<div className={css({ display: "flex", flexDirection: "column", h: "calc(100vh - 120px)" })}>
			<ChatModeToggle currentMode={mode} onModeChange={handleModeChange} />
			{mode === "direct" ? (
				<Suspense fallback={<ChatListSkeleton />}>
					<DirectChatPanel statusFilter={status} onStatusChange={handleStatusChange} />
				</Suspense>
			) : (
				<Suspense fallback={<ChatListSkeleton />}>
					<GroupChatPanel statusFilter={status} onStatusChange={handleStatusChange} />
				</Suspense>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Presentation: Chat mode toggle (1:1 / group)
// ---------------------------------------------------------------------------
function ChatModeToggle({
	currentMode,
	onModeChange,
}: {
	currentMode: ChatMode;
	onModeChange: (mode: ChatMode) => void;
}) {
	return (
		<div
			className={css({
				display: "flex",
				borderBottomWidth: "1px",
				borderColor: "gray.200",
				mb: "0",
				flexShrink: "0",
			})}
		>
			{CHAT_MODE_TABS.map((tab) => (
				<button
					type="button"
					key={tab.value}
					onClick={() => onModeChange(tab.value)}
					className={css({
						minH: "44px",
						flex: "1",
						fontSize: "sm",
						fontWeight: "semibold",
						cursor: "pointer",
						borderBottomWidth: currentMode === tab.value ? "2px" : "0",
						borderColor: currentMode === tab.value ? "line.green" : "transparent",
						color: currentMode === tab.value ? "line.green" : "gray.500",
						bg: "transparent",
						transition: "colors",
						_hover: { color: currentMode === tab.value ? "line.green" : "gray.700" },
					})}
				>
					{tab.label}
				</button>
			))}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Presentation: Status filter bar (shared between direct & group chats)
// ---------------------------------------------------------------------------
function StatusFilterBar({
	currentStatus,
	onStatusChange,
}: {
	currentStatus: string;
	onStatusChange: (status: string) => void;
}) {
	return (
		<div className={css({ display: "flex", borderBottomWidth: "1px", borderColor: "gray.200" })}>
			{STATUS_FILTER_TABS.map((tab) => (
				<button
					type="button"
					key={tab.value}
					onClick={() => onStatusChange(tab.value)}
					className={css({
						minH: "40px",
						flex: "1",
						fontSize: "xs",
						fontWeight: "medium",
						cursor: "pointer",
						borderBottomWidth: currentStatus === tab.value ? "2px" : "0",
						borderColor: currentStatus === tab.value ? "line.green" : "transparent",
						color: currentStatus === tab.value ? "line.green" : "gray.500",
						bg: "transparent",
					})}
				>
					{tab.label}
				</button>
			))}
		</div>
	);
}

// ===========================================================================
// Direct (1:1) Chat Panel
// ===========================================================================

function DirectChatPanel({
	statusFilter,
	onStatusChange,
}: {
	statusFilter: string;
	onStatusChange: (status: string) => void;
}) {
	const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

	return (
		<div className={css({ display: "flex", flex: "1", gap: "0", overflow: "hidden" })}>
			<div
				className={css({
					w: { base: "full", lg: "80" },
					flexShrink: "0",
					overflowY: "auto",
					borderRightWidth: "1px",
					borderColor: "gray.200",
					display: "flex",
					flexDirection: "column",
				})}
			>
				<StatusFilterBar currentStatus={statusFilter} onStatusChange={onStatusChange} />
				<Suspense fallback={<ChatListItemsSkeleton />}>
					<DirectChatList
						statusFilter={statusFilter}
						selectedChatId={selectedChatId}
						onSelectChat={setSelectedChatId}
					/>
				</Suspense>
			</div>
			<div className={css({ display: { base: "none", lg: "flex" }, flex: "1", flexDirection: "column" })}>
				{selectedChatId ? (
					<Suspense fallback={<MessageThreadSkeleton />}>
						<DirectChatThread chatId={selectedChatId} />
					</Suspense>
				) : (
					<EmptyThreadPlaceholder message="チャットを選択してください" />
				)}
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Container: Direct chat list (fetches 1:1 chats)
// ---------------------------------------------------------------------------
function DirectChatList({
	statusFilter,
	selectedChatId,
	onSelectChat,
}: {
	statusFilter: string;
	selectedChatId: string | null;
	onSelectChat: (id: string) => void;
}) {
	const { data } = useSuspenseQuery({
		...queryOptionsConfig.chats.list(statusFilter ? { status: statusFilter } : undefined),
		queryFn: () =>
			fetchApi<{ success: true; data: Chat[] }>(`/api/chats${statusFilter ? `?status=${statusFilter}` : ""}`),
	});

	const chatList = data.data;

	if (chatList.length === 0) {
		return <EmptyListMessage message="該当するチャットはありません" />;
	}

	return (
		<div className={css({ divideY: "1px", divideColor: "gray.100", overflowY: "auto" })}>
			{chatList.map((chat) => (
				<DirectChatRow
					key={chat.id}
					chat={chat}
					isSelected={selectedChatId === chat.id}
					onSelect={() => onSelectChat(chat.id)}
				/>
			))}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Presentation: Direct chat row
// ---------------------------------------------------------------------------
function DirectChatRow({ chat, isSelected, onSelect }: { chat: Chat; isSelected: boolean; onSelect: () => void }) {
	const status = STATUS_STYLES[chat.status];
	return (
		<button
			type="button"
			onClick={onSelect}
			className={css({
				w: "full",
				px: "4",
				py: "3",
				textAlign: "left",
				cursor: "pointer",
				bg: isSelected ? "green.50" : "transparent",
				_hover: { bg: isSelected ? "green.50" : "gray.50" },
			})}
		>
			<div className={css({ display: "flex", alignItems: "center", justifyContent: "space-between" })}>
				<span className={css({ fontSize: "sm", fontWeight: "medium", color: "gray.900", truncate: true })}>
					{chat.friendName ?? "不明"}
				</span>
				<span
					className={css({
						borderRadius: "full",
						px: "2",
						py: "0.5",
						fontSize: "xs",
						fontWeight: "medium",
						bg: status?.bg ?? "gray.100",
						color: status?.color ?? "gray.600",
					})}
				>
					{status?.label ?? chat.status}
				</span>
			</div>
			<p className={css({ fontSize: "xs", color: "gray.400", mt: "0.5" })}>
				{chat.lastMessageAt ? new Date(chat.lastMessageAt).toLocaleString("ja-JP") : "---"}
			</p>
		</button>
	);
}

// ---------------------------------------------------------------------------
// Container: Direct chat message thread (fetches detail + handles send)
// ---------------------------------------------------------------------------
function DirectChatThread({ chatId }: { chatId: string }) {
	const queryClient = useQueryClient();
	const [message, setMessage] = useState("");

	const { data } = useSuspenseQuery({
		...queryOptionsConfig.chats.detail(chatId),
		queryFn: () => fetchApi<{ success: true; data: ChatDetail }>(`/api/chats/${chatId}`),
	});

	const sendMutation = useMutation({
		mutationFn: (content: string) =>
			fetchApi(`/api/chats/${chatId}/send`, {
				method: "POST",
				body: JSON.stringify({ content }),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.chats.all });
			setMessage("");
		},
	});

	const updateStatusMutation = useMutation({
		mutationFn: (nextStatus: string) =>
			fetchApi(`/api/chats/${chatId}`, {
				method: "PUT",
				body: JSON.stringify({ status: nextStatus }),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.chats.all });
		},
	});

	const detail = data.data;

	const handleSend = () => {
		const trimmed = message.trim();
		if (trimmed) {
			sendMutation.mutate(trimmed);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	return (
		<>
			<DirectChatThreadHeader
				detail={detail}
				onStatusChange={(nextStatus) => updateStatusMutation.mutate(nextStatus)}
			/>
			<MessageList messages={detail.messages} emptyMessage="メッセージはまだありません。" />
			<MessageInput
				value={message}
				onChange={setMessage}
				onSend={handleSend}
				onKeyDown={handleKeyDown}
				isSending={sendMutation.isPending}
			/>
		</>
	);
}

// ---------------------------------------------------------------------------
// Presentation: Direct chat thread header with status actions
// ---------------------------------------------------------------------------
function DirectChatThreadHeader({
	detail,
	onStatusChange,
}: {
	detail: ChatDetail;
	onStatusChange: (status: string) => void;
}) {
	const statusStyle = STATUS_STYLES[detail.status];
	return (
		<div
			className={css({
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				borderBottomWidth: "1px",
				borderColor: "gray.200",
				px: "4",
				py: "4",
				flexShrink: "0",
			})}
		>
			<div className={css({ display: "flex", alignItems: "center", gap: "2" })}>
				<span className={css({ fontSize: "sm", fontWeight: "medium" })}>{detail.friendName}</span>
				<span
					className={css({
						borderRadius: "full",
						px: "2",
						py: "0.5",
						fontSize: "xs",
						fontWeight: "medium",
						bg: statusStyle?.bg ?? "gray.100",
						color: statusStyle?.color ?? "gray.600",
					})}
				>
					{statusStyle?.label}
				</span>
			</div>
			<div className={css({ display: "flex", gap: "1" })}>
				{detail.status !== "in_progress" && (
					<StatusActionButton
						label="対応中にする"
						bgColor="yellow.50"
						textColor="yellow.700"
						onClick={() => onStatusChange("in_progress")}
					/>
				)}
				{detail.status !== "resolved" && (
					<StatusActionButton
						label="解決済にする"
						bgColor="green.50"
						textColor="green.700"
						onClick={() => onStatusChange("resolved")}
					/>
				)}
			</div>
		</div>
	);
}

// ===========================================================================
// Group Chat Panel
// ===========================================================================

function GroupChatPanel({
	statusFilter,
	onStatusChange,
}: {
	statusFilter: string;
	onStatusChange: (status: string) => void;
}) {
	const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

	return (
		<div className={css({ display: "flex", flex: "1", gap: "0", overflow: "hidden" })}>
			<div
				className={css({
					w: { base: "full", lg: "80" },
					flexShrink: "0",
					overflowY: "auto",
					borderRightWidth: "1px",
					borderColor: "gray.200",
					display: "flex",
					flexDirection: "column",
				})}
			>
				<StatusFilterBar currentStatus={statusFilter} onStatusChange={onStatusChange} />
				<Suspense fallback={<ChatListItemsSkeleton />}>
					<GroupChatList
						statusFilter={statusFilter}
						selectedGroupId={selectedGroupId}
						onSelectGroup={setSelectedGroupId}
					/>
				</Suspense>
			</div>
			<div className={css({ display: { base: "none", lg: "flex" }, flex: "1", flexDirection: "column" })}>
				{selectedGroupId ? (
					<Suspense fallback={<MessageThreadSkeleton />}>
						<GroupChatThread groupId={selectedGroupId} />
					</Suspense>
				) : (
					<EmptyThreadPlaceholder message="グループチャットを選択してください" />
				)}
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Container: Group chat list (fetches group chats)
// ---------------------------------------------------------------------------
function GroupChatList({
	statusFilter,
	selectedGroupId,
	onSelectGroup,
}: {
	statusFilter: string;
	selectedGroupId: string | null;
	onSelectGroup: (groupId: string) => void;
}) {
	const { data } = useSuspenseQuery({
		...queryOptionsConfig.groupChats.list(statusFilter ? { status: statusFilter } : undefined),
		queryFn: () =>
			fetchApi<{ success: true; data: GroupChat[] }>(
				`/api/chats/groups${statusFilter ? `?status=${statusFilter}` : ""}`,
			),
	});

	const groups = data.data;

	if (groups.length === 0) {
		return <EmptyListMessage message="該当するグループチャットはありません" />;
	}

	return (
		<div className={css({ divideY: "1px", divideColor: "gray.100", overflowY: "auto" })}>
			{groups.map((group) => (
				<GroupChatRow
					key={group.id}
					group={group}
					isSelected={selectedGroupId === group.groupId}
					onSelect={() => onSelectGroup(group.groupId)}
				/>
			))}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Presentation: Group chat row with avatar, name, member count
// ---------------------------------------------------------------------------
function GroupChatRow({
	group,
	isSelected,
	onSelect,
}: {
	group: GroupChat;
	isSelected: boolean;
	onSelect: () => void;
}) {
	const status = STATUS_STYLES[group.status];
	const sourceLabel = group.sourceType === "group" ? "グループ" : "ルーム";

	return (
		<button
			type="button"
			onClick={onSelect}
			className={css({
				w: "full",
				px: "4",
				py: "3",
				textAlign: "left",
				cursor: "pointer",
				bg: isSelected ? "green.50" : "transparent",
				_hover: { bg: isSelected ? "green.50" : "gray.50" },
			})}
		>
			<div className={css({ display: "flex", alignItems: "center", gap: "3" })}>
				<GroupAvatar src={group.groupPictureUrl} name={group.groupName} />
				<div className={css({ flex: "1", minW: "0" })}>
					<div className={css({ display: "flex", alignItems: "center", justifyContent: "space-between" })}>
						<span className={css({ fontSize: "sm", fontWeight: "medium", color: "gray.900", truncate: true })}>
							{group.groupName}
						</span>
						{status && (
							<span
								className={css({
									borderRadius: "full",
									px: "2",
									py: "0.5",
									fontSize: "xs",
									fontWeight: "medium",
									bg: status.bg,
									color: status.color,
									flexShrink: "0",
									ml: "2",
								})}
							>
								{status.label}
							</span>
						)}
					</div>
					<div className={css({ display: "flex", alignItems: "center", gap: "2", mt: "0.5" })}>
						<span className={css({ fontSize: "xs", color: "gray.500" })}>
							{sourceLabel} / {group.memberCount}人
						</span>
						<span className={css({ fontSize: "xs", color: "gray.400" })}>
							{group.lastMessageAt ? new Date(group.lastMessageAt).toLocaleString("ja-JP") : "---"}
						</span>
					</div>
				</div>
			</div>
		</button>
	);
}

// ---------------------------------------------------------------------------
// Container: Group chat message thread (fetches messages + handles send)
// ---------------------------------------------------------------------------
function GroupChatThread({ groupId }: { groupId: string }) {
	const queryClient = useQueryClient();
	const [message, setMessage] = useState("");

	const { data } = useSuspenseQuery({
		...queryOptionsConfig.groupChats.messages(groupId),
		queryFn: () => fetchApi<{ success: true; data: GroupChatDetail }>(`/api/chats/groups/${groupId}/messages`),
	});

	const sendMutation = useMutation({
		mutationFn: (content: string) =>
			fetchApi(`/api/chats/groups/${groupId}/send`, {
				method: "POST",
				body: JSON.stringify({ content }),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.groupChats.all });
			setMessage("");
		},
	});

	const detail = data.data;

	const handleSend = () => {
		const trimmed = message.trim();
		if (trimmed) {
			sendMutation.mutate(trimmed);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	return (
		<>
			<GroupChatThreadHeader group={detail} />
			<GroupMessageList messages={detail.messages} />
			<MessageInput
				value={message}
				onChange={setMessage}
				onSend={handleSend}
				onKeyDown={handleKeyDown}
				isSending={sendMutation.isPending}
			/>
		</>
	);
}

// ---------------------------------------------------------------------------
// Presentation: Group chat thread header
// ---------------------------------------------------------------------------
function GroupChatThreadHeader({ group }: { group: GroupChatDetail }) {
	const sourceLabel = group.sourceType === "group" ? "グループ" : "ルーム";
	return (
		<div
			className={css({
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				borderBottomWidth: "1px",
				borderColor: "gray.200",
				px: "4",
				py: "4",
				flexShrink: "0",
			})}
		>
			<div className={css({ display: "flex", alignItems: "center", gap: "3" })}>
				<GroupAvatar src={group.groupPictureUrl} name={group.groupName} />
				<div>
					<span className={css({ fontSize: "sm", fontWeight: "medium", color: "gray.900" })}>{group.groupName}</span>
					<p className={css({ fontSize: "xs", color: "gray.500", mt: "0.5" })}>
						{sourceLabel} / {group.memberCount}人
					</p>
				</div>
			</div>
			{STATUS_STYLES[group.status] && (
				<span
					className={css({
						borderRadius: "full",
						px: "2",
						py: "0.5",
						fontSize: "xs",
						fontWeight: "medium",
						bg: STATUS_STYLES[group.status].bg,
						color: STATUS_STYLES[group.status].color,
					})}
				>
					{STATUS_STYLES[group.status].label}
				</span>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Presentation: Group message list (shows sender info per message)
// ---------------------------------------------------------------------------
function GroupMessageList({ messages }: { messages: GroupChatMessage[] }) {
	if (messages.length === 0) {
		return (
			<div
				className={css({
					flex: "1",
					overflowY: "auto",
					p: "4",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				})}
				style={{ backgroundColor: "#7494C0" }}
			>
				<p className={css({ textAlign: "center", fontSize: "sm", color: "white/50" })}>メッセージはまだありません。</p>
			</div>
		);
	}

	return (
		<div
			className={css({ flex: "1", overflowY: "auto", p: "4", display: "flex", flexDirection: "column", gap: "3" })}
			style={{ backgroundColor: "#7494C0" }}
		>
			{messages.map((msg) => (
				<GroupMessageBubble key={msg.id} message={msg} />
			))}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Presentation: Group message bubble with sender avatar and name
// ---------------------------------------------------------------------------
function GroupMessageBubble({ message }: { message: GroupChatMessage }) {
	const isOutgoing = message.direction === "outgoing";
	return (
		<div className={css({ display: "flex", justifyContent: isOutgoing ? "flex-end" : "flex-start" })}>
			{!isOutgoing && (
				<div
					className={css({ display: "flex", flexDirection: "column", alignItems: "center", mr: "2", flexShrink: "0" })}
				>
					<GroupAvatar src={message.senderPictureUrl} name={message.senderName} size="sm" />
				</div>
			)}
			<div className={css({ maxW: "70%", display: "flex", flexDirection: "column" })}>
				{!isOutgoing && message.senderName && (
					<span className={css({ fontSize: "xs", color: "white/70", mb: "1" })}>{message.senderName}</span>
				)}
				<div
					className={css({
						borderRadius: "2xl",
						px: "3",
						py: "2",
						fontSize: "sm",
						bg: isOutgoing ? "line.green" : "white",
						color: isOutgoing ? "white" : "gray.900",
					})}
				>
					{message.content}
				</div>
				<span
					className={css({ fontSize: "xs", color: "white/50", mt: "0.5", textAlign: isOutgoing ? "right" : "left" })}
				>
					{new Date(message.createdAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
				</span>
			</div>
		</div>
	);
}

// ===========================================================================
// Shared Presentation Components
// ===========================================================================

// ---------------------------------------------------------------------------
// Group avatar with fallback
// ---------------------------------------------------------------------------
function GroupAvatar({ src, name, size = "md" }: { src: string | null; name: string | null; size?: "sm" | "md" }) {
	const dimension = size === "sm" ? "6" : "10";
	const fontSize = size === "sm" ? "2xs" : "xs";

	if (src) {
		return (
			<img
				src={src}
				alt={name ?? ""}
				className={css({ h: dimension, w: dimension, borderRadius: "full", objectFit: "cover" })}
			/>
		);
	}

	return (
		<div
			className={css({
				display: "flex",
				h: dimension,
				w: dimension,
				alignItems: "center",
				justifyContent: "center",
				borderRadius: "full",
				bg: "gray.300",
				fontSize,
				color: "white",
				fontWeight: "medium",
				flexShrink: "0",
			})}
		>
			{name?.charAt(0) ?? "G"}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Shared message list for direct chats
// ---------------------------------------------------------------------------
function MessageList({ messages, emptyMessage }: { messages: ChatMessage[]; emptyMessage: string }) {
	return (
		<div
			className={css({ flex: "1", overflowY: "auto", p: "4", display: "flex", flexDirection: "column", gap: "2" })}
			style={{ backgroundColor: "#7494C0" }}
		>
			{messages.length > 0 ? (
				messages.map((msg) => (
					<div
						key={msg.id}
						className={css({
							display: "flex",
							justifyContent: msg.direction === "outgoing" ? "flex-end" : "flex-start",
						})}
					>
						<div
							className={css({
								maxW: "70%",
								borderRadius: "2xl",
								px: "3",
								py: "2",
								fontSize: "sm",
								bg: msg.direction === "outgoing" ? "line.green" : "white",
								color: msg.direction === "outgoing" ? "white" : "gray.900",
							})}
						>
							{msg.content}
						</div>
					</div>
				))
			) : (
				<p className={css({ textAlign: "center", fontSize: "sm", color: "white/50" })}>{emptyMessage}</p>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Shared message input bar
// ---------------------------------------------------------------------------
function MessageInput({
	value,
	onChange,
	onSend,
	onKeyDown,
	isSending,
}: {
	value: string;
	onChange: (value: string) => void;
	onSend: () => void;
	onKeyDown: (e: React.KeyboardEvent) => void;
	isSending: boolean;
}) {
	const isDisabled = !value.trim() || isSending;

	return (
		<div
			className={css({
				display: "flex",
				gap: "2",
				borderTopWidth: "1px",
				borderColor: "gray.200",
				px: "4",
				py: "3",
				flexShrink: "0",
			})}
		>
			<input
				type="text"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onKeyDown={onKeyDown}
				placeholder="メッセージを入力"
				className={css({
					flex: "1",
					borderRadius: "lg",
					borderWidth: "1px",
					borderColor: "gray.300",
					px: "3",
					py: "2",
					fontSize: "sm",
				})}
			/>
			<button
				type="button"
				onClick={onSend}
				disabled={isDisabled}
				className={css({
					borderRadius: "lg",
					bg: "line.green",
					px: "4",
					py: "2",
					fontSize: "sm",
					fontWeight: "medium",
					color: "white",
					cursor: isDisabled ? "not-allowed" : "pointer",
					_disabled: { opacity: "0.5" },
				})}
			>
				{isSending ? "送信中..." : "送信"}
			</button>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Status action button (used in thread headers)
// ---------------------------------------------------------------------------
function StatusActionButton({
	label,
	bgColor,
	textColor,
	onClick,
}: {
	label: string;
	bgColor: string;
	textColor: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={css({
				borderRadius: "sm",
				px: "2",
				py: "1",
				fontSize: "xs",
				cursor: "pointer",
				bg: bgColor,
				color: textColor,
			})}
		>
			{label}
		</button>
	);
}

// ---------------------------------------------------------------------------
// Empty state placeholders
// ---------------------------------------------------------------------------
function EmptyThreadPlaceholder({ message }: { message: string }) {
	return (
		<div
			className={css({
				display: "flex",
				flex: "1",
				alignItems: "center",
				justifyContent: "center",
				fontSize: "sm",
				color: "gray.400",
			})}
		>
			{message}
		</div>
	);
}

function EmptyListMessage({ message }: { message: string }) {
	return (
		<div
			className={css({
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				py: "12",
				px: "4",
				fontSize: "sm",
				color: "gray.400",
			})}
		>
			{message}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Skeleton loaders
// ---------------------------------------------------------------------------
function ChatListSkeleton() {
	return (
		<div className={css({ display: "flex", flex: "1", overflow: "hidden" })}>
			<div
				className={css({
					w: { base: "full", lg: "80" },
					flexShrink: "0",
					borderRightWidth: "1px",
					borderColor: "gray.200",
				})}
			>
				<div className={css({ display: "flex", borderBottomWidth: "1px", borderColor: "gray.200" })}>
					{Array.from({ length: 4 }).map((_, i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: static list with no stable id
							key={i}
							className={css({ flex: "1", h: "10", animation: "pulse", bg: "gray.100", m: "1", borderRadius: "md" })}
						/>
					))}
				</div>
				<ChatListItemsSkeleton />
			</div>
			<div
				className={css({
					display: { base: "none", lg: "flex" },
					flex: "1",
					alignItems: "center",
					justifyContent: "center",
				})}
			>
				<div className={css({ h: "4", w: "48", animation: "pulse", borderRadius: "md", bg: "gray.200" })} />
			</div>
		</div>
	);
}

function ChatListItemsSkeleton() {
	return (
		<div className={css({ display: "flex", flexDirection: "column" })}>
			{Array.from({ length: 8 }).map((_, i) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: static list with no stable id
					key={i}
					className={css({
						display: "flex",
						alignItems: "center",
						gap: "3",
						px: "4",
						py: "3",
						borderBottomWidth: "1px",
						borderColor: "gray.100",
					})}
				>
					<div
						className={css({
							h: "10",
							w: "10",
							borderRadius: "full",
							bg: "gray.200",
							animation: "pulse",
							flexShrink: "0",
						})}
					/>
					<div className={css({ flex: "1", display: "flex", flexDirection: "column", gap: "1.5" })}>
						<div className={css({ h: "3.5", w: "32", borderRadius: "md", bg: "gray.200", animation: "pulse" })} />
						<div className={css({ h: "3", w: "24", borderRadius: "md", bg: "gray.100", animation: "pulse" })} />
					</div>
				</div>
			))}
		</div>
	);
}

function MessageThreadSkeleton() {
	return (
		<div className={css({ display: "flex", flex: "1", flexDirection: "column" })}>
			<div
				className={css({
					display: "flex",
					alignItems: "center",
					gap: "3",
					borderBottomWidth: "1px",
					borderColor: "gray.200",
					px: "4",
					py: "4",
				})}
			>
				<div className={css({ h: "10", w: "10", borderRadius: "full", bg: "gray.200", animation: "pulse" })} />
				<div className={css({ display: "flex", flexDirection: "column", gap: "1.5" })}>
					<div className={css({ h: "4", w: "28", borderRadius: "md", bg: "gray.200", animation: "pulse" })} />
					<div className={css({ h: "3", w: "20", borderRadius: "md", bg: "gray.100", animation: "pulse" })} />
				</div>
			</div>
			<div
				className={css({ flex: "1", p: "4", display: "flex", flexDirection: "column", gap: "3" })}
				style={{ backgroundColor: "#7494C0" }}
			>
				{Array.from({ length: 5 }).map((_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: static list with no stable id
					<div key={i} className={css({ display: "flex", justifyContent: i % 2 === 0 ? "flex-start" : "flex-end" })}>
						<div className={css({ h: "10", w: "48", borderRadius: "2xl", bg: "white/30", animation: "pulse" })} />
					</div>
				))}
			</div>
			<div
				className={css({ display: "flex", gap: "2", borderTopWidth: "1px", borderColor: "gray.200", px: "4", py: "3" })}
			>
				<div className={css({ flex: "1", h: "10", borderRadius: "lg", bg: "gray.200", animation: "pulse" })} />
				<div className={css({ h: "10", w: "16", borderRadius: "lg", bg: "gray.200", animation: "pulse" })} />
			</div>
		</div>
	);
}
