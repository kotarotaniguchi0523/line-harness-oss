import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { css } from "../../../styled-system/css";
import { fetchApi } from "../../lib/rpc";

export const Route = createFileRoute("/_authed/scenarios")({
	component: ScenariosPage,
});

function ScenariosPage() {
	const queryClient = useQueryClient();
	const [showCreate, setShowCreate] = useState(false);
	const [form, setForm] = useState({ name: "", description: "", triggerType: "friend_add", isActive: true });
	const [formError, setFormError] = useState("");

	const scenarios = useQuery({
		queryKey: ["scenarios"],
		queryFn: () => fetchApi<{ success: true; data: Scenario[] }>("/api/scenarios"),
	});

	const createMutation = useMutation({
		mutationFn: (data: typeof form) => fetchApi("/api/scenarios", { method: "POST", body: JSON.stringify(data) }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["scenarios"] });
			setShowCreate(false);
			setForm({ name: "", description: "", triggerType: "friend_add", isActive: true });
		},
		onError: (e) => setFormError(e.message),
	});

	const toggleMutation = useMutation({
		mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
			fetchApi(`/api/scenarios/${id}`, { method: "PUT", body: JSON.stringify({ isActive }) }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scenarios"] }),
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => fetchApi(`/api/scenarios/${id}`, { method: "DELETE" }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scenarios"] }),
	});

	const list = scenarios.data?.data ?? [];
	const triggerLabels: Record<string, string> = { friend_add: "友だち追加時", tag_added: "タグ付与時", manual: "手動" };

	return (
		<div>
			<div className={css({ mb: "6", display: "flex", alignItems: "center", justifyContent: "space-between" })}>
				<h1 className={css({ fontSize: "2xl", fontWeight: "bold", color: "gray.900" })}>シナリオ配信</h1>
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
					+ 新規シナリオ
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
					<h3 className={css({ mb: "3", fontSize: "sm", fontWeight: "semibold", color: "gray.900" })}>
						新規シナリオを作成
					</h3>
					<div className={css({ display: "flex", flexDirection: "column", gap: "3" })}>
						<input
							type="text"
							value={form.name}
							onChange={(e) => setForm({ ...form, name: e.target.value })}
							placeholder="例: 友だち追加ウェルカムシナリオ"
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
							placeholder="シナリオの説明 (省略可)"
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
							value={form.triggerType}
							onChange={(e) => setForm({ ...form, triggerType: e.target.value })}
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
							<option value="friend_add">友だち追加時</option>
							<option value="tag_added">タグ付与時</option>
							<option value="manual">手動</option>
						</select>
						<label className={css({ display: "flex", alignItems: "center", gap: "2", fontSize: "sm" })}>
							<input
								type="checkbox"
								checked={form.isActive}
								onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
								className={css({ h: "4", w: "4", borderRadius: "sm", borderColor: "gray.300", color: "green.600" })}
							/>{" "}
							作成後すぐに有効にする
						</label>
						{formError && <p className={css({ fontSize: "xs", color: "red.600" })}>{formError}</p>}
						<div className={css({ display: "flex", gap: "2" })}>
							<button
								type="button"
								onClick={() => form.name.trim() && createMutation.mutate(form)}
								disabled={!form.name.trim()}
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
				</div>
			)}

			{scenarios.isLoading ? (
				<div className={css({ display: "grid", gridTemplateColumns: { base: "1", md: "2", xl: "3" }, gap: "4" })}>
					{Array.from({ length: 3 }).map((_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static list with no stable id
						<div key={i} className={css({ h: "40", animation: "pulse", borderRadius: "lg", bg: "gray.200" })} />
					))}
				</div>
			) : list.length > 0 ? (
				<div className={css({ display: "grid", gridTemplateColumns: { base: "1", md: "2", xl: "3" }, gap: "4" })}>
					{list.map((s) => (
						<div
							key={s.id}
							className={css({
								borderRadius: "lg",
								borderWidth: "1px",
								borderColor: "gray.200",
								bg: "white",
								p: "4",
								shadow: "sm",
							})}
						>
							<div className={css({ mb: "2", display: "flex", alignItems: "center", justifyContent: "space-between" })}>
								<h3 className={css({ fontSize: "sm", fontWeight: "semibold", color: "gray.900", truncate: true })}>
									{s.name}
								</h3>
								<button
									type="button"
									onClick={() => toggleMutation.mutate({ id: s.id, isActive: !s.isActive })}
									className={css({
										borderRadius: "full",
										px: "2",
										py: "0.5",
										fontSize: "xs",
										fontWeight: "medium",
										bg: s.isActive ? "green.100" : "gray.100",
										color: s.isActive ? "green.700" : "gray.600",
									})}
								>
									{s.isActive ? "有効" : "無効"}
								</button>
							</div>
							{s.description && (
								<p className={css({ mb: "2", fontSize: "xs", color: "gray.500", lineClamp: "2" })}>{s.description}</p>
							)}
							<div
								className={css({ display: "flex", alignItems: "center", gap: "2", fontSize: "xs", color: "gray.400" })}
							>
								<span className={css({ borderRadius: "sm", bg: "blue.50", px: "1.5", py: "0.5", color: "blue.600" })}>
									{triggerLabels[s.triggerType] ?? s.triggerType}
								</span>
								<span>{s.stepCount ?? 0} ステップ</span>
							</div>
							<div className={css({ mt: "3", display: "flex", gap: "2" })}>
								<a
									href={`/scenarios/${s.id}`}
									className={css({ fontSize: "xs", color: "blue.600", _hover: { textDecoration: "underline" } })}
								>
									詳細
								</a>
								<button
									type="button"
									onClick={() => deleteMutation.mutate(s.id)}
									className={css({ fontSize: "xs", color: "red.500", _hover: { color: "red.700" } })}
								>
									削除
								</button>
							</div>
						</div>
					))}
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
					シナリオがありません。「新規シナリオ」から作成してください。
				</div>
			)}
		</div>
	);
}

interface Scenario {
	id: string;
	name: string;
	description: string | null;
	triggerType: string;
	isActive: boolean;
	stepCount?: number;
	createdAt: string;
}
