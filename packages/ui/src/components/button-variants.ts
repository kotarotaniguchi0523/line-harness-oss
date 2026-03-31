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
			borderColor: "ring",
			ringWidth: "1px",
			ringColor: "ring",
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
				backgroundColor: "primary",
				color: "primary.foreground",
				_hover: {
					backgroundColor: "primary.80",
				},
			},
			outline: {
				borderColor: "border",
				backgroundColor: "background",
				_hover: {
					backgroundColor: "muted",
					color: "foreground",
				},
			},
			secondary: {
				backgroundColor: "secondary",
				color: "secondary.foreground",
				_hover: {
					backgroundColor: "secondary.80",
				},
			},
			ghost: {
				_hover: {
					backgroundColor: "muted",
					color: "foreground",
				},
			},
			destructive: {
				backgroundColor: "destructive.10",
				color: "destructive",
				_hover: {
					backgroundColor: "destructive.20",
				},
				_focusVisible: {
					borderColor: "destructive.40",
					ringColor: "destructive.20",
				},
			},
			link: {
				color: "primary",
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
