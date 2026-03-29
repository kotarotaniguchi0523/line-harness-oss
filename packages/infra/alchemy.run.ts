import alchemy from "alchemy";
import { D1Database, TanStackStart, Worker } from "alchemy/cloudflare";
import { config } from "dotenv";

config({ path: "./.env" });
config({ path: "../../apps/web/.env" });
config({ path: "../../apps/server/.env" });

const app = await alchemy("line-harness-new");

const db = await D1Database("database", {
	migrationsDir: "../../packages/db/src/migrations",
});

export const web = await TanStackStart("web", {
	cwd: "../../apps/web",
	bindings: {
		VITE_SERVER_URL: alchemy.env.VITE_SERVER_URL as string,
		DB: db,
		CORS_ORIGIN: alchemy.env.CORS_ORIGIN as string,
		BETTER_AUTH_SECRET: alchemy.secret.env.BETTER_AUTH_SECRET as string,
		BETTER_AUTH_URL: alchemy.env.BETTER_AUTH_URL as string,
	},
});

export const server = await Worker("server", {
	cwd: "../../apps/server",
	entrypoint: "src/index.ts",
	compatibility: "node",
	bindings: {
		DB: db,
		CORS_ORIGIN: alchemy.env.CORS_ORIGIN as string,
		BETTER_AUTH_SECRET: alchemy.secret.env.BETTER_AUTH_SECRET as string,
		BETTER_AUTH_URL: alchemy.env.BETTER_AUTH_URL as string,
	},
	dev: {
		port: 3000,
	},
});

console.log(`Web    -> ${web.url}`);
console.log(`Server -> ${server.url}`);

await app.finalize();
