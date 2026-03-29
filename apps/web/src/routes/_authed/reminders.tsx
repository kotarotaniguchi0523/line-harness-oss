import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { css } from "../../../styled-system/css";
import { remindersQueryOptions } from "../../lib/query-config";
import { fetchApi } from "../../lib/rpc";

interface ReminderCreateData {
	name: string;
	description: string;
}

export const Route = createFileRoute("/_authed/reminders")({ component: RemindersPage });

function RemindersPage() {
	const queryClient = useQueryClient();
	const [showCreate, setShowCreate] = useState(false);
	const [form, setForm] = useState({ name: "", description: "" });
	const [expandedId, setExpandedId] = useState<string | null>(null);

	const reminders = useQuery(remindersQueryOptions.list());
	const reminderDetail = useQuery({
		...remindersQueryOptions.detail(expandedId ?? ""),
		enabled: !!expandedId,
	});
	const createMutation = useMutation({
		mutationFn: (data: ReminderCreateData) =>
			fetchApi("/api/reminders", { method: "POST", body: JSON.stringify(data) }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["reminders"] });
			setShowCreate(false);
		},
	});
	const deleteMutation = useMutation({
		mutationFn: (id: string) => fetchApi(`/api/reminders/${id}`, { method: "DELETE" }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reminders"] }),
	});
	const toggleMutation = useMutation({
		mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
			fetchApi(`/api/reminders/${id}`, { method: "PUT", body: JSON.stringify({ isActive }) }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reminders"] }),
	});

	const list = reminders.data?.data ?? [];
	const detail = reminderDetail.data?.data;

	function formatOffset(min: number): string {
		const abs = Math.abs(min);
		const prefix = min < 0 ? "-" : "+";
		if (abs < 60) return `${prefix}${abs}分`;
		if (abs < 1440) {
			const h = Math.floor(abs / 60);
			const m = abs % 60;
			return m === 0 ? `${prefix}${h}時間` : `${prefix}${h}時間${m}分`;
		}
		const d = Math.floor(abs / 1440);
		return `${prefix}${d}日`;
	}

	return (
		<div>
			<div className={css({ mb: "6", display: "flex", alignItems: "center", justifyContent: "space-between" })}>
				<h1 className={css({ fontSize: "2xl", fontWeight: "bold", color: "gray.900" })}>リマインダー</h1>
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
					+ 新規リマインダー
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
						placeholder="リマインダー名"
						className={css({
							w: "full",
							borderRadius: "lg",
							borderWidth: "1px",
							borderColor: "gray.300",
							px: "3",
							py: "2",
							fontSize: "sm",
						})}
					/>
					<textarea
						value={form.description}
						onChange={(e) => setForm({ ...form, description: e.target.value })}
						placeholder="説明 (省略可)"
						rows={2}
						className={css({
							w: "full",
							borderRadius: "lg",
							borderWidth: "1px",
							borderColor: "gray.300",
							px: "3",
							py: "2",
							fontSize: "sm",
							resize: "none",
						})}
					/>
					<div className={css({ display: "flex", gap: "2" })}>
						<button
							type="button"
							onClick={() => form.name && createMutation.mutate(form)}
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
			<div className={css({ display: "grid", gridTemplateColumns: { base: "1", md: "2", xl: "3" }, gap: "4" })}>
				{list.map((r) => (
					<div
						key={r.id}
						className={css({
							borderRadius: "lg",
							borderWidth: "1px",
							borderColor: "gray.200",
							bg: "white",
							p: "4",
							shadow: "sm",
							gridColumn: expandedId === r.id ? { md: "span 2", xl: "span 3" } : undefined,
						})}
					>
						<div className={css({ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "2" })}>
							<h3 className={css({ fontSize: "sm", fontWeight: "semibold", color: "gray.900" })}>{r.name}</h3>
							<div className={css({ display: "flex", gap: "2" })}>
								<button
									type="button"
									onClick={() => toggleMutation.mutate({ id: r.id, isActive: !r.isActive })}
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
								</button>
								<button
									type="button"
									onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
									className={css({ fontSize: "xs", color: "blue.600" })}
								>
									{expandedId === r.id ? "閉じる" : "詳細"}
								</button>
							</div>
						</div>
						{r.description && <p className={css({ fontSize: "xs", color: "gray.500", mb: "2" })}>{r.description}</p>}
						{expandedId === r.id && detail?.steps && (
							<div
								className={css({
									mt: "3",
									display: "flex",
									flexDirection: "column",
									gap: "2",
									borderTopWidth: "1px",
									borderColor: "gray.100",
									pt: "3",
								})}
							>
								<h4 className={css({ fontSize: "xs", fontWeight: "medium", color: "gray.700" })}>ステップ一覧</h4>
								{detail.steps.map((s) => (
									<div
										key={s.id}
										className={css({
											display: "flex",
											alignItems: "center",
											gap: "2",
											borderRadius: "sm",
											bg: "gray.50",
											p: "2",
											fontSize: "xs",
										})}
									>
										<span className={css({ fontFamily: "mono", color: "blue.600" })}>
											{formatOffset(s.offsetMinutes)}
										</span>
										<span className={css({ color: "gray.600" })}>{s.messageType}</span>
										<span className={css({ color: "gray.400", truncate: true, flex: "1" })}>
											{s.messageContent.slice(0, 50)}
										</span>
									</div>
								))}
							</div>
						)}
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
	);
}
