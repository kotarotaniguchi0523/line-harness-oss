import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { css } from "../../../styled-system/css";
import { healthQueryOptions } from "../../lib/query-config";

export const Route = createFileRoute("/_authed/health")({ component: HealthPage });

const riskStyles: Record<string, { bg: string; color: string; animation?: string }> = {
	normal: { bg: "green.100", color: "green.700" },
	warning: { bg: "yellow.100", color: "yellow.700" },
	danger: { bg: "red.100", color: "red.700", animation: "pulse" },
};

function HealthPage() {
	const accounts = useQuery(healthQueryOptions.lineAccounts());
	const migrations = useQuery(healthQueryOptions.migrations());

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
			<h1 className={css({ mb: "6", fontSize: "2xl", fontWeight: "bold", color: "gray.900" })}>
				BAN検知 & アカウントヘルス
			</h1>
			<div className={css({ display: "grid", gridTemplateColumns: { base: "1", sm: "2", lg: "3" }, gap: "4" })}>
				{(accounts.data?.data ?? []).map((a) => {
					const risk = riskStyles[a.riskLevel] ?? riskStyles.normal;
					return (
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
										h: "10",
										w: "10",
										alignItems: "center",
										justifyContent: "center",
										borderRadius: "full",
										bg: "line.green",
										color: "white",
										fontWeight: "bold",
									})}
								>
									{a.name?.charAt(0) ?? "?"}
								</div>
								<div>
									<p className={css({ fontSize: "sm", fontWeight: "medium", color: "gray.900" })}>{a.name}</p>
									<p className={css({ fontSize: "xs", color: "gray.400" })}>{a.channelId}</p>
								</div>
							</div>
							<span
								className={css({
									borderRadius: "full",
									px: "2",
									py: "0.5",
									fontSize: "xs",
									fontWeight: "medium",
									bg: risk.bg,
									color: risk.color,
									animation: risk.animation,
								})}
							>
								{a.riskLevel ?? "normal"}
							</span>
						</div>
					);
				})}
			</div>
			{(migrations.data?.data ?? []).length > 0 && (
				<div className={css({ mt: "8" })}>
					<h2 className={css({ mb: "4", fontSize: "lg", fontWeight: "semibold", color: "gray.900" })}>
						マイグレーション履歴
					</h2>
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
									<th className={thStyle}>移行元</th>
									<th className={thStyle}>移行先</th>
									<th className={thStyle}>ステータス</th>
									<th className={thStyle}>進捗</th>
								</tr>
							</thead>
							<tbody className={css({ divideY: "1px", divideColor: "gray.100" })}>
								{(migrations.data?.data ?? []).map((m) => (
									<tr key={m.id}>
										<td className={css({ px: "4", py: "3", fontSize: "sm" })}>{m.fromAccountId}</td>
										<td className={css({ px: "4", py: "3", fontSize: "sm" })}>{m.toAccountId}</td>
										<td className={css({ px: "4", py: "3" })}>
											<span className={css({ fontSize: "xs" })}>{m.status}</span>
										</td>
										<td className={css({ px: "4", py: "3", fontSize: "sm" })}>
											{m.migratedCount}/{m.totalCount}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}
		</div>
	);
}
