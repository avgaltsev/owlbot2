import {PollerConfig} from "./config";
import {launch, Browser} from "puppeteer";
import {EventEmitter} from "stream";
import {request, Agent} from "https";

import * as pollRequestMetadata from "./poll-request-metadata.json";
import * as pollRequestPayload from "./poll-request-payload.json";

type PollType = "featured" | "videos";

function expandPollRequestPayload(type: PollType): typeof pollRequestPayload {
	const params = {
		"featured": "EghmZWF0dXJlZPIGBAoCMgA%3D",
		"videos": "EgZ2aWRlb3PyBgQKAjoA",
	};

	return {
		...pollRequestPayload,
		context: {
			...pollRequestPayload.context,
			client: {
				...pollRequestPayload.context.client,
				originalUrl: pollRequestPayload.context.client.originalUrl.replace("%1", type),
				mainAppWebInfo: {
					...pollRequestPayload.context.client.mainAppWebInfo,
					graftUrl: pollRequestPayload.context.client.mainAppWebInfo.graftUrl.replace("%1", type),
				},
			},
		},
		params: params[type],
	};
}

function extractPollResponseContent(pollResponse: any, type: PollType): any {
	const tabs = pollResponse.contents.twoColumnBrowseResultsRenderer.tabs as Array<any>;

	const tab = tabs.find((tab) => { // lint shadowed variable
		const webCommandMetadataUrl = pollRequestMetadata.webCommandMetadataUrl.replace("%1", type);

		return tab?.tabRenderer?.endpoint?.commandMetadata?.webCommandMetadata?.url === webCommandMetadataUrl;
	});

	return tab?.tabRenderer?.content;
}

interface Session {
	key: string;
}

// interface Header {
// 	name: string;
// 	value: string;
// }

// interface Request {
// 	url: string;
// 	headers: Array<Header>;
// 	// eslint-disable-next-line @typescript-eslint/no-explicit-any
// 	body: any;
// }

// const HEADERS_COMMON: Array<Header> = [];

// const REQUEST_COMMON: Request = {
// 	url: "https://www.youtube.com/youtubei/v1/browse?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8&prettyPrint=false",
// 	headers: [...HEADERS_COMMON],
// 	body: {},
// };

// const REQUEST_FEATURED: Request = {
// 	...REQUEST_COMMON,
// };

// const REQUEST_VIDEOS: Request = {
// 	...REQUEST_COMMON,
// };

interface YoutubeConfig {
	["INNERTUBE_API_KEY"]: string;
}

const INJECTED_CODE = `
	(function () {
		const properties = [
			"INNERTUBE_API_KEY",
		];

		const output = properties.reduce((result, property) => {
			result[property] = ytcfg.data_[property];

			return result;
		}, {});

		return output;
	})();
`;

interface PollerEvents {
	start: () => void;
	liveStart: (stream: string) => void;
	liveEnd: (stream: string) => void;
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

	// private live: string | null = null;

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

		const session = await this.getSession();

		setImmediate(() => {
			this.poll(session.key);
		});

		setInterval(() => {
			this.poll(session.key);
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

		await page.goto(this.config.channelUrl);

		const youtubeConfig = await page.evaluate(INJECTED_CODE) as YoutubeConfig;

		page.close();

		return {
			key: youtubeConfig.INNERTUBE_API_KEY,
		};
	}

	private async poll(key: string): Promise<void> {
		const [pollResponseFeatured, pollResponseVideos] = await Promise.all([
			this.pollByType(key, "featured"),
			this.pollByType(key, "videos"),
		]);

		const contentFeatured = extractPollResponseContent(pollResponseFeatured, "featured");
		const contentVideos = extractPollResponseContent(pollResponseVideos, "videos");

		const hasLiveStreamInFeatured = this.findLiveStreamInFeatured(contentFeatured);
		const hasLiveStreamInVideos = this.findLiveStreamInVideos(contentVideos);

		console.log(hasLiveStreamInFeatured || hasLiveStreamInVideos);
	}

	private pollByType(key: string, type: PollType): Promise<unknown> {
		return new Promise<unknown>((resolve, reject) => {
			const pollRequest = request({
				host: pollRequestMetadata.host,
				path: pollRequestMetadata.path.replace("%1", key),
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

			pollRequest.write(JSON.stringify(expandPollRequestPayload(type)));

			pollRequest.end();
		});
	}

	private findLiveStreamInFeatured(contentFeatured: any): boolean {
		const contents = contentFeatured?.sectionListRenderer?.contents;

		console.log(contents);
		return false;
	}

	private findLiveStreamInVideos(contentVideos: any): boolean {
		const contents = contentVideos?.sectionListRenderer?.contents;

		console.log(contents);
		return false;
	}
}
