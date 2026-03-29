import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { css } from "../../../styled-system/css";
import { lineAccountsQueryOptions } from "../../lib/query-config";
import { fetchApi } from "../../lib/rpc";

interface LineAccountCreateData {
	channelId: string;
	name: string;
	channelAccessToken: string;
	channelSecret: string;
}

export const Route = createFileRoute("/_authed/accounts")({ component: AccountsPage });

function AccountsPage() {
	const queryClient = useQueryClient();
	const [showCreate, setShowCreate] = useState(false);
	const [form, setForm] = useState({ channelId: "", name: "", channelAccessToken: "", channelSecret: "" });

	const accounts = useQuery(lineAccountsQueryOptions.list());
	const createMutation = useMutation({
		mutationFn: (data: LineAccountCreateData) =>
			fetchApi("/api/line-accounts", { method: "POST", body: JSON.stringify(data) }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["line-accounts"] });
			setShowCreate(false);
		},
	});
	const deleteMutation = useMutation({
		mutationFn: (id: string) => fetchApi(`/api/line-accounts/${id}`, { method: "DELETE" }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["line-accounts"] }),
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
				<h1 className={css({ fontSize: "2xl", fontWeight: "bold", color: "gray.900" })}>アカウント管理</h1>
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
					+ 新規アカウント
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
						gridTemplateColumns: { base: "1", sm: "2" },
					})}
				>
					<input
						type="text"
						value={form.name}
						onChange={(e) => setForm({ ...form, name: e.target.value })}
						placeholder="アカウント名"
						className={inputStyle}
					/>
					<input
						type="text"
						value={form.channelId}
						onChange={(e) => setForm({ ...form, channelId: e.target.value })}
						placeholder="Channel ID"
						className={inputStyle}
					/>
					<input
						type="password"
						value={form.channelAccessToken}
						onChange={(e) => setForm({ ...form, channelAccessToken: e.target.value })}
						placeholder="Channel Access Token"
						className={inputStyle}
					/>
					<input
						type="password"
						value={form.channelSecret}
						onChange={(e) => setForm({ ...form, channelSecret: e.target.value })}
						placeholder="Channel Secret"
						className={inputStyle}
					/>
					<div className={css({ gridColumn: { sm: "span 2" }, display: "flex", gap: "2" })}>
						<button
							type="button"
							onClick={() => form.name && form.channelId && createMutation.mutate(form)}
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
			<div className={css({ display: "grid", gridTemplateColumns: { base: "1", sm: "2" }, gap: "4" })}>
				{(accounts.data?.data ?? []).map((a) => (
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
						<div className={css({ display: "flex", alignItems: "center", gap: "3", mb: "3" })}>
							<div
								className={css({
									display: "flex",
									h: "12",
									w: "12",
									alignItems: "center",
									justifyContent: "center",
									borderRadius: "full",
									bg: "line.green",
									fontSize: "lg",
									fontWeight: "bold",
									color: "white",
								})}
							>
								{a.name?.charAt(0) ?? "?"}
							</div>
							<div>
								<p className={css({ fontSize: "sm", fontWeight: "medium", color: "gray.900" })}>{a.name}</p>
								<p className={css({ fontSize: "xs", color: "gray.400" })}>{a.channelId}</p>
							</div>
						</div>
						<div className={css({ display: "flex", alignItems: "center", justifyContent: "space-between" })}>
							<span
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
							</span>
							<button
								type="button"
								onClick={() => deleteMutation.mutate(a.id)}
								className={css({ fontSize: "xs", color: "red.500" })}
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
