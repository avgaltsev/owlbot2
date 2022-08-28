import {Bot} from "./bot";
import {getConfig} from "./config";
import {Poller} from "./poller";

export async function main(): Promise<void> {
	const config = await getConfig();

	const bot = new Bot(config.bot);
	const poller = new Poller(config.poller);

	poller.on("start", () => {
		console.log("Polling started");
	});

	poller.on("liveStart", () => {
		console.log("Live stream found");
	});

	poller.on("liveEnd", () => {
		bot.sendMessage("Live stream ended");
	});
}
