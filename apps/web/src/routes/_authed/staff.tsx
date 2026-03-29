import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { css } from "../../../styled-system/css";
import { staffQueryOptions } from "../../lib/query-config";
import { fetchApi } from "../../lib/rpc";

interface StaffCreateData {
	name: string;
	email: string;
	role: "admin" | "staff";
}

export const Route = createFileRoute("/_authed/staff")({ component: StaffPage });

const roleBadgeStyles: Record<string, { bg: string; color: string }> = {
	owner: { bg: "yellow.100", color: "yellow.700" },
	admin: { bg: "blue.100", color: "blue.700" },
	staff: { bg: "gray.100", color: "gray.600" },
};

function StaffPage() {
	const queryClient = useQueryClient();
	const [showForm, setShowForm] = useState(false);
	const [form, setForm] = useState({ name: "", email: "", role: "staff" as "admin" | "staff" });
	const [newKey, setNewKey] = useState<string | null>(null);

	const staff = useQuery(staffQueryOptions.list());
	const createMutation = useMutation({
		mutationFn: (data: StaffCreateData) =>
			fetchApi<{ success: true; data: { apiKey: string } }>("/api/staff", {
				method: "POST",
				body: JSON.stringify(data),
			}),
		onSuccess: (res) => {
			setNewKey(res.data.apiKey);
			queryClient.invalidateQueries({ queryKey: ["staff"] });
			setShowForm(false);
		},
	});
	const deleteMutation = useMutation({
		mutationFn: (id: string) => fetchApi(`/api/staff/${id}`, { method: "DELETE" }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff"] }),
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
	const inputStyle = css({
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
				<h1 className={css({ fontSize: "2xl", fontWeight: "bold", color: "gray.900" })}>スタッフ管理</h1>
				<button
					type="button"
					onClick={() => setShowForm(!showForm)}
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
					+ 新規スタッフ
				</button>
			</div>
			{newKey && (
				<div
					className={css({
						mb: "4",
						borderRadius: "lg",
						borderWidth: "1px",
						borderColor: "green.200",
						bg: "green.50",
						p: "4",
					})}
				>
					<p className={css({ fontSize: "sm", fontWeight: "medium", color: "green.800" })}>
						APIキーが生成されました（一度だけ表示）:
					</p>
					<code
						className={css({
							mt: "1",
							display: "block",
							borderRadius: "md",
							bg: "white",
							p: "2",
							fontSize: "sm",
							fontFamily: "mono",
							color: "gray.900",
						})}
					>
						{newKey}
					</code>
					<button
						type="button"
						onClick={() => {
							navigator.clipboard.writeText(newKey);
						}}
						className={css({ mt: "2", fontSize: "xs", color: "green.700", _hover: { color: "green.900" } })}
					>
						コピー
					</button>
					<button
						type="button"
						onClick={() => setNewKey(null)}
						className={css({ ml: "4", fontSize: "xs", color: "gray.500" })}
					>
						閉じる
					</button>
				</div>
			)}
			{showForm && (
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
						placeholder="名前"
						className={inputStyle}
					/>
					<input
						type="email"
						value={form.email}
						onChange={(e) => setForm({ ...form, email: e.target.value })}
						placeholder="メール (任意)"
						className={inputStyle}
					/>
					<div className={css({ display: "flex", gap: "2" })}>
						<select
							value={form.role}
							onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "staff" })}
							className={css({
								flex: "1",
								borderRadius: "lg",
								borderWidth: "1px",
								borderColor: "gray.300",
								px: "3",
								py: "2",
								fontSize: "sm",
								bg: "white",
							})}
						>
							<option value="staff">staff</option>
							<option value="admin">admin</option>
						</select>
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
							<th className={thStyle}>名前</th>
							<th className={thStyle}>ロール</th>
							<th
								className={css({
									display: { base: "none", md: "table-cell" },
									px: "4",
									py: "3",
									textAlign: "left",
									fontSize: "xs",
									fontWeight: "medium",
									textTransform: "uppercase",
									color: "gray.500",
								})}
							>
								APIキー
							</th>
							<th className={thStyle}>状態</th>
							<th className={thStyle}>操作</th>
						</tr>
					</thead>
					<tbody className={css({ divideY: "1px", divideColor: "gray.100" })}>
						{(staff.data?.data ?? []).map((s) => {
							const badge = roleBadgeStyles[s.role];
							return (
								<tr key={s.id} className={css({ _hover: { bg: "gray.50" } })}>
									<td className={css({ px: "4", py: "3", fontSize: "sm", fontWeight: "medium", color: "gray.900" })}>
										{s.name}
									</td>
									<td className={css({ px: "4", py: "3" })}>
										<span
											className={css({
												borderRadius: "full",
												px: "2",
												py: "0.5",
												fontSize: "xs",
												fontWeight: "medium",
												bg: badge?.bg ?? "gray.100",
												color: badge?.color ?? "gray.600",
											})}
										>
											{s.role}
										</span>
									</td>
									<td
										className={css({
											display: { base: "none", md: "table-cell" },
											px: "4",
											py: "3",
											fontSize: "xs",
											fontFamily: "mono",
											color: "gray.400",
										})}
									>
										{s.apiKey}
									</td>
									<td className={css({ px: "4", py: "3" })}>
										<span
											className={css({
												display: "inline-block",
												h: "2",
												w: "2",
												borderRadius: "full",
												bg: s.isActive ? "green.500" : "gray.300",
											})}
										/>
									</td>
									<td className={css({ px: "4", py: "3" })}>
										{s.role !== "owner" && (
											<button
												type="button"
												onClick={() => deleteMutation.mutate(s.id)}
												className={css({ fontSize: "xs", color: "red.500" })}
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
		</div>
	);
}
