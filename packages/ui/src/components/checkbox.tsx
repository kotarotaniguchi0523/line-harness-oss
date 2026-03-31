"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { CheckIcon } from "lucide-react";
import { css, cx } from "../../styled-system/css";

const checkboxRootStyle = css({
	position: "relative",
	display: "flex",
	width: "1rem",
	height: "1rem",
	flexShrink: "0",
	alignItems: "center",
	justifyContent: "center",
	borderRadius: "0",
	borderWidth: "1px",
	borderStyle: "solid",
	borderColor: "input",
	transitionProperty: "color, background-color, border-color",
	transitionDuration: "150ms",
	outline: "none",
	".group\\/field:has(:disabled) &": {
		opacity: "0.5",
	},
	"&::after": {
		content: '""',
		position: "absolute",
		insetInline: "-0.75rem",
		insetBlock: "-0.5rem",
	},
	_focusVisible: {
		borderColor: "ring",
		ringWidth: "1px",
		ringColor: "ring.50",
	},
	_disabled: {
		cursor: "not-allowed",
		opacity: "0.5",
	},
	"&[aria-invalid=true]": {
		borderColor: "destructive",
		ringWidth: "1px",
		ringColor: "destructive.20",
	},
	"&[aria-invalid=true][aria-checked=true]": {
		borderColor: "primary",
	},
	"&[data-checked]": {
		borderColor: "primary",
		backgroundColor: "primary",
		color: "primary.foreground",
	},
});

const checkboxIndicatorStyle = css({
	display: "grid",
	placeContent: "center",
	color: "currentColor",
	transitionProperty: "none",
	"& > svg": {
		width: "0.875rem",
		height: "0.875rem",
	},
});

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
	return (
		<CheckboxPrimitive.Root
			data-slot="checkbox"
			className={cx(checkboxRootStyle, className)}
			{...props}
		>
			<CheckboxPrimitive.Indicator
				data-slot="checkbox-indicator"
				className={checkboxIndicatorStyle}
			>
				<CheckIcon />
			</CheckboxPrimitive.Indicator>
		</CheckboxPrimitive.Root>
	);
}

export { Checkbox };
