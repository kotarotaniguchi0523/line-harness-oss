import { Loader2 } from "lucide-react";
import { css } from "../../styled-system/css";

export default function Loader() {
	return (
		<div className={css({ display: "flex", h: "full", alignItems: "center", justifyContent: "center", pt: "8" })}>
			<Loader2 className={css({ animation: "spin" })} />
		</div>
	);
}
