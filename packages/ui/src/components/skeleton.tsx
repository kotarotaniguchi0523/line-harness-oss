import { css, cx } from "../../styled-system/css";

const skeletonStyle = css({
	animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
	borderRadius: "0",
	backgroundColor: "muted",
});

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="skeleton"
			className={cx(skeletonStyle, className)}
			{...props}
		/>
	);
}

export { Skeleton };
