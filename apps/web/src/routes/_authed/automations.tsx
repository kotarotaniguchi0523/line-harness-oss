import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { css } from "../../../styled-system/css";
import { fetchApi } from "../../lib/rpc";

interface Automation {
	id: string;
	name: string;
	description: string | null;
	eventType: string;
	actions: unknown[];
	conditions: Record<string, unknown>;
	priority: number;
	isActive: boolean;
	createdAt: string;
}

interface AutomationCreateData {
	name: string;
	description: string;
	eventType: string;
	actions: unknown[];
	conditions: Record<string, unknown>;
	priority: number;
}

export const Route = createFileRoute("/_authed/automations")({ component: AutomationsPage });

const eventLabels: Record<string, string> = {
	friend_add: "友だち追加",
	tag_change: "タグ変更",
	score_threshold: "スコア閾値",
	cv_fire: "CV発火",
	message_received: "メッセージ受信",
	calendar_booked: "予約確定",
};

function AutomationsPage() {
	const queryClient = useQueryClient();
	const [showCreate, setShowCreate] = useState(false);
	const [form, setForm] = useState({
		name: "",
		description: "",
		eventType: "friend_add",
		actionsJson: '[{"type":"add_tag","params":{}}]',
		conditionsJson: "{}",
		priority: 0,
	});

	const automations = useQuery({
		queryKey: ["automations"],
		queryFn: () => fetchApi<{ success: true; data: Automation[] }>("/api/automations"),
	});
	const createMutation = useMutation({
		mutationFn: (data: AutomationCreateData) =>
			fetchApi("/api/automations", { method: "POST", body: JSON.stringify(data) }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["automations"] });
			setShowCreate(false);
		},
	});
	const toggleMutation = useMutation({
		mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
			fetchApi(`/api/automations/${id}`, { method: "PUT", body: JSON.stringify({ isActive }) }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automations"] }),
	});
	const deleteMutation = useMutation({
		mutationFn: (id: string) => fetchApi(`/api/automations/${id}`, { method: "DELETE" }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automations"] }),
	});

	const list = automations.data?.data ?? [];
	const inputStyle = css({
		w: "full",
		borderRadius: "lg",
		borderWidth: "1px",
		borderColor: "gray.300",
		px: "3",
		py: "2",
		fontSize: "sm",
	});

	return (
		<div>
			<div className={css({ mb: "6", display: "flex", alignItems: "center", justifyContent: "space-between" })}>
				<h1 className={css({ fontSize: "2xl", fontWeight: "bold", color: "gray.900" })}>オートメーション</h1>
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
					<textarea
						value={form.description}
						onChange={(e) => setForm({ ...form, description: e.target.value })}
						placeholder="説明"
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
					<select
						value={form.eventType}
						onChange={(e) => setForm({ ...form, eventType: e.target.value })}
						className={css({
							w: "full",
							borderRadius: "lg",
							borderWidth: "1px",
							borderColor: "gray.300",
							px: "3",
							py: "2",
							fontSize: "sm",
							bg: "white",
						})}
					>
						{Object.entries(eventLabels).map(([v, l]) => (
							<option key={v} value={v}>
								{l}
							</option>
						))}
					</select>
					<textarea
						value={form.actionsJson}
						onChange={(e) => setForm({ ...form, actionsJson: e.target.value })}
						rows={3}
						placeholder="Actions JSON"
						className={css({
							w: "full",
							borderRadius: "lg",
							borderWidth: "1px",
							borderColor: "gray.300",
							px: "3",
							py: "2",
							fontSize: "sm",
							fontFamily: "mono",
						})}
					/>
					<input
						type="number"
						value={form.priority}
						onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
						placeholder="優先度"
						className={inputStyle}
					/>
					<div className={css({ display: "flex", gap: "2" })}>
						<button
							type="button"
							onClick={() => {
								try {
									createMutation.mutate({
										name: form.name,
										description: form.description,
										eventType: form.eventType,
										actions: JSON.parse(form.actionsJson),
										conditions: JSON.parse(form.conditionsJson),
										priority: form.priority,
									});
								} catch (e) {
									alert(e instanceof Error ? e.message : "Invalid JSON");
								}
							}}
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
				{list.map((a) => (
					<div
						key={a.id}
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
							<h3 className={css({ fontSize: "sm", fontWeight: "semibold", color: "gray.900", truncate: true })}>
								{a.name}
							</h3>
							<button
								type="button"
								onClick={() => toggleMutation.mutate({ id: a.id, isActive: !a.isActive })}
								className={css({
									borderRadius: "full",
									px: "2",
									py: "0.5",
									fontSize: "xs",
									fontWeight: "medium",
									bg: a.isActive ? "green.100" : "gray.100",
									color: a.isActive ? "green.700" : "gray.600",
								})}
							>
								{a.isActive ? "有効" : "無効"}
							</button>
						</div>
						{a.description && (
							<p className={css({ fontSize: "xs", color: "gray.500", lineClamp: "2", mb: "2" })}>{a.description}</p>
						)}
						<div className={css({ display: "flex", gap: "2", fontSize: "xs", color: "gray.400" })}>
							<span className={css({ borderRadius: "sm", bg: "blue.50", px: "1.5", py: "0.5", color: "blue.600" })}>
								{eventLabels[a.eventType] ?? a.eventType}
							</span>
							<span>優先度: {a.priority}</span>
						</div>
						<button
							type="button"
							onClick={() => deleteMutation.mutate(a.id)}
							className={css({ mt: "2", fontSize: "xs", color: "red.500", _hover: { color: "red.700" } })}
						>
							削除
						</button>
					</div>
				))}
			</div>
		</div>
	);
}
