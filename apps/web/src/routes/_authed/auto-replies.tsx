import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { css } from "../../../styled-system/css";
import { autoRepliesQueryOptions } from "../../lib/query-config";
import { fetchApi } from "../../lib/rpc";

export const Route = createFileRoute("/_authed/auto-replies")({ component: AutoRepliesPage });

// ---------------------------------------------------------------------------
// Constants (mirrors DOMAIN_LIMITS.maxAutoReplyMessages from contracts)
// ---------------------------------------------------------------------------
const MAX_MESSAGES = 5;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface AutoReplyMessage {
	id: string;
	autoReplyId: string;
	messageOrder: number;
	messageType: string;
	messageContent: string;
}

interface AutoReply {
	id: string;
	keyword: string;
	matchType: string;
	isActive: boolean;
	priority: number;
	lineAccountId: string | null;
	createdAt: string;
	messages: AutoReplyMessage[];
}

interface MessageInput {
	messageType: string;
	messageContent: string;
}

// ---------------------------------------------------------------------------
// Match type labels
// ---------------------------------------------------------------------------
const matchTypeLabels: Record<string, string> = {
	exact: "完全一致",
	contains: "部分一致",
};

const messageTypeLabels: Record<string, string> = {
	text: "テキスト",
	flex: "Flex",
	image: "画像",
	video: "動画",
	carousel: "カルーセル",
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const pageContainer = css({ maxW: "6xl", mx: "auto" });

const headerStyle = css({
	mb: "6",
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
});

const titleStyle = css({
	fontSize: "2xl",
	fontWeight: "bold",
	color: "gray.900",
});

const primaryBtnStyle = css({
	borderRadius: "lg",
	bg: "line.green",
	px: "4",
	py: "2",
	fontSize: "sm",
	fontWeight: "medium",
	color: "white",
	cursor: "pointer",
	_hover: { opacity: "0.9" },
	_disabled: { opacity: "0.5", cursor: "not-allowed" },
});

const secondaryBtnStyle = css({
	borderRadius: "lg",
	bg: "gray.100",
	px: "4",
	py: "2",
	fontSize: "sm",
	color: "gray.600",
	cursor: "pointer",
	_hover: { bg: "gray.200" },
});

const inputStyle = css({
	w: "full",
	borderRadius: "lg",
	borderWidth: "1px",
	borderColor: "gray.300",
	px: "3",
	py: "2",
	fontSize: "sm",
	_focus: { borderColor: "blue.400", outline: "none" },
});

const selectStyle = css({
	w: "full",
	borderRadius: "lg",
	borderWidth: "1px",
	borderColor: "gray.300",
	px: "3",
	py: "2",
	fontSize: "sm",
	bg: "white",
});

const cardStyle = css({
	borderRadius: "lg",
	borderWidth: "1px",
	borderColor: "gray.200",
	bg: "white",
	p: "4",
	shadow: "sm",
});

const formCardStyle = css({
	mb: "6",
	borderRadius: "lg",
	borderWidth: "1px",
	borderColor: "gray.200",
	bg: "white",
	p: "6",
	shadow: "sm",
	display: "flex",
	flexDirection: "column",
	gap: "4",
});

const messageItemStyle = css({
	display: "flex",
	gap: "2",
	alignItems: "flex-start",
	p: "3",
	borderRadius: "md",
	bg: "gray.50",
	borderWidth: "1px",
	borderColor: "gray.200",
});

const badgeStyle = (active: boolean) =>
	css({
		borderRadius: "full",
		px: "2",
		py: "0.5",
		fontSize: "xs",
		fontWeight: "medium",
		cursor: "pointer",
		bg: active ? "green.100" : "gray.100",
		color: active ? "green.700" : "gray.600",
	});

const deleteBtnStyle = css({
	fontSize: "xs",
	color: "red.500",
	cursor: "pointer",
	_hover: { color: "red.700" },
});

const emptyState = css({
	textAlign: "center",
	py: "12",
	color: "gray.400",
	fontSize: "sm",
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
function AutoRepliesPage() {
	const queryClient = useQueryClient();
	const [showCreate, setShowCreate] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [form, setForm] = useState({
		keyword: "",
		matchType: "exact" as string,
		priority: 0,
		messages: [{ messageType: "text", messageContent: "" }] as MessageInput[],
	});

	// ---------------------------------------------------------------------------
	// Queries & Mutations
	// ---------------------------------------------------------------------------
	const autoReplies = useQuery(autoRepliesQueryOptions.list());

	const createMutation = useMutation({
		mutationFn: (data: { keyword: string; matchType: string; priority: number; messages: MessageInput[] }) =>
			fetchApi("/api/auto-replies", { method: "POST", body: JSON.stringify(data) }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["auto-replies"] });
			resetForm();
		},
	});

	const updateMutation = useMutation({
		mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
			fetchApi(`/api/auto-replies/${id}`, { method: "PUT", body: JSON.stringify(data) }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["auto-replies"] });
			resetForm();
		},
	});

	const toggleMutation = useMutation({
		mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
			fetchApi(`/api/auto-replies/${id}`, {
				method: "PUT",
				body: JSON.stringify({ isActive }),
			}),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auto-replies"] }),
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => fetchApi(`/api/auto-replies/${id}`, { method: "DELETE" }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auto-replies"] }),
	});

	// ---------------------------------------------------------------------------
	// Form helpers
	// ---------------------------------------------------------------------------
	function resetForm() {
		setShowCreate(false);
		setEditingId(null);
		setForm({
			keyword: "",
			matchType: "exact",
			priority: 0,
			messages: [{ messageType: "text", messageContent: "" }],
		});
	}

	function startEdit(reply: AutoReply) {
		setEditingId(reply.id);
		setShowCreate(true);
		setForm({
			keyword: reply.keyword,
			matchType: reply.matchType,
			priority: reply.priority,
			messages:
				reply.messages.length > 0
					? reply.messages.map((m) => ({
							messageType: m.messageType,
							messageContent: m.messageContent,
						}))
					: [{ messageType: "text", messageContent: "" }],
		});
	}

	function addMessage() {
		if (form.messages.length >= MAX_MESSAGES) return;
		setForm({
			...form,
			messages: [...form.messages, { messageType: "text", messageContent: "" }],
		});
	}

	function removeMessage(index: number) {
		if (form.messages.length <= 1) return;
		setForm({
			...form,
			messages: form.messages.filter((_, i) => i !== index),
		});
	}

	function updateMessage(index: number, field: keyof MessageInput, value: string) {
		const updated = [...form.messages];
		updated[index] = { ...updated[index], [field]: value };
		setForm({ ...form, messages: updated });
	}

	function handleSubmit() {
		const hasEmptyContent = form.messages.some((m) => !m.messageContent.trim());
		if (!form.keyword.trim() || hasEmptyContent) return;

		if (editingId) {
			updateMutation.mutate({
				id: editingId,
				data: {
					keyword: form.keyword,
					matchType: form.matchType,
					priority: form.priority,
					messages: form.messages,
				},
			});
		} else {
			createMutation.mutate({
				keyword: form.keyword,
				matchType: form.matchType,
				priority: form.priority,
				messages: form.messages,
			});
		}
	}

	const list = autoReplies.data?.data ?? [];
	const isSubmitting = createMutation.isPending || updateMutation.isPending;

	// ---------------------------------------------------------------------------
	// Render
	// ---------------------------------------------------------------------------
	return (
		<div className={pageContainer}>
			{/* Header */}
			<div className={headerStyle}>
				<div>
					<h1 className={titleStyle}>自動応答</h1>
					<p className={css({ fontSize: "sm", color: "gray.500", mt: "1" })}>
						キーワードに応じて最大{MAX_MESSAGES}メッセージまで自動返信
					</p>
				</div>
				<button
					type="button"
					onClick={() => (showCreate ? resetForm() : setShowCreate(true))}
					className={primaryBtnStyle}
				>
					{showCreate ? "閉じる" : "+ 新規ルール"}
				</button>
			</div>

			{/* Create / Edit form */}
			{showCreate && (
				<div className={formCardStyle}>
					<h2 className={css({ fontSize: "lg", fontWeight: "semibold", color: "gray.800" })}>
						{editingId ? "ルールを編集" : "新規ルール作成"}
					</h2>

					{/* Keyword + match type row */}
					<div className={css({ display: "flex", gap: "3", flexWrap: "wrap" })}>
						<div className={css({ flex: "1", minW: "200px" })}>
							<label
								className={css({ fontSize: "xs", fontWeight: "medium", color: "gray.600", mb: "1", display: "block" })}
							>
								キーワード
								<input
									type="text"
									value={form.keyword}
									onChange={(e) => setForm({ ...form, keyword: e.target.value })}
									placeholder="例: 料金"
									className={inputStyle}
								/>
							</label>
						</div>
						<div className={css({ w: "140px" })}>
							<label
								className={css({ fontSize: "xs", fontWeight: "medium", color: "gray.600", mb: "1", display: "block" })}
							>
								マッチ方式
								<select
									value={form.matchType}
									onChange={(e) => setForm({ ...form, matchType: e.target.value })}
									className={selectStyle}
								>
									<option value="exact">完全一致</option>
									<option value="contains">部分一致</option>
								</select>
							</label>
						</div>
						<div className={css({ w: "100px" })}>
							<label
								className={css({ fontSize: "xs", fontWeight: "medium", color: "gray.600", mb: "1", display: "block" })}
							>
								優先度
								<input
									type="number"
									value={form.priority}
									onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
									className={inputStyle}
								/>
							</label>
						</div>
					</div>

					{/* Messages section */}
					<div>
						<div className={css({ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "2" })}>
							<span className={css({ fontSize: "sm", fontWeight: "medium", color: "gray.700" })}>
								返信メッセージ ({form.messages.length}/{MAX_MESSAGES})
							</span>
							<button
								type="button"
								onClick={addMessage}
								disabled={form.messages.length >= MAX_MESSAGES}
								className={css({
									fontSize: "xs",
									color: form.messages.length >= MAX_MESSAGES ? "gray.400" : "blue.600",
									cursor: form.messages.length >= MAX_MESSAGES ? "not-allowed" : "pointer",
									fontWeight: "medium",
									_hover: form.messages.length < MAX_MESSAGES ? { color: "blue.800" } : {},
								})}
							>
								+ メッセージ追加
							</button>
						</div>

						<div className={css({ display: "flex", flexDirection: "column", gap: "2" })}>
							{form.messages.map((msg, idx) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: static list with no stable id
								<div key={idx} className={messageItemStyle}>
									<span
										className={css({ fontSize: "xs", color: "gray.500", fontWeight: "bold", mt: "2", minW: "20px" })}
									>
										{idx + 1}
									</span>
									<div className={css({ flex: "1", display: "flex", flexDirection: "column", gap: "2" })}>
										<select
											value={msg.messageType}
											onChange={(e) => updateMessage(idx, "messageType", e.target.value)}
											className={css({
												w: "140px",
												borderRadius: "md",
												borderWidth: "1px",
												borderColor: "gray.300",
												px: "2",
												py: "1",
												fontSize: "xs",
												bg: "white",
											})}
										>
											{Object.entries(messageTypeLabels).map(([v, l]) => (
												<option key={v} value={v}>
													{l}
												</option>
											))}
										</select>
										<textarea
											value={msg.messageContent}
											onChange={(e) => updateMessage(idx, "messageContent", e.target.value)}
											placeholder={msg.messageType === "flex" ? "Flex JSON" : "メッセージ本文"}
											rows={msg.messageType === "flex" ? 4 : 2}
											className={css({
												w: "full",
												borderRadius: "md",
												borderWidth: "1px",
												borderColor: "gray.300",
												px: "3",
												py: "2",
												fontSize: "sm",
												resize: "vertical",
												fontFamily: msg.messageType === "flex" ? "mono" : "inherit",
											})}
										/>
									</div>
									{form.messages.length > 1 && (
										<button
											type="button"
											onClick={() => removeMessage(idx)}
											className={css({
												fontSize: "xs",
												color: "red.400",
												cursor: "pointer",
												mt: "2",
												_hover: { color: "red.600" },
											})}
										>
											削除
										</button>
									)}
								</div>
							))}
						</div>
					</div>

					{/* Action buttons */}
					<div className={css({ display: "flex", gap: "2" })}>
						<button type="button" onClick={handleSubmit} disabled={isSubmitting} className={primaryBtnStyle}>
							{editingId ? "更新" : "作成"}
						</button>
						<button type="button" onClick={resetForm} className={secondaryBtnStyle}>
							キャンセル
						</button>
					</div>
				</div>
			)}

			{/* List */}
			{list.length === 0 && !autoReplies.isLoading && (
				<div className={emptyState}>自動応答ルールがありません。「+ 新規ルール」から作成してください。</div>
			)}

			<div className={css({ display: "grid", gridTemplateColumns: { base: "1", md: "2", xl: "3" }, gap: "4" })}>
				{list.map((reply: AutoReply) => (
					<div key={reply.id} className={cardStyle}>
						{/* Card header */}
						<div className={css({ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "2" })}>
							<h3 className={css({ fontSize: "sm", fontWeight: "semibold", color: "gray.900" })}>
								「{reply.keyword}」
							</h3>
							<button
								type="button"
								onClick={() => toggleMutation.mutate({ id: reply.id, isActive: !reply.isActive })}
								className={badgeStyle(reply.isActive)}
							>
								{reply.isActive ? "有効" : "無効"}
							</button>
						</div>

						{/* Card metadata */}
						<div
							className={css({
								display: "flex",
								gap: "2",
								fontSize: "xs",
								color: "gray.400",
								mb: "2",
								flexWrap: "wrap",
							})}
						>
							<span className={css({ borderRadius: "sm", bg: "blue.50", px: "1.5", py: "0.5", color: "blue.600" })}>
								{matchTypeLabels[reply.matchType] ?? reply.matchType}
							</span>
							<span>優先度: {reply.priority}</span>
							<span>{reply.messages.length}メッセージ</span>
						</div>

						{/* Message previews */}
						<div className={css({ display: "flex", flexDirection: "column", gap: "1", mb: "3" })}>
							{reply.messages.slice(0, 3).map((msg, idx) => (
								<div
									key={msg.id}
									className={css({
										fontSize: "xs",
										color: "gray.600",
										bg: "gray.50",
										borderRadius: "md",
										px: "2",
										py: "1",
										lineClamp: "1",
										overflow: "hidden",
									})}
								>
									<span className={css({ color: "gray.400", mr: "1" })}>{idx + 1}.</span>
									<span className={css({ color: "gray.500", mr: "1" })}>
										[{messageTypeLabels[msg.messageType] ?? msg.messageType}]
									</span>
									{msg.messageContent.substring(0, 60)}
								</div>
							))}
							{reply.messages.length > 3 && (
								<span className={css({ fontSize: "xs", color: "gray.400" })}>
									...他 {reply.messages.length - 3} メッセージ
								</span>
							)}
						</div>

						{/* Card actions */}
						<div className={css({ display: "flex", gap: "3", alignItems: "center" })}>
							<button
								type="button"
								onClick={() => startEdit(reply)}
								className={css({ fontSize: "xs", color: "blue.600", cursor: "pointer", _hover: { color: "blue.800" } })}
							>
								編集
							</button>
							<button
								type="button"
								onClick={() => {
									if (confirm(`「${reply.keyword}」のルールを削除しますか？`)) {
										deleteMutation.mutate(reply.id);
									}
								}}
								className={deleteBtnStyle}
							>
								削除
							</button>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
