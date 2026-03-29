import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { css } from "../../../styled-system/css";
import { affiliatesQueryOptions } from "../../lib/query-config";

export const Route = createFileRoute("/_authed/affiliates")({ component: AffiliatesPage });

function AffiliatesPage() {
	const _queryClient = useQueryClient();
	const refStats = useQuery(affiliatesQueryOptions.refStats());

	const stats = refStats.data?.data;
	const thStyle = css({
		px: "4",
		py: "3",
		textAlign: "left",
		fontSize: "xs",
		fontWeight: "medium",
		textTransform: "uppercase",
		color: "gray.500",
	});
	const thRightStyle = css({
		px: "4",
		py: "3",
		textAlign: "right",
		fontSize: "xs",
		fontWeight: "medium",
		textTransform: "uppercase",
		color: "gray.500",
	});

	return (
		<div>
			<h1 className={css({ mb: "6", fontSize: "2xl", fontWeight: "bold", color: "gray.900" })}>
				アフィリエイト / 流入分析
			</h1>
			{stats && (
				<div className={css({ mb: "6", display: "grid", gridTemplateColumns: { base: "2", lg: "4" }, gap: "4" })}>
					<div
						className={css({ borderRadius: "lg", borderWidth: "1px", borderColor: "gray.200", bg: "white", p: "4" })}
					>
						<p className={css({ fontSize: "sm", color: "gray.500" })}>友だち総数</p>
						<p className={css({ fontSize: "2xl", fontWeight: "bold" })}>{stats.totalFriends ?? 0}</p>
					</div>
					<div
						className={css({ borderRadius: "lg", borderWidth: "1px", borderColor: "gray.200", bg: "white", p: "4" })}
					>
						<p className={css({ fontSize: "sm", color: "gray.500" })}>Ref経由</p>
						<p className={css({ fontSize: "2xl", fontWeight: "bold", color: "green.600" })}>
							{stats.friendsWithRef ?? 0}
						</p>
					</div>
					<div
						className={css({ borderRadius: "lg", borderWidth: "1px", borderColor: "gray.200", bg: "white", p: "4" })}
					>
						<p className={css({ fontSize: "sm", color: "gray.500" })}>Ref不明</p>
						<p className={css({ fontSize: "2xl", fontWeight: "bold", color: "gray.400" })}>
							{stats.friendsWithoutRef ?? 0}
						</p>
					</div>
					<div
						className={css({ borderRadius: "lg", borderWidth: "1px", borderColor: "gray.200", bg: "white", p: "4" })}
					>
						<p className={css({ fontSize: "sm", color: "gray.500" })}>経路数</p>
						<p className={css({ fontSize: "2xl", fontWeight: "bold" })}>{stats.routes?.length ?? 0}</p>
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
							<th className={thStyle}>Refコード</th>
							<th className={thStyle}>経路名</th>
							<th className={thRightStyle}>友だち数</th>
							<th className={thRightStyle}>クリック数</th>
						</tr>
					</thead>
					<tbody className={css({ divideY: "1px", divideColor: "gray.100" })}>
						{(stats?.routes ?? []).map((r) => (
							<tr key={r.refCode} className={css({ _hover: { bg: "gray.50" } })}>
								<td className={css({ px: "4", py: "3", fontSize: "sm", fontFamily: "mono", color: "blue.600" })}>
									{r.refCode}
								</td>
								<td className={css({ px: "4", py: "3", fontSize: "sm", color: "gray.900" })}>{r.routeName ?? "—"}</td>
								<td className={css({ px: "4", py: "3", textAlign: "right", fontSize: "sm", fontWeight: "medium" })}>
									{r.friendCount}
								</td>
								<td className={css({ px: "4", py: "3", textAlign: "right", fontSize: "sm", color: "gray.600" })}>
									{r.clickCount ?? 0}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
