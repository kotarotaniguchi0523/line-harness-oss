/**
 * BAN検知モニター — cronトリガーで定期実行
 *
 * LINE APIのエラー率を監視し、BAN リスクを検出する
 * 403/429 エラーのパターンを分析してリスクレベルを判定
 */

import { createDb, createHealthRepository, createLineAccountRepository } from "@line-crm/db";
import { messagesLog } from "@line-crm/db/schema";
import { and, eq, sql } from "drizzle-orm";

export async function checkAccountHealth(db: D1Database): Promise<void> {
	const drizzle = createDb(db);
	const accountRepo = createLineAccountRepository(drizzle);
	const accounts = await accountRepo.list();

	for (const account of accounts) {
		if (!account.isActive) continue;

		try {
			await checkSingleAccount(db, account);
		} catch (err) {
			console.error(`ヘルスチェックエラー (account ${account.id}):`, err);
		}
	}
}

async function checkSingleAccount(db: D1Database, account: { id: string; channelAccessToken: string }): Promise<void> {
	const jstMs = Date.now() + 9 * 60 * 60_000;
	const now = new Date(jstMs);
	const checkPeriod = `${now.toISOString().slice(0, -1)}+09:00`;

	// 直近1時間のメッセージログからエラーパターンを推定
	// (実際のLINE APIエラーはログに残らないが、送信成功率から推定)
	const oneHourAgo = `${new Date(jstMs - 60 * 60_000).toISOString().slice(0, -1)}+09:00`;

	const drizzle = createDb(db);
	const healthRepo = createHealthRepository(drizzle);
	const [sentMessages] = await drizzle
		.select({ count: sql<number>`count(*)` })
		.from(messagesLog)
		.where(and(eq(messagesLog.direction, "outgoing"), sql`${messagesLog.createdAt} >= ${oneHourAgo}`));

	const totalSent = sentMessages?.count ?? 0;

	// LINE APIにヘルスチェックリクエスト
	let errorCode: number | null = null;
	let errorCount = 0;

	try {
		const response = await fetch("https://api.line.me/v2/bot/info", {
			headers: { Authorization: `Bearer ${account.channelAccessToken}` },
		});

		if (!response.ok) {
			errorCode = response.status;
			errorCount = 1;
		}
	} catch {
		errorCode = 0; // ネットワークエラー
		errorCount = 1;
	}

	// リスクレベル判定
	let riskLevel = "normal";
	if (errorCode === 403) {
		riskLevel = "danger"; // BAN の可能性
	} else if (errorCode === 429) {
		riskLevel = "warning"; // レート制限
	} else if (totalSent > 5000) {
		riskLevel = "warning"; // 大量送信の警告
	}
	await healthRepo.createLog({
		lineAccountId: account.id,
		errorCode: errorCode ?? undefined,
		errorCount,
		checkPeriod,
		riskLevel,
	});

	if (riskLevel === "danger") {
		console.error(`⚠️ BAN検知: アカウント ${account.id} で403エラー発生。即座に確認が必要。`);
	}
}
