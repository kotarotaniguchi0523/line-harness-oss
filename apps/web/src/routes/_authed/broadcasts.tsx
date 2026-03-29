import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { css } from "../../../styled-system/css";
import { fetchApi } from "../../lib/rpc";

export const Route = createFileRoute("/_authed/broadcasts")({
	component: BroadcastsPage,
});

const statusStyles: Record<string, { label: string; bg: string; color: string }> = {
	draft: { label: "下書き", bg: "gray.100", color: "gray.600" },
	scheduled: { label: "予約済み", bg: "blue.100", color: "blue.700" },
	sending: { label: "送信中", bg: "yellow.100", color: "yellow.700" },
	sent: { label: "送信完了", bg: "green.100", color: "green.700" },
};

function BroadcastsPage() {
	const queryClient = useQueryClient();
	const [showCreate, setShowCreate] = useState(false);
	const [form, setForm] = useState({
		title: "",
		messageType: "text",
		messageContent: "",
		targetType: "all",
		targetTagId: "",
		scheduledAt: "",
		sendNow: true,
	});

	const broadcasts = useQuery({
		queryKey: ["broadcasts"],
		queryFn: () => fetchApi<{ success: true; data: Broadcast[] }>("/api/broadcasts"),
	});
	const tags = useQuery({
		queryKey: ["tags"],
		queryFn: () => fetchApi<{ success: true; data: { id: string; name: string }[] }>("/api/tags"),
	});

	const createMutation = useMutation({
		mutationFn: (data: BroadcastCreateData) =>
			fetchApi("/api/broadcasts", { method: "POST", body: JSON.stringify(data) }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["broadcasts"] });
			setShowCreate(false);
		},
	});

	const sendMutation = useMutation({
		mutationFn: (id: string) => fetchApi(`/api/broadcasts/${id}/send`, { method: "POST" }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["broadcasts"] }),
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => fetchApi(`/api/broadcasts/${id}`, { method: "DELETE" }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["broadcasts"] }),
	});

	const list = broadcasts.data?.data ?? [];
	const tagList = tags.data?.data ?? [];

	const inputStyle = css({
		w: "full",
		borderRadius: "lg",
		borderWidth: "1px",
		borderColor: "gray.300",
		px: "3",
		py: "2",
		fontSize: "sm",
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
	const labelStyle = css({ mb: "1", display: "block", fontSize: "sm", fontWeight: "medium", color: "gray.700" });
	const thStyle = css({
		px: "4",
		py: "3",
		textAlign: "left",
		fontSize: "xs",
		fontWeight: "medium",
		textTransform: "uppercase",
		color: "gray.500",
	});

	return (
		<div>
			<div className={css({ mb: "6", display: "flex", alignItems: "center", justifyContent: "space-between" })}>
				<h1 className={css({ fontSize: "2xl", fontWeight: "bold", color: "gray.900" })}>一斉配信</h1>
				<button
					type="button"
					onClick={() => setShowCreate(!showCreate)}
					className={css({
						borderRadius: "lg",
						bg: "line.green",
						px: "4",
						py: "2",
						fontSize: "sm",
						fontWeight: "medium",
						color: "white",
						_hover: { opacity: "0.9" },
					})}
				>
					+ 新規配信
				</button>
			</div>

			{showCreate && (
				<div
					className={css({
						mb: "6",
						borderRadius: "lg",
						borderWidth: "1px",
						borderColor: "gray.200",
						bg: "white",
						p: "6",
						shadow: "sm",
					})}
				>
					<div className={css({ display: "grid", gap: "3", gridTemplateColumns: { base: "1", sm: "2" } })}>
						<div>
							<label className={labelStyle}>
								配信タイトル <span className={css({ color: "red.500" })}>*</span>
								<input
									type="text"
									value={form.title}
									onChange={(e) => setForm({ ...form, title: e.target.value })}
									className={inputStyle}
								/>
							</label>
						</div>
						<div>
							<label className={labelStyle}>
								メッセージ種別
								<select
									value={form.messageType}
									onChange={(e) => setForm({ ...form, messageType: e.target.value })}
									className={selectStyle}
								>
									<option value="text">テキスト</option>
									<option value="image">画像</option>
									<option value="flex">Flex</option>
								</select>
							</label>
						</div>
						<div>
							<label className={labelStyle}>
								配信対象
								<select
									value={form.targetType}
									onChange={(e) => setForm({ ...form, targetType: e.target.value })}
									className={selectStyle}
								>
									<option value="all">全員</option>
									<option value="tag">タグ指定</option>
								</select>
							</label>
						</div>
						{form.targetType === "tag" && (
							<div>
								<label className={labelStyle}>
									対象タグ
									<select
										value={form.targetTagId}
										onChange={(e) => setForm({ ...form, targetTagId: e.target.value })}
										className={selectStyle}
									>
										<option value="">選択してください</option>
										{tagList.map((t) => (
											<option key={t.id} value={t.id}>
												{t.name}
											</option>
										))}
									</select>
								</label>
							</div>
						)}
					</div>
					<div className={css({ mt: "3" })}>
						<label className={labelStyle}>
							メッセージ内容 <span className={css({ color: "red.500" })}>*</span>
							<textarea
								value={form.messageContent}
								onChange={(e) => setForm({ ...form, messageContent: e.target.value })}
								rows={4}
								className={inputStyle}
							/>
						</label>
					</div>
					<div className={css({ mt: "3", display: "flex", gap: "2" })}>
						<button
							type="button"
							onClick={() => {
								if (form.title && form.messageContent)
									createMutation.mutate({
										title: form.title,
										messageType: form.messageType,
										messageContent: form.messageContent,
										targetType: form.targetType,
										targetTagId: form.targetType === "tag" ? form.targetTagId : undefined,
										scheduledAt: form.sendNow ? undefined : form.scheduledAt || undefined,
									});
							}}
							disabled={!(form.title && form.messageContent)}
							className={css({
								borderRadius: "lg",
								bg: "line.green",
								px: "4",
								py: "2",
								fontSize: "sm",
								fontWeight: "medium",
								color: "white",
								_disabled: { opacity: "0.5" },
							})}
						>
							{createMutation.isPending ? "作成中..." : "作成"}
						</button>
						<button
							type="button"
							onClick={() => setShowCreate(false)}
							className={css({
								borderRadius: "lg",
								bg: "gray.100",
								px: "4",
								py: "2",
								fontSize: "sm",
								color: "gray.600",
							})}
						>
							キャンセル
						</button>
					</div>
				</div>
			)}

			{broadcasts.isLoading ? (
				<div className={css({ display: "flex", flexDirection: "column", gap: "2" })}>
					{Array.from({ length: 4 }).map((_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static list with no stable id
						<div key={i} className={css({ h: "12", animation: "pulse", borderRadius: "md", bg: "gray.200" })} />
					))}
				</div>
			) : list.length > 0 ? (
				<div
					className={css({
						overflowX: "auto",
						borderRadius: "lg",
						borderWidth: "1px",
						borderColor: "gray.200",
						bg: "white",
						shadow: "sm",
					})}
				>
					<table className={css({ minW: "full", divideY: "1px", divideColor: "gray.200" })}>
						<thead className={css({ bg: "gray.50" })}>
							<tr>
								<th className={thStyle}>タイトル</th>
								<th className={thStyle}>ステータス</th>
								<th className={thStyle}>対象</th>
								<th className={thStyle}>実績</th>
								<th className={thStyle}>操作</th>
							</tr>
						</thead>
						<tbody className={css({ divideY: "1px", divideColor: "gray.100" })}>
							{list.map((b) => {
								const status = statusStyles[b.status];
								return (
									<tr key={b.id} className={css({ _hover: { bg: "gray.50" } })}>
										<td className={css({ px: "4", py: "3", fontSize: "sm", fontWeight: "medium", color: "gray.900" })}>
											{b.title}
										</td>
										<td className={css({ px: "4", py: "3" })}>
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
												{status?.label ?? b.status}
											</span>
										</td>
										<td className={css({ px: "4", py: "3", fontSize: "sm", color: "gray.600" })}>
											{b.targetType === "all" ? "全員" : `タグ: ${b.targetTagId}`}
										</td>
										<td className={css({ px: "4", py: "3", fontSize: "sm", color: "gray.600" })}>
											{b.status === "sent" ? `${b.successCount} / ${b.totalCount} 件` : "—"}
										</td>
										<td className={css({ px: "4", py: "3", display: "flex", gap: "2" })}>
											{b.status === "draft" && (
												<button
													type="button"
													onClick={() => sendMutation.mutate(b.id)}
													className={css({ fontSize: "xs", color: "green.600", _hover: { color: "green.800" } })}
												>
													今すぐ送信
												</button>
											)}
											{(b.status === "draft" || b.status === "scheduled") && (
												<button
													type="button"
													onClick={() => deleteMutation.mutate(b.id)}
													className={css({ fontSize: "xs", color: "red.500", _hover: { color: "red.700" } })}
												>
													削除
												</button>
											)}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			) : (
				<div
					className={css({
						borderRadius: "lg",
						borderWidth: "1px",
						borderColor: "gray.200",
						bg: "white",
						p: "8",
						textAlign: "center",
						fontSize: "sm",
						color: "gray.500",
					})}
				>
					配信がありません。「新規配信」から作成してください。
				</div>
			)}
		</div>
	);
}

interface Broadcast {
	id: string;
	title: string;
	messageType: string;
	messageContent: string;
	targetType: string;
	targetTagId: string | null;
	status: string;
	scheduledAt: string | null;
	sentAt: string | null;
	totalCount: number;
	successCount: number;
	createdAt: string;
}

interface BroadcastCreateData {
	title: string;
	messageType: string;
	messageContent: string;
	targetType: string;
	targetTagId?: string;
	scheduledAt?: string;
}
