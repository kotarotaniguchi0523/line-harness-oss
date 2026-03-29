import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { css } from "../../../styled-system/css";
import { fetchApi } from "../../lib/rpc";

export const Route = createFileRoute("/_authed/tags")({
	component: TagsPage,
});

function TagsPage() {
	const queryClient = useQueryClient();
	const [showCreate, setShowCreate] = useState(false);
	const [name, setName] = useState("");
	const [color, setColor] = useState("#3B82F6");

	const tags = useQuery({
		queryKey: ["tags"],
		queryFn: () => fetchApi<{ success: true; data: Tag[] }>("/api/tags"),
	});

	const createMutation = useMutation({
		mutationFn: (data: { name: string; color: string }) =>
			fetchApi("/api/tags", { method: "POST", body: JSON.stringify(data) }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["tags"] });
			setShowCreate(false);
			setName("");
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => fetchApi(`/api/tags/${id}`, { method: "DELETE" }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tags"] }),
	});

	const tagList = tags.data?.data ?? [];

	return (
		<div>
			<div className={css({ mb: "6", display: "flex", alignItems: "center", justifyContent: "space-between" })}>
				<h1 className={css({ fontSize: "2xl", fontWeight: "bold", color: "gray.900" })}>タグ管理</h1>
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
					+ 新規タグ
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
					<div
						className={css({
							display: "flex",
							flexDirection: { base: "column", sm: "row" },
							gap: "3",
							alignItems: { sm: "flex-end" },
						})}
					>
						<div className={css({ flex: "1" })}>
							<label
								className={css({ mb: "1", display: "block", fontSize: "sm", fontWeight: "medium", color: "gray.700" })}
							>
								タグ名
								<input
									type="text"
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="例: VIP"
									className={css({
										w: "full",
										borderRadius: "lg",
										borderWidth: "1px",
										borderColor: "gray.300",
										px: "3",
										py: "2",
										fontSize: "sm",
										_focus: { outline: "none", ringWidth: "2px", ringColor: "green.500" },
									})}
								/>
							</label>
						</div>
						<div>
							<label
								className={css({ mb: "1", display: "block", fontSize: "sm", fontWeight: "medium", color: "gray.700" })}
							>
								色
								<input
									type="color"
									value={color}
									onChange={(e) => setColor(e.target.value)}
									className={css({
										h: "10",
										w: "16",
										cursor: "pointer",
										borderRadius: "md",
										borderWidth: "1px",
										borderColor: "gray.300",
									})}
								/>
							</label>
						</div>
						<button
							type="button"
							onClick={() => name.trim() && createMutation.mutate({ name: name.trim(), color })}
							disabled={!name.trim() || createMutation.isPending}
							className={css({
								minH: "44px",
								borderRadius: "lg",
								bg: "line.green",
								px: "4",
								py: "2",
								fontSize: "sm",
								fontWeight: "medium",
								color: "white",
								_hover: { opacity: "0.9" },
								_disabled: { opacity: "0.5" },
							})}
						>
							{createMutation.isPending ? "作成中..." : "作成"}
						</button>
						<button
							type="button"
							onClick={() => setShowCreate(false)}
							className={css({
								minH: "44px",
								borderRadius: "lg",
								bg: "gray.100",
								px: "4",
								py: "2",
								fontSize: "sm",
								fontWeight: "medium",
								color: "gray.600",
								_hover: { bg: "gray.200" },
							})}
						>
							キャンセル
						</button>
					</div>
				</div>
			)}

			{tags.isLoading ? (
				<div className={css({ display: "flex", flexDirection: "column", gap: "2" })}>
					{Array.from({ length: 5 }).map((_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static list with no stable id
						<div key={i} className={css({ h: "12", animation: "pulse", borderRadius: "lg", bg: "gray.200" })} />
					))}
				</div>
			) : tagList.length > 0 ? (
				<div className={css({ display: "flex", flexWrap: "wrap", gap: "3" })}>
					{tagList.map((tag) => (
						<div
							key={tag.id}
							className={css({
								display: "flex",
								alignItems: "center",
								gap: "2",
								borderRadius: "lg",
								borderWidth: "1px",
								borderColor: "gray.200",
								bg: "white",
								px: "4",
								py: "2",
								shadow: "sm",
							})}
						>
							<span className={css({ h: "4", w: "4", borderRadius: "full" })} style={{ backgroundColor: tag.color }} />
							<span className={css({ fontSize: "sm", fontWeight: "medium", color: "gray.900" })}>{tag.name}</span>
							<button
								type="button"
								onClick={() => deleteMutation.mutate(tag.id)}
								className={css({ ml: "2", fontSize: "xs", color: "red.500", _hover: { color: "red.700" } })}
							>
								削除
							</button>
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
					タグがありません。「新規タグ」から作成してください。
				</div>
			)}
		</div>
	);
}

interface Tag {
	id: string;
	name: string;
	color: string;
	createdAt: string;
}
