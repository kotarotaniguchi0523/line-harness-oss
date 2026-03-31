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
					"--normal-bg": "var(--popover)",
					"--normal-text": "var(--popover-foreground)",
					"--normal-border": "var(--border)",
					"--border-radius": "var(--radius)",
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
