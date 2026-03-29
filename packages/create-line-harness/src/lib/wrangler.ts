import { execa } from "execa";

export class WranglerError extends Error {
	constructor(
		message: string,
		public readonly stderr: string,
	) {
		super(message);
		this.name = "WranglerError";
	}
}

export async function wrangler(args: string[], options?: { input?: string; cwd?: string }): Promise<string> {
	try {
		// biome-ignore lint/nursery/useAwaitThenable: execa v9 returns ResultPromise (a thenable)
		const result = await execa("npx", ["wrangler", ...args], {
			cwd: options?.cwd,
			input: options?.input,
			env: { ...process.env, FORCE_COLOR: "0" },
		});
		return result.stdout;
	} catch (error: unknown) {
		const err = error as { stderr?: string; message?: string };
		throw new WranglerError(`wrangler ${args[0]} failed: ${err.stderr || err.message}`, err.stderr || "");
	}
}

/**
 * Run wrangler with full stdio inheritance (for interactive commands like login).
 * Cannot capture output — use only when user interaction is needed.
 */
export async function wranglerInteractive(args: string[]): Promise<void> {
	// biome-ignore lint/nursery/useAwaitThenable: execa v9 returns ResultPromise (a thenable)
	await execa("npx", ["wrangler", ...args], {
		stdio: "inherit",
		env: { ...process.env, FORCE_COLOR: "1" },
	});
}

export async function isWranglerAuthenticated(): Promise<boolean> {
	try {
		const output = await wrangler(["whoami"]);
		return !output.toLowerCase().includes("not authenticated");
	} catch {
		return false;
	}
}
