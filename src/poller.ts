import {PollerConfig} from "./config";
import {launch, Browser} from "puppeteer";
import {EventEmitter} from "stream";
import {request, Agent} from "https";

import * as settings from "./json/settings.json";
import * as pollRequestPayload from "./json/poll-request-payload.json";

interface TemplateValues {
	[name: string]: string;
}

function expandTemplate(template: string, values: TemplateValues): string {
	return Object.entries(values).reduce((result, [name, value]) => {
		return result.replace(`%${name}`, value);
	}, template);
}

interface Session extends TemplateValues {
	apiKey: string;
	channelId: string;
}

interface LiveStream {
	id: string;
	title: string;
	url: string;
}

const INJECTED_CODE = `
	(function () {
		return {
			apiKey: ytcfg.data_.INNERTUBE_API_KEY,
			channelId: ytInitialData.metadata.channelMetadataRenderer.externalId,
		};
	})();
`;

interface PollerEvents {
	start: () => void;
	liveStart: (liveStream: LiveStream) => void;
	liveSwitch: (oldLiveStream: LiveStream, newLiveStream: LiveStream) => void;
	liveEnd: (liveStream: LiveStream) => void;
}

interface PollerEventEmitter {
	addListener<T extends keyof PollerEvents>(eventName: T, listener: PollerEvents[T]): this;
	removeListener<T extends keyof PollerEvents>(eventName: T, listener: PollerEvents[T]): this;
	on<T extends keyof PollerEvents>(eventName: T, listener: PollerEvents[T]): this;
	once<T extends keyof PollerEvents>(eventName: T, listener: PollerEvents[T]): this;
	off<T extends keyof PollerEvents>(eventName: T, listener: PollerEvents[T]): this;
	emit<T extends keyof PollerEvents>(eventName: T, ...args: Parameters<PollerEvents[T]>): boolean;
}

class PollerEventEmitter extends EventEmitter {
}

interface PollerEmitter {
	on<T extends keyof PollerEvents>(eventName: T, listener: PollerEvents[T]): void;
}

export class Poller implements PollerEmitter {
	private emitter = new PollerEventEmitter();

	private browserPromise: Promise<Browser> | null = null;
	private sessionPromise: Promise<Session> | null = null;

	private liveStream: LiveStream | null = null;

	public constructor(
		private config: PollerConfig,
	) {
		setImmediate(() => {
			this.start();
		});
	}

	public on<T extends keyof PollerEvents>(eventName: T, listener: PollerEvents[T]): void {
		this.emitter.on(eventName, listener);
	}

	private async start(): Promise<void> {
		this.emitter.emit("start");

		setImmediate(() => {
			this.poll();
		});

		setInterval(() => {
			this.poll();
		}, this.config.pollInterval);
	}

	private getBrowser(): Promise<Browser> {
		if (this.browserPromise === null) {
			this.browserPromise = this.createBrowser();
		}

		return this.browserPromise;
	}

	private async createBrowser(): Promise<Browser> {
		return launch();
	}

	private getSession(): Promise<Session> {
		if (this.sessionPromise === null) {
			this.sessionPromise = this.createSession();
		}

		return this.sessionPromise;
	}

	private async createSession(): Promise<Session> {
		const browser = await this.getBrowser();
		const page = await browser.newPage();

		const url = await this.expandTemplateWithLocalValues(settings.channelUrl);

		await page.goto(url);

		const session = await page.evaluate(INJECTED_CODE) as Session;

		page.close();

		return session;
	}

	private async poll(): Promise<void> {
		const pollResponse = await this.request();

		const liveStreamResponse = this.getLiveStreamResponse(pollResponse);

		if (liveStreamResponse !== null) {
			const newLiveStream: LiveStream = {
				id: liveStreamResponse?.videoId,
				title: liveStreamResponse?.title?.runs?.[0]?.text,
				url: liveStreamResponse?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url,
			};

			if (this.liveStream !== null) {
				if (this.liveStream.id === newLiveStream.id) {
					return;
				}

				this.emitter.emit("liveSwitch", this.liveStream, newLiveStream);
			} else {
				this.emitter.emit("liveStart", newLiveStream);
			}

			this.liveStream = newLiveStream;
		} else {
			if (this.liveStream !== null) {
				this.emitter.emit("liveEnd", this.liveStream);
			}

			this.liveStream = null;
		}
	}

	private async request(): Promise<unknown> {
		const path = await this.expandTemplate(settings.apiPath);
		const requestPayload = await this.expandPollRequestPayload();

		return new Promise<unknown>((resolve, reject) => {
			const pollRequest = request({
				host: settings.apiHost,
				path,
				method: "POST",
				agent: new Agent({keepAlive: true}),
			}, (response) => {
				response.setEncoding("utf8");

				let data = "";

				response.on("data", (chunk) => {
					data += chunk;
				});

				response.on("end", () => {
					resolve(JSON.parse(data));
				});
			});

			pollRequest.on("error", (err) => {
				reject(err);
			});

			pollRequest.write(JSON.stringify(requestPayload));

			pollRequest.end();
		});
	}

	private getLiveStreamResponse(pollResponse: any): any | null {
		const tabs = pollResponse.contents.twoColumnBrowseResultsRenderer.tabs as Array<any>;

		const tab = tabs.find((tab) => { // lint shadowed variable
			return tab?.tabRenderer?.selected;
		});

		const tabRenderer = tab?.tabRenderer;
		const sectionListRenderer = tabRenderer?.content?.sectionListRenderer;
		const itemSectionRenderer = sectionListRenderer?.contents?.[0]?.itemSectionRenderer;
		const gridRenderer = itemSectionRenderer?.contents?.[0]?.gridRenderer;
		const gridVideoRenderer = gridRenderer?.items?.[0]?.gridVideoRenderer;

		const thumbnailOverlays = gridVideoRenderer?.thumbnailOverlays ?? [];

		const liveOverlay = thumbnailOverlays.find((overlay: any) => {
			return overlay?.thumbnailOverlayTimeStatusRenderer?.style === "LIVE";
		});

		return liveOverlay !== undefined ? gridVideoRenderer : null;
	}

	private async expandPollRequestPayload(): Promise<typeof pollRequestPayload> {
		const originalUrl = await this.expandTemplate(pollRequestPayload.context.client.originalUrl);
		const graftUrl = await this.expandTemplate(pollRequestPayload.context.client.mainAppWebInfo.graftUrl);
		const browseId = await this.expandTemplate(pollRequestPayload.browseId);
		const params = await this.expandTemplate(pollRequestPayload.params);

		return {
			...pollRequestPayload,
			context: {
				...pollRequestPayload.context,
				client: {
					...pollRequestPayload.context.client,
					originalUrl,
					mainAppWebInfo: {
						...pollRequestPayload.context.client.mainAppWebInfo,
						graftUrl,
					},
				},
			},
			browseId,
			params,
		};
	}

	private expandTemplateWithLocalValues(template: string): string {
		return expandTemplate(template, this.config.templateValues);
	}

	private async expandTemplate(template: string): Promise<string> {
		const session = await this.getSession();

		const templateWithLocalValues = this.expandTemplateWithLocalValues(template);

		return expandTemplate(templateWithLocalValues, session);
	}
}
