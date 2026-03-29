import { Link } from "@tanstack/react-router";
import { css } from "../../styled-system/css";

import UserMenu from "./user-menu";

export default function Header() {
	const links = [
		{ to: "/", label: "Home" },
		{ to: "/dashboard", label: "Dashboard" },
	] as const;

	return (
		<div>
			<div
				className={css({
					display: "flex",
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					px: "2",
					py: "1",
				})}
			>
				<nav className={css({ display: "flex", gap: "4", fontSize: "lg" })}>
					{links.map(({ to, label }) => {
						return (
							<Link key={to} to={to}>
								{label}
							</Link>
						);
					})}
				</nav>
				<div className={css({ display: "flex", alignItems: "center", gap: "2" })}>
					<UserMenu />
				</div>
			</div>
			<hr />
		</div>
	);
}
