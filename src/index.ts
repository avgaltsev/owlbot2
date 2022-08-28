import {Bot} from "./bot";
import {getConfig} from "./config";
import {Poller} from "./poller";

export async function main(): Promise<void> {
	const config = await getConfig();

	const bot = new Bot(config.bot);
	const poller = new Poller(config.poller);

	poller.on("start", () => {
		bot.sendMessage("Polling started");
	});

	poller.on("liveStart", (liveStream) => {
		bot.sendMessage(`Live stream found: ${liveStream.title}`);
	});

	poller.on("liveSwitch", (oldLiveStream, newLiveStream) => {
		bot.sendMessage(`Live stream switched: from ${oldLiveStream.title} to ${newLiveStream.title}`);
	});

	poller.on("liveEnd", (liveStream) => {
		bot.sendMessage(`Live stream ended: ${liveStream.title}`);
	});
}
