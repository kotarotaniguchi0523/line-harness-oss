import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { css } from "../../../styled-system/css";
import { templatesQueryOptions } from "../../lib/query-config";
import { fetchApi } from "../../lib/rpc";

export const Route = createFileRoute("/_authed/templates")({
	component: TemplatesPage,
});

function TemplatesPage() {
	const queryClient = useQueryClient();
	const [showCreate, setShowCreate] = useState(false);
	const [selectedCategory, setSelectedCategory] = useState("all");
	const [form, setForm] = useState({ name: "", category: "general", messageType: "text", messageContent: "" });

	const templates = useQuery(templatesQueryOptions.list());

	const createMutation = useMutation({
		mutationFn: (data: typeof form) => fetchApi("/api/templates", { method: "POST", body: JSON.stringify(data) }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["templates"] });
			setShowCreate(false);
			setForm({ name: "", category: "general", messageType: "text", messageContent: "" });
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => fetchApi(`/api/templates/${id}`, { method: "DELETE" }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates"] }),
	});

	const templateList = templates.data?.data ?? [];
	const categories = ["all", ...new Set(templateList.map((t) => t.category))];
	const filtered =
		selectedCategory === "all" ? templateList : templateList.filter((t) => t.category === selectedCategory);

	const inputStyle = css({
		w: "full",
		borderRadius: "lg",
		borderWidth: "1px",
		borderColor: "gray.300",
		px: "3",
		py: "2",
		fontSize: "sm",
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
				<h1 className={css({ fontSize: "2xl", fontWeight: "bold", color: "gray.900" })}>テンプレート</h1>
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
					+ 新規テンプレート
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
								テンプレート名 <span className={css({ color: "red.500" })}>*</span>
								<input
									type="text"
									value={form.name}
									onChange={(e) => setForm({ ...form, name: e.target.value })}
									className={inputStyle}
								/>
							</label>
						</div>
						<div>
							<label className={labelStyle}>
								カテゴリ
								<input
									type="text"
									value={form.category}
									onChange={(e) => setForm({ ...form, category: e.target.value })}
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
									<option value="text">テキスト</option>
									<option value="image">画像</option>
									<option value="flex">Flex</option>
								</select>
							</label>
						</div>
					</div>
					<div className={css({ mt: "3" })}>
						<label className={labelStyle}>
							内容 <span className={css({ color: "red.500" })}>*</span>
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
							onClick={() => form.name && form.messageContent && createMutation.mutate(form)}
							disabled={!(form.name && form.messageContent) || createMutation.isPending}
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

			<div className={css({ mb: "4", display: "flex", flexWrap: "wrap", gap: "2" })}>
				{categories.map((cat) => (
					<button
						type="button"
						key={cat}
						onClick={() => setSelectedCategory(cat)}
						className={css({
							borderRadius: "full",
							px: "3",
							py: "1",
							fontSize: "sm",
							fontWeight: "medium",
							bg: selectedCategory === cat ? "line.green" : "gray.100",
							color: selectedCategory === cat ? "white" : "gray.600",
						})}
					>
						{cat === "all" ? "全て" : cat}
					</button>
				))}
			</div>

			{templates.isLoading ? (
				<div className={css({ display: "flex", flexDirection: "column", gap: "2" })}>
					{Array.from({ length: 4 }).map((_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static list with no stable id
						<div key={i} className={css({ h: "12", animation: "pulse", borderRadius: "md", bg: "gray.200" })} />
					))}
				</div>
			) : filtered.length > 0 ? (
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
								<th className={thStyle}>カテゴリ</th>
								<th className={thStyle}>種別</th>
								<th className={thStyle}>作成日</th>
								<th className={thStyle}>操作</th>
							</tr>
						</thead>
						<tbody className={css({ divideY: "1px", divideColor: "gray.100" })}>
							{filtered.map((t) => (
								<tr key={t.id} className={css({ _hover: { bg: "gray.50" } })}>
									<td className={css({ px: "4", py: "3" })}>
										<div>
											<p className={css({ fontSize: "sm", fontWeight: "medium", color: "gray.900" })}>{t.name}</p>
											<p className={css({ fontSize: "xs", color: "gray.400", truncate: true, maxW: "200px" })}>
												{t.messageContent.slice(0, 50)}
											</p>
										</div>
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
											{t.category}
										</span>
									</td>
									<td className={css({ px: "4", py: "3", fontSize: "sm", color: "gray.600" })}>{t.messageType}</td>
									<td className={css({ px: "4", py: "3", fontSize: "sm", color: "gray.500" })}>
										{new Date(t.createdAt).toLocaleDateString("ja-JP")}
									</td>
									<td className={css({ px: "4", py: "3" })}>
										<button
											type="button"
											onClick={() => deleteMutation.mutate(t.id)}
											className={css({ fontSize: "sm", color: "red.500", _hover: { color: "red.700" } })}
										>
											削除
										</button>
									</td>
								</tr>
							))}
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
					テンプレートがありません。
				</div>
			)}
		</div>
	);
}
