import {Agent, request} from "https";

import {Json, JsonObject} from "./json";

export interface RequestParameters {
	host: string;
	path: string;
	method: string;
}

export function requestJson(parameters: RequestParameters, payload?: JsonObject): Promise<Json> {
	return new Promise<Json>((resolve, reject) => {
		const clientRequest = request({
			...parameters,
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

		clientRequest.on("error", (err) => {
			reject(err);
		});

		if (payload !== undefined) {
			clientRequest.write(JSON.stringify(payload));
		}

		clientRequest.end();
	});
}
