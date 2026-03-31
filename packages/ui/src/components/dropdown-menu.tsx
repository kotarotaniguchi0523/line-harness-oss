"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { css, cx } from "../../styled-system/css";
import { CheckIcon, ChevronRightIcon } from "lucide-react";
import type * as React from "react";

// ---------------------------------------------------------------------------
// Shared style fragments
// ---------------------------------------------------------------------------

const menuItemBase = {
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
		backgroundColor: "accent",
		color: "accent.foreground",
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
} as const;

const overlayAnimation = {
	borderRadius: "0",
	backgroundColor: "popover",
	color: "popover.foreground",
	transitionDuration: "100ms",
	"&[data-side=bottom]": { transform: "translateY(-0.5rem)" },
	"&[data-side=top]": { transform: "translateY(0.5rem)" },
	"&[data-side=left], &[data-side=inline-start]": { transform: "translateX(0.5rem)" },
	"&[data-side=right], &[data-side=inline-end]": { transform: "translateX(-0.5rem)" },
	"&[data-open]": {
		animationName: "fade-in, zoom-in-95",
		animationDuration: "150ms",
		animationTimingFunction: "ease-out",
		animationFillMode: "both",
		transform: "none",
	},
	"&[data-closed]": {
		animationName: "fade-out, zoom-out-95",
		animationDuration: "150ms",
		animationTimingFunction: "ease-in",
		animationFillMode: "both",
		overflow: "hidden",
	},
} as const;

// ---------------------------------------------------------------------------
// Root / Portal / Trigger
// ---------------------------------------------------------------------------

function DropdownMenu({ ...props }: MenuPrimitive.Root.Props) {
	return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuPortal({ ...props }: MenuPrimitive.Portal.Props) {
	return <MenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />;
}

function DropdownMenuTrigger({ ...props }: MenuPrimitive.Trigger.Props) {
	return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

// ---------------------------------------------------------------------------
// Content (Popup)
// ---------------------------------------------------------------------------

const positionerStyle = css({
	isolation: "isolate",
	zIndex: 50,
	outline: "none",
});

const popupStyle = css({
	...overlayAnimation,
	zIndex: 50,
	maxHeight: "var(--available-height)",
	width: "var(--anchor-width)",
	minWidth: "8rem",
	transformOrigin: "var(--transform-origin)",
	overflowX: "hidden",
	overflowY: "auto",
	boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
	outline: "none",
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

// ---------------------------------------------------------------------------
// Group / Label
// ---------------------------------------------------------------------------

function DropdownMenuGroup({ ...props }: MenuPrimitive.Group.Props) {
	return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

const labelStyle = css({
	paddingLeft: "0.5rem",
	paddingRight: "0.5rem",
	paddingTop: "0.5rem",
	paddingBottom: "0.5rem",
	fontSize: "0.75rem",
	color: "muted.foreground",
	"&[data-inset]": {
		paddingLeft: "1.75rem",
	},
});

function DropdownMenuLabel({
	className,
	inset,
	...props
}: MenuPrimitive.GroupLabel.Props & { inset?: boolean }) {
	return (
		<MenuPrimitive.GroupLabel
			data-slot="dropdown-menu-label"
			data-inset={inset}
			className={cx(labelStyle, className)}
			{...props}
		/>
	);
}

// ---------------------------------------------------------------------------
// Item
// ---------------------------------------------------------------------------

const itemStyle = css({
	...menuItemBase,
	position: "relative",
	"&:not([data-variant=destructive]):focus *": {
		color: "accent.foreground",
	},
	"&[data-variant=destructive]": {
		color: "destructive",
	},
	"&[data-variant=destructive]:focus": {
		backgroundColor: "destructive.10",
		color: "destructive",
	},
	".dark &[data-variant=destructive]:focus": {
		backgroundColor: "destructive.20",
	},
	"&[data-variant=destructive] > svg": {
		color: "destructive",
	},
});

function DropdownMenuItem({
	className,
	inset,
	variant = "default",
	...props
}: MenuPrimitive.Item.Props & { inset?: boolean; variant?: "default" | "destructive" }) {
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

// ---------------------------------------------------------------------------
// Sub menu
// ---------------------------------------------------------------------------

function DropdownMenuSub({ ...props }: MenuPrimitive.SubmenuRoot.Props) {
	return <MenuPrimitive.SubmenuRoot data-slot="dropdown-menu-sub" {...props} />;
}

const subTriggerStyle = css({
	...menuItemBase,
	"&:not([data-variant=destructive]):focus *": {
		color: "accent.foreground",
	},
	"&[data-popup-open]": {
		backgroundColor: "accent",
		color: "accent.foreground",
	},
	"&[data-open]": {
		backgroundColor: "accent",
		color: "accent.foreground",
	},
});

const chevronStyle = css({ marginLeft: "auto" });

function DropdownMenuSubTrigger({
	className,
	inset,
	children,
	...props
}: MenuPrimitive.SubmenuTrigger.Props & { inset?: boolean }) {
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
	...overlayAnimation,
	width: "auto",
	minWidth: "96px",
	boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
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

// ---------------------------------------------------------------------------
// Checkbox / Radio items (shared selectable base)
// ---------------------------------------------------------------------------

const selectableItemStyle = css({
	...menuItemBase,
	position: "relative",
	paddingRight: "2rem",
	"&:focus *": {
		color: "accent.foreground",
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
}: MenuPrimitive.CheckboxItem.Props & { inset?: boolean }) {
	return (
		<MenuPrimitive.CheckboxItem
			data-slot="dropdown-menu-checkbox-item"
			data-inset={inset}
			className={cx(selectableItemStyle, className)}
			checked={checked}
			{...props}
		>
			<span className={indicatorSpanStyle} data-slot="dropdown-menu-checkbox-item-indicator">
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

function DropdownMenuRadioItem({
	className,
	children,
	inset,
	...props
}: MenuPrimitive.RadioItem.Props & { inset?: boolean }) {
	return (
		<MenuPrimitive.RadioItem
			data-slot="dropdown-menu-radio-item"
			data-inset={inset}
			className={cx(selectableItemStyle, className)}
			{...props}
		>
			<span className={indicatorSpanStyle} data-slot="dropdown-menu-radio-item-indicator">
				<MenuPrimitive.RadioItemIndicator>
					<CheckIcon />
				</MenuPrimitive.RadioItemIndicator>
			</span>
			{children}
		</MenuPrimitive.RadioItem>
	);
}

// ---------------------------------------------------------------------------
// Separator / Shortcut
// ---------------------------------------------------------------------------

const separatorStyle = css({
	marginLeft: "-0.25rem",
	marginRight: "-0.25rem",
	height: "1px",
	backgroundColor: "border",
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
	color: "muted.foreground",
	".group\\/dropdown-menu-item:focus &": {
		color: "accent.foreground",
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
