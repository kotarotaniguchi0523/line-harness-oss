import type * as React from "react";
import { css, cx } from "../../styled-system/css";

function Label({ className, ...props }: React.ComponentProps<"label">) {
	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: Abstract component — htmlFor is set by consumer
		<label
			data-slot="label"
			className={cx(
				css({
					display: "flex",
					alignItems: "center",
					gap: "0.5rem",
					fontSize: "0.75rem",
					lineHeight: "1",
					userSelect: "none",
					".group[data-disabled=true] &": {
						pointerEvents: "none",
						opacity: "0.5",
					},
					".peer:disabled ~ &": {
						cursor: "not-allowed",
						opacity: "0.5",
					},
				}),
				className,
			)}
			{...props}
		/>
	);
}

export { Label };
