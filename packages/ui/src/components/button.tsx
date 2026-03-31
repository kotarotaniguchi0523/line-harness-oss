import { Button as ButtonPrimitive } from "@base-ui/react/button";
import type { RecipeVariantProps } from "../../styled-system/css";
import { cx } from "../../styled-system/css";
import { buttonVariants } from "./button-variants";

type ButtonVariantProps = RecipeVariantProps<typeof buttonVariants>;

function Button({
	className,
	variant = "default",
	size = "default",
	...props
}: ButtonPrimitive.Props & ButtonVariantProps) {
	return (
		<ButtonPrimitive
			data-slot="button"
			className={cx(buttonVariants({ variant, size }), className)}
			{...props}
		/>
	);
}

export { Button };
export type { ButtonVariantProps };
