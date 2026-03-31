import { Input as InputPrimitive } from "@base-ui/react/input";
import type * as React from "react";
import { css, cx } from "../../styled-system/css";

const inputStyle = css({
	height: "2rem",
	width: "100%",
	minWidth: "0",
	borderRadius: "0",
	borderWidth: "1px",
	borderStyle: "solid",
	borderColor: "input",
	backgroundColor: "transparent",
	paddingInline: "0.625rem",
	paddingBlock: "0.25rem",
	fontSize: "0.75rem",
	lineHeight: "1rem",
	transitionProperty: "color, background-color, border-color",
	transitionDuration: "150ms",
	outline: "none",
	"&::file-selector-button": {
		display: "inline-flex",
		height: "1.5rem",
		borderWidth: "0",
		backgroundColor: "transparent",
		fontSize: "0.75rem",
		fontWeight: "500",
		color: "foreground",
	},
	"&::placeholder": {
		color: "muted.foreground",
	},
	_focusVisible: {
		borderColor: "ring",
		ringWidth: "1px",
		ringColor: "ring.50",
	},
	_disabled: {
		pointerEvents: "none",
		cursor: "not-allowed",
		backgroundColor: "input.50",
		opacity: "0.5",
	},
	"&[aria-invalid=true]": {
		borderColor: "destructive",
		ringWidth: "1px",
		ringColor: "destructive.20",
	},
});

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
	return (
		<InputPrimitive
			type={type}
			data-slot="input"
			className={cx(inputStyle, className)}
			{...props}
		/>
	);
}

export { Input };
