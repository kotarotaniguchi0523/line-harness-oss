import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { css } from "../../../styled-system/css";
import { notificationsQueryOptions } from "../../lib/query-config";
import { fetchApi } from "../../lib/rpc";

interface NotificationRuleCreateData {
	name: string;
	eventType: string;
	channels: string[];
}

export const Route = createFileRoute("/_authed/notifications")({ component: NotificationsPage });

const statusBadgeStyles: Record<string, { bg: string; color: string }> = {
	pending: { bg: "gray.100", color: "gray.600" },
	sent: { bg: "green.100", color: "green.700" },
	failed: { bg: "red.100", color: "red.700" },
};

function NotificationsPage() {
	const queryClient = useQueryClient();
	const [showCreate, setShowCreate] = useState(false);
	const [form, setForm] = useState({ name: "", eventType: "", channels: "webhook", conditions: "{}" });
	const [statusFilter, setStatusFilter] = useState("");

	const rules = useQuery(notificationsQueryOptions.rules());
	const notifications = useQuery(notificationsQueryOptions.list(statusFilter ? { status: statusFilter } : undefined));
	const createMutation = useMutation({
		mutationFn: (data: NotificationRuleCreateData) =>
			fetchApi("/api/notifications/rules", { method: "POST", body: JSON.stringify(data) }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["notification-rules"] });
			setShowCreate(false);
		},
	});
	const deleteMutation = useMutation({
		mutationFn: (id: string) => fetchApi(`/api/notifications/rules/${id}`, { method: "DELETE" }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notification-rules"] }),
	});

	const inputStyle = css({
		w: "full",
		borderRadius: "lg",
		borderWidth: "1px",
		borderColor: "gray.300",
		px: "3",
		py: "2",
		fontSize: "sm",
	});
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
				<h1 className={css({ fontSize: "2xl", fontWeight: "bold", color: "gray.900" })}>通知</h1>
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
					})}
				>
					+ 新規ルール
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
						display: "flex",
						flexDirection: "column",
						gap: "3",
					})}
				>
					<input
						type="text"
						value={form.name}
						onChange={(e) => setForm({ ...form, name: e.target.value })}
						placeholder="ルール名"
						className={inputStyle}
					/>
					<input
						type="text"
						value={form.eventType}
						onChange={(e) => setForm({ ...form, eventType: e.target.value })}
						placeholder="イベントタイプ"
						className={inputStyle}
					/>
					<input
						type="text"
						value={form.channels}
						onChange={(e) => setForm({ ...form, channels: e.target.value })}
						placeholder="チャンネル (カンマ区切り)"
						className={inputStyle}
					/>
					<div className={css({ display: "flex", gap: "2" })}>
						<button
							type="button"
							onClick={() =>
								form.name &&
								form.eventType &&
								createMutation.mutate({
									name: form.name,
									eventType: form.eventType,
									channels: form.channels.split(",").map((s: string) => s.trim()),
								})
							}
							className={css({
								borderRadius: "lg",
								bg: "line.green",
								px: "4",
								py: "2",
								fontSize: "sm",
								fontWeight: "medium",
								color: "white",
							})}
						>
							作成
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
			<div className={css({ mb: "8" })}>
				<h2 className={css({ mb: "4", fontSize: "lg", fontWeight: "semibold", color: "gray.900" })}>通知ルール</h2>
				<div className={css({ display: "grid", gridTemplateColumns: { base: "1", md: "2", xl: "3" }, gap: "4" })}>
					{(rules.data?.data ?? []).map((r) => (
						<div
							key={r.id}
							className={css({
								borderRadius: "lg",
								borderWidth: "1px",
								borderColor: "gray.200",
								bg: "white",
								p: "4",
								shadow: "sm",
							})}
						>
							<div className={css({ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "2" })}>
								<h3 className={css({ fontSize: "sm", fontWeight: "semibold", color: "gray.900" })}>{r.name}</h3>
								<span
									className={css({
										borderRadius: "full",
										px: "2",
										py: "0.5",
										fontSize: "xs",
										bg: r.isActive ? "green.100" : "gray.100",
										color: r.isActive ? "green.700" : "gray.600",
									})}
								>
									{r.isActive ? "有効" : "無効"}
								</span>
							</div>
							<p className={css({ fontSize: "xs", color: "gray.500" })}>{r.eventType}</p>
							<button
								type="button"
								onClick={() => deleteMutation.mutate(r.id)}
								className={css({ mt: "2", fontSize: "xs", color: "red.500" })}
							>
								削除
							</button>
						</div>
					))}
				</div>
			</div>
			<div>
				<div className={css({ mb: "4", display: "flex", alignItems: "center", justifyContent: "space-between" })}>
					<h2 className={css({ fontSize: "lg", fontWeight: "semibold", color: "gray.900" })}>通知履歴</h2>
					<select
						value={statusFilter}
						onChange={(e) => setStatusFilter(e.target.value)}
						className={css({
							borderRadius: "lg",
							borderWidth: "1px",
							borderColor: "gray.300",
							px: "3",
							py: "2",
							fontSize: "sm",
							bg: "white",
						})}
					>
						<option value="">すべて</option>
						<option value="pending">pending</option>
						<option value="sent">sent</option>
						<option value="failed">failed</option>
					</select>
				</div>
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
								<th className={thStyle}>イベント</th>
								<th className={thStyle}>チャンネル</th>
								<th className={thStyle}>ステータス</th>
								<th className={thStyle}>日時</th>
							</tr>
						</thead>
						<tbody className={css({ divideY: "1px", divideColor: "gray.100" })}>
							{(notifications.data?.data ?? []).map((n) => {
								const badge = statusBadgeStyles[n.status];
								return (
									<tr key={n.id} className={css({ _hover: { bg: "gray.50" } })}>
										<td className={css({ px: "4", py: "3", fontSize: "sm" })}>{n.title}</td>
										<td className={css({ px: "4", py: "3", fontSize: "xs" })}>{n.eventType}</td>
										<td className={css({ px: "4", py: "3", fontSize: "xs" })}>{n.channel}</td>
										<td className={css({ px: "4", py: "3" })}>
											<span
												className={css({
													borderRadius: "full",
													px: "2",
													py: "0.5",
													fontSize: "xs",
													bg: badge?.bg ?? "gray.100",
													color: badge?.color ?? "gray.600",
												})}
											>
												{n.status}
											</span>
										</td>
										<td className={css({ px: "4", py: "3", fontSize: "xs", color: "gray.500" })}>
											{new Date(n.createdAt).toLocaleString("ja-JP")}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
