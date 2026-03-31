import { cva } from "../../styled-system/css";

export const buttonVariants = cva({
	base: {
		display: "inline-flex",
		flexShrink: 0,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: "0",
		borderWidth: "1px",
		borderStyle: "solid",
		borderColor: "transparent",
		backgroundClip: "padding-box",
		fontSize: "xs",
		fontWeight: "medium",
		whiteSpace: "nowrap",
		transition: "all",
		outline: "none",
		userSelect: "none",
		cursor: "pointer",
		_focusVisible: {
			borderColor: "var(--ring)",
			ringWidth: "1px",
			ringColor: "var(--ring)",
		},
		_disabled: {
			pointerEvents: "none",
			opacity: 0.5,
		},
		"& svg": {
			pointerEvents: "none",
			flexShrink: 0,
		},
	},
	variants: {
		variant: {
			default: {
				backgroundColor: "var(--primary)",
				color: "var(--primary-foreground)",
				_hover: {
					backgroundColor: "color-mix(in srgb, var(--primary) 80%, transparent)",
				},
			},
			outline: {
				borderColor: "var(--border)",
				backgroundColor: "var(--background)",
				_hover: {
					backgroundColor: "var(--muted)",
					color: "var(--foreground)",
				},
			},
			secondary: {
				backgroundColor: "var(--secondary)",
				color: "var(--secondary-foreground)",
				_hover: {
					backgroundColor: "color-mix(in srgb, var(--secondary) 80%, transparent)",
				},
			},
			ghost: {
				_hover: {
					backgroundColor: "var(--muted)",
					color: "var(--foreground)",
				},
			},
			destructive: {
				backgroundColor: "color-mix(in srgb, var(--destructive) 10%, transparent)",
				color: "var(--destructive)",
				_hover: {
					backgroundColor: "color-mix(in srgb, var(--destructive) 20%, transparent)",
				},
				_focusVisible: {
					borderColor: "color-mix(in srgb, var(--destructive) 40%, transparent)",
					ringColor: "color-mix(in srgb, var(--destructive) 20%, transparent)",
				},
			},
			link: {
				color: "var(--primary)",
				textUnderlineOffset: "4px",
				_hover: {
					textDecoration: "underline",
				},
			},
		},
		size: {
			default: {
				height: "8",
				gap: "1.5",
				paddingInline: "2.5",
			},
			xs: {
				height: "6",
				gap: "1",
				borderRadius: "0",
				paddingInline: "2",
				fontSize: "xs",
			},
			sm: {
				height: "7",
				gap: "1",
				borderRadius: "0",
				paddingInline: "2.5",
			},
			lg: {
				height: "9",
				gap: "1.5",
				paddingInline: "2.5",
			},
			icon: {
				width: "8",
				height: "8",
			},
			"icon-xs": {
				width: "6",
				height: "6",
				borderRadius: "0",
			},
			"icon-sm": {
				width: "7",
				height: "7",
				borderRadius: "0",
			},
			"icon-lg": {
				width: "9",
				height: "9",
			},
		},
	},
	defaultVariants: {
		variant: "default",
		size: "default",
	},
});
