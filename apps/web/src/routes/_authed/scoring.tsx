import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { css } from "../../../styled-system/css";
import { scoringRulesQueryOptions } from "../../lib/query-config";
import { fetchApi } from "../../lib/rpc";

export const Route = createFileRoute("/_authed/scoring")({ component: ScoringPage });

function ScoringPage() {
	const queryClient = useQueryClient();
	const [showCreate, setShowCreate] = useState(false);
	const [form, setForm] = useState({ name: "", eventType: "", scoreValue: "5" });

	const rules = useQuery(scoringRulesQueryOptions.list());
	const createMutation = useMutation({
		mutationFn: (data: ScoringRuleCreateData) =>
			fetchApi("/api/scoring-rules", { method: "POST", body: JSON.stringify(data) }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["scoring-rules"] });
			setShowCreate(false);
			setForm({ name: "", eventType: "", scoreValue: "5" });
		},
	});
	const toggleMutation = useMutation({
		mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
			fetchApi(`/api/scoring-rules/${id}`, { method: "PUT", body: JSON.stringify({ isActive }) }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scoring-rules"] }),
	});
	const deleteMutation = useMutation({
		mutationFn: (id: string) => fetchApi(`/api/scoring-rules/${id}`, { method: "DELETE" }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scoring-rules"] }),
	});

	const list = rules.data?.data ?? [];
	const activeCount = list.filter((r) => r.isActive).length;
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
				<h1 className={css({ fontSize: "2xl", fontWeight: "bold", color: "gray.900" })}>スコアリング</h1>
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
			<div className={css({ mb: "6", display: "grid", gridTemplateColumns: "2", gap: "4" })}>
				<div className={css({ borderRadius: "lg", borderWidth: "1px", borderColor: "gray.200", bg: "white", p: "4" })}>
					<p className={css({ fontSize: "sm", color: "gray.500" })}>ルール数</p>
					<p className={css({ fontSize: "2xl", fontWeight: "bold" })}>{list.length}</p>
				</div>
				<div className={css({ borderRadius: "lg", borderWidth: "1px", borderColor: "gray.200", bg: "white", p: "4" })}>
					<p className={css({ fontSize: "sm", color: "gray.500" })}>有効ルール</p>
					<p className={css({ fontSize: "2xl", fontWeight: "bold", color: "green.600" })}>{activeCount}</p>
				</div>
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
						type="number"
						value={form.scoreValue}
						onChange={(e) => setForm({ ...form, scoreValue: e.target.value })}
						placeholder="スコア値"
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
									scoreValue: Number(form.scoreValue),
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
							<th className={thStyle}>ルール名</th>
							<th className={thStyle}>イベント</th>
							<th className={thStyle}>スコア</th>
							<th className={thStyle}>状態</th>
							<th className={thStyle}>操作</th>
						</tr>
					</thead>
					<tbody className={css({ divideY: "1px", divideColor: "gray.100" })}>
						{list.map((r) => (
							<tr key={r.id} className={css({ _hover: { bg: "gray.50" } })}>
								<td className={css({ px: "4", py: "3", fontSize: "sm", fontWeight: "medium", color: "gray.900" })}>
									{r.name}
								</td>
								<td className={css({ px: "4", py: "3" })}>
									<span
										className={css({
											borderRadius: "full",
											bg: "blue.100",
											px: "2",
											py: "0.5",
											fontSize: "xs",
											color: "blue.700",
										})}
									>
										{r.eventType}
									</span>
								</td>
								<td
									className={css({ px: "4", py: "3", fontSize: "sm", fontWeight: "medium" })}
									style={{ color: r.scoreValue > 0 ? "#06C755" : "#EF4444" }}
								>
									{r.scoreValue > 0 ? `+${r.scoreValue}` : r.scoreValue}
								</td>
								<td className={css({ px: "4", py: "3" })}>
									<button
										type="button"
										onClick={() => toggleMutation.mutate({ id: r.id, isActive: !r.isActive })}
										className={css({
											borderRadius: "full",
											px: "2",
											py: "0.5",
											fontSize: "xs",
											fontWeight: "medium",
											bg: r.isActive ? "green.100" : "gray.100",
											color: r.isActive ? "green.700" : "gray.600",
										})}
									>
										{r.isActive ? "有効" : "無効"}
									</button>
								</td>
								<td className={css({ px: "4", py: "3" })}>
									<button
										type="button"
										onClick={() => deleteMutation.mutate(r.id)}
										className={css({ fontSize: "xs", color: "red.500" })}
									>
										削除
									</button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

interface ScoringRuleCreateData {
	name: string;
	eventType: string;
	scoreValue: number;
}
