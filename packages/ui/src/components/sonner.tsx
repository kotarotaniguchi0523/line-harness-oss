"use client";

import { css } from "../../styled-system/css";
import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const iconStyle = css({
	width: "1rem",
	height: "1rem",
});

const spinnerStyle = css({
	width: "1rem",
	height: "1rem",
	animation: "spin 1s linear infinite",
});

const Toaster = ({ ...props }: ToasterProps) => {
	const { theme = "system" } = useTheme();

	return (
		<Sonner
			theme={theme as ToasterProps["theme"]}
			className="toaster group"
			icons={{
				success: <CircleCheckIcon className={iconStyle} />,
				info: <InfoIcon className={iconStyle} />,
				warning: <TriangleAlertIcon className={iconStyle} />,
				error: <OctagonXIcon className={iconStyle} />,
				loading: <Loader2Icon className={spinnerStyle} />,
			}}
			style={
				{
					"--normal-bg": "var(--colors-popover)",
					"--normal-text": "var(--colors-popover-foreground)",
					"--normal-border": "var(--colors-border)",
					"--border-radius": "var(--radii-none, 0)",
				} as React.CSSProperties
			}
			toastOptions={{
				classNames: {
					toast: "cn-toast",
				},
			}}
			{...props}
		/>
	);
};

export { Toaster };
