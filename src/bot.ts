import Api from "@somethings/telegram-bot-api/Api";
import {SendPhotoParameters} from "@somethings/telegram-bot-api/AbstractApi";

import {BotConfig} from "./config";

export class Bot {
	private api: Api;

	public constructor(
		private config: BotConfig,
	) {
		this.api = new Api(this.config.token);
	}

	public sendMessage(message: string): void {
		this.api.sendMessage({
			chat_id: this.config.chatId,
			text: message,
		});
	}

	public sendScreenshots(screenshotGroup: Array<Buffer>, message?: string): void {
		screenshotGroup.forEach((screenshot) => {
			const options: SendPhotoParameters = {
				chat_id: this.config.chatId,
				photo: {
					name: "screenshot",
					contentType: "image/jpeg",
					content: screenshot,
				},
			};

			if (message !== undefined) {
				options.caption = message;
			}

			this.api.sendPhoto(options);
		});
	}

	// TODO: Implement queue to make next call only after the previous one is finished.

	// TODO: Send screenshots in albums.
}
