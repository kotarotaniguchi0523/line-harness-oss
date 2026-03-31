"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { css, cx } from "../../styled-system/css";
import { CheckIcon, ChevronRightIcon } from "lucide-react";
import type * as React from "react";

function DropdownMenu({ ...props }: MenuPrimitive.Root.Props) {
	return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuPortal({ ...props }: MenuPrimitive.Portal.Props) {
	return <MenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />;
}

function DropdownMenuTrigger({ ...props }: MenuPrimitive.Trigger.Props) {
	return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

const positionerStyle = css({
	isolation: "isolate",
	zIndex: 50,
	outline: "none",
});

const popupStyle = css({
	zIndex: 50,
	maxHeight: "var(--available-height)",
	width: "var(--anchor-width)",
	minWidth: "8rem",
	transformOrigin: "var(--transform-origin)",
	overflowX: "hidden",
	overflowY: "auto",
	borderRadius: "0",
	backgroundColor: "var(--popover)",
	color: "var(--popover-foreground)",
	boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
	outline: "none",
	transitionDuration: "100ms",
	"&[data-side=bottom]": {
		"--tw-enter-translate-y": "-0.5rem",
	},
	"&[data-side=inline-end]": {
		"--tw-enter-translate-x": "-0.5rem",
	},
	"&[data-side=inline-start]": {
		"--tw-enter-translate-x": "0.5rem",
	},
	"&[data-side=left]": {
		"--tw-enter-translate-x": "0.5rem",
	},
	"&[data-side=right]": {
		"--tw-enter-translate-x": "-0.5rem",
	},
	"&[data-side=top]": {
		"--tw-enter-translate-y": "0.5rem",
	},
	"&[data-open]": {
		animationName: "enter",
		animationDuration: "150ms",
		animationTimingFunction: "ease-out",
		opacity: 1,
		"--tw-enter-opacity": "0",
		"--tw-enter-scale": "0.95",
	},
	"&[data-closed]": {
		animationName: "exit",
		animationDuration: "150ms",
		animationTimingFunction: "ease-in",
		overflow: "hidden",
		"--tw-exit-opacity": "0",
		"--tw-exit-scale": "0.95",
	},
});

function DropdownMenuContent({
	align = "start",
	alignOffset = 0,
	side = "bottom",
	sideOffset = 4,
	className,
	...props
}: MenuPrimitive.Popup.Props & Pick<MenuPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">) {
	return (
		<MenuPrimitive.Portal>
			<MenuPrimitive.Positioner
				className={positionerStyle}
				align={align}
				alignOffset={alignOffset}
				side={side}
				sideOffset={sideOffset}
			>
				<MenuPrimitive.Popup
					data-slot="dropdown-menu-content"
					className={cx(popupStyle, className)}
					{...props}
				/>
			</MenuPrimitive.Positioner>
		</MenuPrimitive.Portal>
	);
}

function DropdownMenuGroup({ ...props }: MenuPrimitive.Group.Props) {
	return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

const labelStyle = css({
	paddingLeft: "0.5rem",
	paddingRight: "0.5rem",
	paddingTop: "0.5rem",
	paddingBottom: "0.5rem",
	fontSize: "0.75rem",
	color: "var(--muted-foreground)",
	"&[data-inset]": {
		paddingLeft: "1.75rem",
	},
});

function DropdownMenuLabel({
	className,
	inset,
	...props
}: MenuPrimitive.GroupLabel.Props & {
	inset?: boolean;
}) {
	return (
		<MenuPrimitive.GroupLabel
			data-slot="dropdown-menu-label"
			data-inset={inset}
			className={cx(labelStyle, className)}
			{...props}
		/>
	);
}

const itemStyle = css({
	position: "relative",
	display: "flex",
	cursor: "default",
	alignItems: "center",
	gap: "0.5rem",
	borderRadius: "0",
	paddingLeft: "0.5rem",
	paddingRight: "0.5rem",
	paddingTop: "0.5rem",
	paddingBottom: "0.5rem",
	fontSize: "0.75rem",
	outline: "none",
	userSelect: "none",
	"&:focus": {
		backgroundColor: "var(--accent)",
		color: "var(--accent-foreground)",
	},
	"&:not([data-variant=destructive]):focus *": {
		color: "var(--accent-foreground)",
	},
	"&[data-inset]": {
		paddingLeft: "1.75rem",
	},
	"&[data-variant=destructive]": {
		color: "var(--destructive)",
	},
	"&[data-variant=destructive]:focus": {
		backgroundColor: "color-mix(in srgb, var(--destructive) 10%, transparent)",
		color: "var(--destructive)",
	},
	".dark &[data-variant=destructive]:focus": {
		backgroundColor: "color-mix(in srgb, var(--destructive) 20%, transparent)",
	},
	"&[data-disabled]": {
		pointerEvents: "none",
		opacity: 0.5,
	},
	"& svg": {
		pointerEvents: "none",
		flexShrink: 0,
	},
	"& svg:not([class*='size-'])": {
		width: "1rem",
		height: "1rem",
	},
	"&[data-variant=destructive] > svg": {
		color: "var(--destructive)",
	},
});

function DropdownMenuItem({
	className,
	inset,
	variant = "default",
	...props
}: MenuPrimitive.Item.Props & {
	inset?: boolean;
	variant?: "default" | "destructive";
}) {
	return (
		<MenuPrimitive.Item
			data-slot="dropdown-menu-item"
			data-inset={inset}
			data-variant={variant}
			className={cx("group/dropdown-menu-item", itemStyle, className)}
			{...props}
		/>
	);
}

function DropdownMenuSub({ ...props }: MenuPrimitive.SubmenuRoot.Props) {
	return <MenuPrimitive.SubmenuRoot data-slot="dropdown-menu-sub" {...props} />;
}

const subTriggerStyle = css({
	display: "flex",
	cursor: "default",
	alignItems: "center",
	gap: "0.5rem",
	borderRadius: "0",
	paddingLeft: "0.5rem",
	paddingRight: "0.5rem",
	paddingTop: "0.5rem",
	paddingBottom: "0.5rem",
	fontSize: "0.75rem",
	outline: "none",
	userSelect: "none",
	"&:focus": {
		backgroundColor: "var(--accent)",
		color: "var(--accent-foreground)",
	},
	"&:not([data-variant=destructive]):focus *": {
		color: "var(--accent-foreground)",
	},
	"&[data-inset]": {
		paddingLeft: "1.75rem",
	},
	"&[data-popup-open]": {
		backgroundColor: "var(--accent)",
		color: "var(--accent-foreground)",
	},
	"&[data-open]": {
		backgroundColor: "var(--accent)",
		color: "var(--accent-foreground)",
	},
	"& svg": {
		pointerEvents: "none",
		flexShrink: 0,
	},
	"& svg:not([class*='size-'])": {
		width: "1rem",
		height: "1rem",
	},
});

const chevronStyle = css({
	marginLeft: "auto",
});

function DropdownMenuSubTrigger({
	className,
	inset,
	children,
	...props
}: MenuPrimitive.SubmenuTrigger.Props & {
	inset?: boolean;
}) {
	return (
		<MenuPrimitive.SubmenuTrigger
			data-slot="dropdown-menu-sub-trigger"
			data-inset={inset}
			className={cx(subTriggerStyle, className)}
			{...props}
		>
			{children}
			<ChevronRightIcon className={chevronStyle} />
		</MenuPrimitive.SubmenuTrigger>
	);
}

const subContentStyle = css({
	width: "auto",
	minWidth: "96px",
	borderRadius: "0",
	backgroundColor: "var(--popover)",
	color: "var(--popover-foreground)",
	boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
	transitionDuration: "100ms",
	"&[data-side=bottom]": {
		"--tw-enter-translate-y": "-0.5rem",
	},
	"&[data-side=left]": {
		"--tw-enter-translate-x": "0.5rem",
	},
	"&[data-side=right]": {
		"--tw-enter-translate-x": "-0.5rem",
	},
	"&[data-side=top]": {
		"--tw-enter-translate-y": "0.5rem",
	},
	"&[data-open]": {
		animationName: "enter",
		animationDuration: "150ms",
		animationTimingFunction: "ease-out",
		opacity: 1,
		"--tw-enter-opacity": "0",
		"--tw-enter-scale": "0.95",
	},
	"&[data-closed]": {
		animationName: "exit",
		animationDuration: "150ms",
		animationTimingFunction: "ease-in",
		"--tw-exit-opacity": "0",
		"--tw-exit-scale": "0.95",
	},
});

function DropdownMenuSubContent({
	align = "start",
	alignOffset = -3,
	side = "right",
	sideOffset = 0,
	className,
	...props
}: React.ComponentProps<typeof DropdownMenuContent>) {
	return (
		<DropdownMenuContent
			data-slot="dropdown-menu-sub-content"
			className={cx(subContentStyle, className)}
			align={align}
			alignOffset={alignOffset}
			side={side}
			sideOffset={sideOffset}
			{...props}
		/>
	);
}

const checkboxItemStyle = css({
	position: "relative",
	display: "flex",
	cursor: "default",
	alignItems: "center",
	gap: "0.5rem",
	borderRadius: "0",
	paddingTop: "0.5rem",
	paddingBottom: "0.5rem",
	paddingRight: "2rem",
	paddingLeft: "0.5rem",
	fontSize: "0.75rem",
	outline: "none",
	userSelect: "none",
	"&:focus": {
		backgroundColor: "var(--accent)",
		color: "var(--accent-foreground)",
	},
	"&:focus *": {
		color: "var(--accent-foreground)",
	},
	"&[data-inset]": {
		paddingLeft: "1.75rem",
	},
	"&[data-disabled]": {
		pointerEvents: "none",
		opacity: 0.5,
	},
	"& svg": {
		pointerEvents: "none",
		flexShrink: 0,
	},
	"& svg:not([class*='size-'])": {
		width: "1rem",
		height: "1rem",
	},
});

const indicatorSpanStyle = css({
	pointerEvents: "none",
	position: "absolute",
	right: "0.5rem",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
});

function DropdownMenuCheckboxItem({
	className,
	children,
	checked,
	inset,
	...props
}: MenuPrimitive.CheckboxItem.Props & {
	inset?: boolean;
}) {
	return (
		<MenuPrimitive.CheckboxItem
			data-slot="dropdown-menu-checkbox-item"
			data-inset={inset}
			className={cx(checkboxItemStyle, className)}
			checked={checked}
			{...props}
		>
			<span
				className={indicatorSpanStyle}
				data-slot="dropdown-menu-checkbox-item-indicator"
			>
				<MenuPrimitive.CheckboxItemIndicator>
					<CheckIcon />
				</MenuPrimitive.CheckboxItemIndicator>
			</span>
			{children}
		</MenuPrimitive.CheckboxItem>
	);
}

function DropdownMenuRadioGroup({ ...props }: MenuPrimitive.RadioGroup.Props) {
	return <MenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />;
}

const radioItemStyle = css({
	position: "relative",
	display: "flex",
	cursor: "default",
	alignItems: "center",
	gap: "0.5rem",
	borderRadius: "0",
	paddingTop: "0.5rem",
	paddingBottom: "0.5rem",
	paddingRight: "2rem",
	paddingLeft: "0.5rem",
	fontSize: "0.75rem",
	outline: "none",
	userSelect: "none",
	"&:focus": {
		backgroundColor: "var(--accent)",
		color: "var(--accent-foreground)",
	},
	"&:focus *": {
		color: "var(--accent-foreground)",
	},
	"&[data-inset]": {
		paddingLeft: "1.75rem",
	},
	"&[data-disabled]": {
		pointerEvents: "none",
		opacity: 0.5,
	},
	"& svg": {
		pointerEvents: "none",
		flexShrink: 0,
	},
	"& svg:not([class*='size-'])": {
		width: "1rem",
		height: "1rem",
	},
});

function DropdownMenuRadioItem({
	className,
	children,
	inset,
	...props
}: MenuPrimitive.RadioItem.Props & {
	inset?: boolean;
}) {
	return (
		<MenuPrimitive.RadioItem
			data-slot="dropdown-menu-radio-item"
			data-inset={inset}
			className={cx(radioItemStyle, className)}
			{...props}
		>
			<span
				className={indicatorSpanStyle}
				data-slot="dropdown-menu-radio-item-indicator"
			>
				<MenuPrimitive.RadioItemIndicator>
					<CheckIcon />
				</MenuPrimitive.RadioItemIndicator>
			</span>
			{children}
		</MenuPrimitive.RadioItem>
	);
}

const separatorStyle = css({
	marginLeft: "-0.25rem",
	marginRight: "-0.25rem",
	height: "1px",
	backgroundColor: "var(--border)",
});

function DropdownMenuSeparator({ className, ...props }: MenuPrimitive.Separator.Props) {
	return (
		<MenuPrimitive.Separator
			data-slot="dropdown-menu-separator"
			className={cx(separatorStyle, className)}
			{...props}
		/>
	);
}

const shortcutStyle = css({
	marginLeft: "auto",
	fontSize: "0.75rem",
	letterSpacing: "0.1em",
	color: "var(--muted-foreground)",
	".group\\/dropdown-menu-item:focus &": {
		color: "var(--accent-foreground)",
	},
});

function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="dropdown-menu-shortcut"
			className={cx(shortcutStyle, className)}
			{...props}
		/>
	);
}

export {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuPortal,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
};
