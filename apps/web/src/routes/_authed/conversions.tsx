import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { css } from "../../../styled-system/css";
import { fetchApi } from "../../lib/rpc";

interface ConversionPoint {
	id: string;
	name: string;
	eventType: string;
	value: number | null;
	createdAt: string;
}

interface ConversionReport {
	name: string;
	count: number;
	totalValue: number;
}

interface ConversionPointCreateData {
	name: string;
	eventType: string;
	value?: number;
}

export const Route = createFileRoute("/_authed/conversions")({ component: ConversionsPage });

const eventTypes = [
	"friend_add",
	"rich_menu_tap",
	"url_click",
	"form_submit",
	"keyword_sent",
	"scenario_step",
	"liff_view",
	"purchase",
	"custom",
];

function ConversionsPage() {
	const queryClient = useQueryClient();
	const [showCreate, setShowCreate] = useState(false);
	const [form, setForm] = useState({ name: "", eventType: "friend_add", value: "" });

	const points = useQuery({
		queryKey: ["conversion-points"],
		queryFn: () => fetchApi<{ success: true; data: ConversionPoint[] }>("/api/conversions/points"),
	});
	const report = useQuery({
		queryKey: ["conversion-report"],
		queryFn: () => fetchApi<{ success: true; data: ConversionReport[] }>("/api/conversions/report"),
	});
	const createMutation = useMutation({
		mutationFn: (data: ConversionPointCreateData) =>
			fetchApi("/api/conversions/points", { method: "POST", body: JSON.stringify(data) }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["conversion-points"] });
			setShowCreate(false);
		},
	});
	const deleteMutation = useMutation({
		mutationFn: (id: string) => fetchApi(`/api/conversions/points/${id}`, { method: "DELETE" }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["conversion-points"] }),
	});

	const inputStyle = css({
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
				<h1 className={css({ fontSize: "2xl", fontWeight: "bold", color: "gray.900" })}>CV計測</h1>
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
					+ 新規CV
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
						display: "grid",
						gap: "3",
						gridTemplateColumns: { base: "1", sm: "3" },
					})}
				>
					<input
						type="text"
						value={form.name}
						onChange={(e) => setForm({ ...form, name: e.target.value })}
						placeholder="CV名"
						className={inputStyle}
					/>
					<select
						value={form.eventType}
						onChange={(e) => setForm({ ...form, eventType: e.target.value })}
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
						{eventTypes.map((t) => (
							<option key={t} value={t}>
								{t}
							</option>
						))}
					</select>
					<div className={css({ display: "flex", gap: "2" })}>
						<input
							type="number"
							value={form.value}
							onChange={(e) => setForm({ ...form, value: e.target.value })}
							placeholder="金額"
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
							onClick={() =>
								form.name &&
								createMutation.mutate({
									name: form.name,
									eventType: form.eventType,
									value: form.value ? Number(form.value) : undefined,
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
					</div>
				</div>
			)}
			{(report.data?.data ?? []).length > 0 && (
				<div
					className={css({ mb: "6", display: "grid", gridTemplateColumns: { base: "1", sm: "2", xl: "3" }, gap: "4" })}
				>
					{(report.data?.data ?? []).map((r) => (
						<div
							key={r.name}
							className={css({ borderRadius: "lg", borderWidth: "1px", borderColor: "gray.200", bg: "white", p: "4" })}
						>
							<p className={css({ fontSize: "sm", fontWeight: "medium", color: "gray.900" })}>{r.name}</p>
							<p className={css({ fontSize: "2xl", fontWeight: "bold", color: "gray.900" })}>{r.count ?? 0}</p>
							{r.totalValue > 0 && (
								<p className={css({ fontSize: "sm", color: "gray.500" })}>¥{r.totalValue.toLocaleString("ja-JP")}</p>
							)}
						</div>
					))}
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
							<th className={thStyle}>CV名</th>
							<th className={thStyle}>イベント</th>
							<th className={thStyle}>金額</th>
							<th className={thStyle}>操作</th>
						</tr>
					</thead>
					<tbody className={css({ divideY: "1px", divideColor: "gray.100" })}>
						{(points.data?.data ?? []).map((p) => (
							<tr key={p.id} className={css({ _hover: { bg: "gray.50" } })}>
								<td className={css({ px: "4", py: "3", fontSize: "sm" })}>{p.name}</td>
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
										{p.eventType}
									</span>
								</td>
								<td className={css({ px: "4", py: "3", fontSize: "sm", color: "gray.600" })}>
									{p.value ? `¥${p.value.toLocaleString("ja-JP")}` : "—"}
								</td>
								<td className={css({ px: "4", py: "3" })}>
									<button
										type="button"
										onClick={() => deleteMutation.mutate(p.id)}
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
