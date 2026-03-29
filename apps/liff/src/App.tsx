import { useEffect, useState } from "react";
import { linkUser, trackClick } from "./api";
import { getFriendship, getIDToken, getProfile, initLiff, type LiffProfile } from "./liff";
import "./styles.css";

type PageState =
	| { type: "loading" }
	| { type: "friend-add"; profile: LiffProfile }
	| { type: "complete"; profile: LiffProfile; isRecovery: boolean }
	| { type: "error"; message: string };

const BOT_BASIC_ID = import.meta.env?.VITE_BOT_BASIC_ID || "";
const LEADING_SLASHES_PATTERN = /^\/+/;

export function App() {
	const [state, setState] = useState<PageState>({ type: "loading" });
	const params = new URLSearchParams(window.location.search);
	const ref = params.get("ref");
	const page = params.get("page") || window.location.pathname.replace(LEADING_SLASHES_PATTERN, "");

	useEffect(() => {
		void run();

		async function run() {
			try {
				await initLiff();

				// Page routing
				if (page === "book" || page === "form") {
					// Booking and Form pages will be separate components in future
					setState({ type: "error", message: `${page} page is under development` });
					return;
				}

				const [profile, idToken, friendship] = await Promise.all([
					getProfile(),
					Promise.resolve(getIDToken()),
					getFriendship(),
				]);

				// Background: link user + track attribution
				await linkUser(idToken, profile.displayName, ref);
				if (ref) await trackClick(ref);

				if (friendship.friendFlag) {
					setState({ type: "complete", profile, isRecovery: false });
					setTimeout(() => {
						const botId = import.meta.env?.VITE_BOT_BASIC_ID || "";
						window.location.href = `https://line.me/R/oaMessage/${botId}/`;
					}, 2000);
				} else {
					setState({ type: "friend-add", profile });
				}
			} catch (err) {
				const msg = err instanceof Error ? err.message : "エラーが発生しました";
				if (!msg.includes("Redirecting")) {
					setState({ type: "error", message: msg });
				}
			}
		}
	}, [page, ref]);

	switch (state.type) {
		case "loading":
			return <Loading />;
		case "friend-add":
			return (
				<FriendAdd
					profile={state.profile}
					onAdded={() => {
						setState({ type: "complete", profile: state.profile, isRecovery: false });
					}}
				/>
			);
		case "complete":
			return <Complete profile={state.profile} isRecovery={state.isRecovery} ref={ref} />;
		case "error":
			return <ErrorCard message={state.message} />;
		default:
			break;
	}
}

// ---------------------------------------------------------------------------
// Presentation Components
// ---------------------------------------------------------------------------

function Loading() {
	return (
		<div className="card">
			<div className="loading-spinner" />
			<p className="message">読み込み中...</p>
		</div>
	);
}

function FriendAdd({ profile, onAdded }: { profile: LiffProfile; onAdded: () => void }) {
	const friendAddUrl = BOT_BASIC_ID ? `https://line.me/R/ti/p/${BOT_BASIC_ID}` : "#";

	useEffect(() => {
		function handleVisibility() {
			if (document.visibilityState === "visible") {
				getFriendship()
					.then(({ friendFlag }) => {
						if (friendFlag) onAdded();
					})
					.catch(() => {
						/* intentionally empty */
					});
			}
		}
		document.addEventListener("visibilitychange", handleVisibility);
		return () => document.removeEventListener("visibilitychange", handleVisibility);
	}, [onAdded]);

	return (
		<div className="card">
			<Profile profile={profile} />
			<p className="message">まずは友だち追加をお願いします</p>
			<a href={friendAddUrl} className="add-friend-btn">
				友だち追加して始める
			</a>
			<p className="sub-message">追加後、この画面に戻ってきてください</p>
		</div>
	);
}

function Complete({ profile, isRecovery, ref }: { profile: LiffProfile; isRecovery: boolean; ref: string | null }) {
	return (
		<div className="card">
			<div className="check-icon">{isRecovery ? "🔄" : "✓"}</div>
			<h2>{isRecovery ? "おかえりなさい！" : "登録完了！"}</h2>
			<Profile profile={profile} />
			<p className="message">
				{isRecovery
					? "以前のアカウント情報を引き継ぎました。"
					: "ありがとうございます！これからお役立ち情報をお届けします。"}
				<br />
				このページは閉じて大丈夫です。
			</p>
			{ref && <p className="ref-badge">{ref}</p>}
		</div>
	);
}

function Profile({ profile }: { profile: LiffProfile }) {
	return (
		<div className="profile">
			{profile.pictureUrl && <img src={profile.pictureUrl} alt="" />}
			<p className="name">{profile.displayName} さん</p>
		</div>
	);
}

function ErrorCard({ message }: { message: string }) {
	return (
		<div className="card">
			<h2>エラー</h2>
			<p className="error">{message}</p>
		</div>
	);
}
