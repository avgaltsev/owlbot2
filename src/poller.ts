import {Json, JsonObject, isJsonObject, isJsonArray, getJsonValue} from "@somethings/json";

import {PollerConfig} from "./config";
import {requestJson} from "./request-json";

import * as settings from "./json/settings.json";
import {Emitter} from "./emitter";
import {Chromium} from "./chromium";

interface TemplateValues {
	[name: string]: string;
}

function expandTemplate(template: string, values: TemplateValues): string {
	return Object.entries(values).reduce((result, [name, value]) => {
		return result.replace(`%${name}`, value);
	}, template);
}

interface Session {
	apiKey: string;
	context: JsonObject;
	channelId: string;
}

const GET_SESSION = `
	(function () {
		return {
			apiKey: ytcfg.data_.INNERTUBE_API_KEY,
			context: ytcfg.data_.INNERTUBE_CONTEXT,
			channelId: ytInitialData.metadata.channelMetadataRenderer.externalId,
		};
	})();
`;

interface LiveStream {
	id: string;
	title: string;
	url: string;
}

interface PollerEvents {
	error: (parameters: {
		error: string;
	}) => void;

	start: (parameters: {
		settings: typeof settings;
		config: PollerConfig;
	}) => void;

	poll: () => void;

	pollSuccess: () => void;

	pollError: (parameters: {
		error: string;
	}) => void;

	liveStreamStart: (parameters: {
		liveStream: LiveStream;
	}) => void;

	liveStreamSwitch: (parameters: {
		oldLiveStream: LiveStream;
		newLiveStream: LiveStream;

	}) => void;

	liveStreamUpdate: (parameters: {
		oldLiveStream: LiveStream;
		newLiveStream: LiveStream;

	}) => void;

	liveStreamEnd: (parameters: {
		liveStream: LiveStream;
	}) => void;
}

export class Poller{
	private emitter = new Emitter<PollerEvents>();

	private sessionPromise: Promise<Session> | null = null;

	private liveStream: LiveStream | null = null;

	public constructor(
		private config: PollerConfig,
		private browser: Chromium,
	) {
		setImmediate(() => {
			this.start();
		});
	}

	public on<T extends keyof PollerEvents>(eventName: T, listener: PollerEvents[T]): void {
		this.emitter.on(eventName, listener);
	}

	private start(): void {
		this.emitter.emit("start", {
			settings,
			config: this.config,
		});

		setImmediate(() => {
			this.poll();
		});

		setInterval(() => {
			this.poll();
		}, this.config.pollInterval);
	}

	private getSession(): Promise<Session> {
		if (this.sessionPromise === null) {
			this.sessionPromise = this.createSession();
		}

		return this.sessionPromise;
	}

	private async createSession(): Promise<Session> {
		const browser = await this.browser.getBrowser();
		const page = await browser.newPage();

		const url = expandTemplate(settings.channelUrl, {
			channelName: this.config.channelName,
		});

		await page.goto(url);

		const session = await page.evaluate(GET_SESSION) as Session;

		page.close();

		return session;
	}

	private async poll(): Promise<void> {
		this.emitter.emit("poll");

		let tabContents: Array<Json>;

		try {
			tabContents = await Promise.all(settings.apiParamsList.map((apiParams) => this.getTabContent(apiParams)));

			this.emitter.emit("pollSuccess");
		} catch (error) {
			this.emitter.emit("pollError", {
				error: error as string,
			});

			return;
		}

		const videos = tabContents.flatMap((tabContent) => this.extractVideos(tabContent));

		const liveVideos = videos.filter((video) => {
			const thumbnailOverlays = video["thumbnailOverlays"];

			if (thumbnailOverlays === undefined || !isJsonArray(thumbnailOverlays)) {
				return false;
			}

			const liveOverlay = thumbnailOverlays.find((thumbnailOverlay) => {
				if (
					!isJsonObject(thumbnailOverlay) ||
					thumbnailOverlay["thumbnailOverlayTimeStatusRenderer"] === undefined ||
					!isJsonObject(thumbnailOverlay["thumbnailOverlayTimeStatusRenderer"])
				) {
					return false;
				}

				return thumbnailOverlay["thumbnailOverlayTimeStatusRenderer"]["style"] === "LIVE";
			});

			return liveOverlay !== undefined;
		});

		if (liveVideos.length > 1) {
			this.emitter.emit("error", {
				error: "More than 1 live videos found, picking the first one.",
			});
		}

		const liveVideo = liveVideos[0];

		if (liveVideo !== undefined && isJsonObject(liveVideo)) {
			const newLiveStream: LiveStream = {
				id: String(getJsonValue(liveVideo, ["videoId"])),
				title: String(getJsonValue(liveVideo, ["title", "runs", 0, "text"])),
				url: String(getJsonValue(liveVideo, ["navigationEndpoint", "commandMetadata", "webCommandMetadata", "url"])),
			};

			if (this.liveStream !== null) {
				if (this.liveStream.id !== newLiveStream.id) {
					this.emitter.emit("liveStreamSwitch", {
						oldLiveStream: this.liveStream,
						newLiveStream: newLiveStream,
					});
				} else if (this.liveStream.title !== newLiveStream.title) {
					this.emitter.emit("liveStreamUpdate", {
						oldLiveStream: this.liveStream,
						newLiveStream: newLiveStream,
					});
				}
			} else {
				this.emitter.emit("liveStreamStart", {
					liveStream: newLiveStream,
				});
			}

			this.liveStream = newLiveStream;
		} else {
			if (this.liveStream !== null) {
				this.emitter.emit("liveStreamEnd", {
					liveStream: this.liveStream,
				});
			}

			this.liveStream = null;
		}
	}

	private async getTabContent(apiParams: string): Promise<Json> {
		const session = await this.getSession();

		const path = expandTemplate(settings.apiPath, {
			apiKey: session.apiKey,
		});

		const requestParameters = {
			host: settings.apiHost,
			path,
			method: "POST",
		};

		const requestPayload = {
			context: session.context,
			browseId: session.channelId,
			params: apiParams,
		};

		return requestJson(requestParameters, requestPayload);
	}

	private extractVideos(content: Json): Array<JsonObject> {
		if (isJsonObject(content)) {
			if (content["videoId"] !== undefined && content["thumbnailOverlays"] !== undefined) {
				return [content];
			}

			return Object.values(content).flatMap((value) => this.extractVideos(value));
		}

		if (isJsonArray(content)) {
			return content.flatMap((item) => this.extractVideos(item));
		}

		return [];
	}
}
