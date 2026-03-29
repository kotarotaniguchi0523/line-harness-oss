import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { css } from "../../../styled-system/css";
import { fetchApi } from "../../lib/rpc";

interface WebhookBase {
	id: string;
	name: string;
	isActive: boolean;
	createdAt: string;
}

interface IncomingWebhook extends WebhookBase {
	sourceType: string;
}

interface OutgoingWebhook extends WebhookBase {
	url: string;
	eventTypes: string[];
	secret: string;
}

interface IncomingWebhookCreateData {
	name: string;
	sourceType: string;
}

interface OutgoingWebhookCreateData {
	name: string;
	url: string;
	eventTypes: string[];
	secret: string;
}

export const Route = createFileRoute("/_authed/webhooks")({ component: WebhooksPage });

function WebhooksPage() {
	const queryClient = useQueryClient();
	const [tab, setTab] = useState<"incoming" | "outgoing">("incoming");
	const [showCreate, setShowCreate] = useState(false);
	const [inForm, setInForm] = useState({ name: "", sourceType: "custom" });
	const [outForm, setOutForm] = useState({ name: "", url: "", eventTypes: "", secret: "" });

	const incoming = useQuery({
		queryKey: ["webhooks", "incoming"],
		queryFn: () => fetchApi<{ success: true; data: IncomingWebhook[] }>("/api/webhooks/incoming"),
	});
	const outgoing = useQuery({
		queryKey: ["webhooks", "outgoing"],
		queryFn: () => fetchApi<{ success: true; data: OutgoingWebhook[] }>("/api/webhooks/outgoing"),
	});

	const createInMutation = useMutation({
		mutationFn: (data: IncomingWebhookCreateData) =>
			fetchApi("/api/webhooks/incoming", { method: "POST", body: JSON.stringify(data) }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["webhooks"] });
			setShowCreate(false);
		},
	});
	const createOutMutation = useMutation({
		mutationFn: (data: OutgoingWebhookCreateData) =>
			fetchApi("/api/webhooks/outgoing", { method: "POST", body: JSON.stringify(data) }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["webhooks"] });
			setShowCreate(false);
		},
	});
	const deleteInMutation = useMutation({
		mutationFn: (id: string) => fetchApi(`/api/webhooks/incoming/${id}`, { method: "DELETE" }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webhooks"] }),
	});
	const deleteOutMutation = useMutation({
		mutationFn: (id: string) => fetchApi(`/api/webhooks/outgoing/${id}`, { method: "DELETE" }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webhooks"] }),
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
				<h1 className={css({ fontSize: "2xl", fontWeight: "bold", color: "gray.900" })}>Webhook設定</h1>
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
					+ 新規Webhook
				</button>
			</div>
			<div className={css({ mb: "4", display: "flex", borderBottomWidth: "1px", borderColor: "gray.200" })}>
				<button
					type="button"
					onClick={() => setTab("incoming")}
					className={css({
						minH: "44px",
						px: "4",
						py: "2",
						fontSize: "sm",
						fontWeight: "medium",
						borderBottomWidth: tab === "incoming" ? "2px" : "0",
						borderColor: tab === "incoming" ? "line.green" : "transparent",
						color: tab === "incoming" ? "line.green" : "gray.500",
					})}
				>
					受信 (Incoming)
				</button>
				<button
					type="button"
					onClick={() => setTab("outgoing")}
					className={css({
						minH: "44px",
						px: "4",
						py: "2",
						fontSize: "sm",
						fontWeight: "medium",
						borderBottomWidth: tab === "outgoing" ? "2px" : "0",
						borderColor: tab === "outgoing" ? "line.green" : "transparent",
						color: tab === "outgoing" ? "line.green" : "gray.500",
					})}
				>
					送信 (Outgoing)
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
					{tab === "incoming" ? (
						<>
							<input
								type="text"
								value={inForm.name}
								onChange={(e) => setInForm({ ...inForm, name: e.target.value })}
								placeholder="名前"
								className={inputStyle}
							/>
							<input
								type="text"
								value={inForm.sourceType}
								onChange={(e) => setInForm({ ...inForm, sourceType: e.target.value })}
								placeholder="ソースタイプ"
								className={inputStyle}
							/>
							<button
								type="button"
								onClick={() => inForm.name && createInMutation.mutate(inForm)}
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
						</>
					) : (
						<>
							<input
								type="text"
								value={outForm.name}
								onChange={(e) => setOutForm({ ...outForm, name: e.target.value })}
								placeholder="名前"
								className={inputStyle}
							/>
							<input
								type="url"
								value={outForm.url}
								onChange={(e) => setOutForm({ ...outForm, url: e.target.value })}
								placeholder="送信先URL"
								className={inputStyle}
							/>
							<input
								type="text"
								value={outForm.eventTypes}
								onChange={(e) => setOutForm({ ...outForm, eventTypes: e.target.value })}
								placeholder="イベント (カンマ区切り)"
								className={inputStyle}
							/>
							<button
								type="button"
								onClick={() =>
									outForm.name &&
									outForm.url &&
									createOutMutation.mutate({
										...outForm,
										eventTypes: outForm.eventTypes
											.split(",")
											.map((s: string) => s.trim())
											.filter(Boolean),
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
						</>
					)}
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
							<th className={thStyle}>{tab === "incoming" ? "ソース" : "URL"}</th>
							<th className={thStyle}>状態</th>
							<th className={thStyle}>操作</th>
						</tr>
					</thead>
					<tbody className={css({ divideY: "1px", divideColor: "gray.100" })}>
						{(tab === "incoming" ? (incoming.data?.data ?? []) : (outgoing.data?.data ?? [])).map((w) => (
							<tr key={w.id} className={css({ _hover: { bg: "gray.50" } })}>
								<td className={css({ px: "4", py: "3", fontSize: "sm", fontWeight: "medium", color: "gray.900" })}>
									{w.name}
								</td>
								<td className={css({ px: "4", py: "3", fontSize: "xs", fontFamily: "mono", color: "gray.500" })}>
									{tab === "incoming" ? (w as IncomingWebhook).sourceType : (w as OutgoingWebhook).url}
								</td>
								<td className={css({ px: "4", py: "3" })}>
									<span
										className={css({
											borderRadius: "full",
											px: "2",
											py: "0.5",
											fontSize: "xs",
											bg: w.isActive ? "green.100" : "gray.100",
											color: w.isActive ? "green.700" : "gray.600",
										})}
									>
										{w.isActive ? "有効" : "無効"}
									</span>
								</td>
								<td className={css({ px: "4", py: "3" })}>
									<button
										type="button"
										onClick={() => (tab === "incoming" ? deleteInMutation : deleteOutMutation).mutate(w.id)}
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
