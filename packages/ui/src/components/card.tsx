import { css, cx } from "../../styled-system/css";
import type * as React from "react";

const cardStyle = css({
	display: "flex",
	flexDirection: "column",
	gap: "1rem",
	overflow: "hidden",
	borderRadius: "0",
	backgroundColor: "card",
	paddingTop: "1rem",
	paddingBottom: "1rem",
	fontSize: "0.75rem",
	lineHeight: "1.75",
	color: "card.foreground",
	boxShadow: "inset 0 0 0 1px rgba(var(--foreground-rgb, 0 0 0) / 0.1)",
	ring: "1px",
	ringColor: "rgba(var(--foreground-rgb, 0 0 0) / 0.1)",
	"&:has([data-slot=card-footer])": {
		paddingBottom: "0",
	},
	"&:has(> img:first-child)": {
		paddingTop: "0",
	},
	"&[data-size=sm]": {
		gap: "0.5rem",
		paddingTop: "0.75rem",
		paddingBottom: "0.75rem",
	},
	"&[data-size=sm]:has([data-slot=card-footer])": {
		paddingBottom: "0",
	},
	"& > img:first-child": {
		borderRadius: "0",
	},
	"& > img:last-child": {
		borderRadius: "0",
	},
});

function Card({ className, size = "default", ...props }: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
	return (
		<div
			data-slot="card"
			data-size={size}
			className={cx("group/card", cardStyle, className)}
			{...props}
		/>
	);
}

const cardHeaderStyle = css({
	display: "grid",
	gridAutoRows: "min-content",
	alignItems: "start",
	gap: "0.25rem",
	borderRadius: "0",
	paddingLeft: "1rem",
	paddingRight: "1rem",
	containerType: "inline-size",
	containerName: "card-header",
	"&:has([data-slot=card-action])": {
		gridTemplateColumns: "1fr auto",
	},
	"&:has([data-slot=card-description])": {
		gridTemplateRows: "auto auto",
	},
	".group\\/card[data-size=sm] &": {
		paddingLeft: "0.75rem",
		paddingRight: "0.75rem",
	},
});

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-header"
			className={cx(cardHeaderStyle, className)}
			{...props}
		/>
	);
}

const cardTitleStyle = css({
	fontSize: "0.875rem",
	fontWeight: "500",
});

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-title"
			className={cx(cardTitleStyle, className)}
			{...props}
		/>
	);
}

const cardDescriptionStyle = css({
	fontSize: "0.75rem",
	lineHeight: "1.75",
	color: "muted.foreground",
});

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-description"
			className={cx(cardDescriptionStyle, className)}
			{...props}
		/>
	);
}

const cardActionStyle = css({
	gridColumnStart: "2",
	gridRow: "span 2 / span 2",
	gridRowStart: "1",
	alignSelf: "start",
	justifySelf: "end",
});

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-action"
			className={cx(cardActionStyle, className)}
			{...props}
		/>
	);
}

const cardContentStyle = css({
	paddingLeft: "1rem",
	paddingRight: "1rem",
	".group\\/card[data-size=sm] &": {
		paddingLeft: "0.75rem",
		paddingRight: "0.75rem",
	},
});

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-content"
			className={cx(cardContentStyle, className)}
			{...props}
		/>
	);
}

const cardFooterStyle = css({
	display: "flex",
	alignItems: "center",
	borderRadius: "0",
	borderTop: "1px solid var(--colors-border)",
	padding: "1rem",
	".group\\/card[data-size=sm] &": {
		padding: "0.75rem",
	},
});

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-footer"
			className={cx(cardFooterStyle, className)}
			{...props}
		/>
	);
}

export { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
