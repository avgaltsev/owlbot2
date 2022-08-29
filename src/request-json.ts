import {request, Agent} from "https";

export interface RequestParameters {
	host: string;
	path: string;
	method: string;
}

export interface RequestPayload {
	[name: string]: RequestPayload | string | number | boolean | null | Array<RequestPayload | string | number | boolean | null>;
}

export interface ResponseFields {
	[name: string]: ResponseFields | string | number | boolean | null | Array<ResponseFields | string | number | boolean | null>;
}

export type ResponseFieldName = keyof ResponseFields;
export type ResponseFieldValue = ResponseFields[ResponseFieldName];

export function isResponseFields<T extends ResponseFields>(value: ResponseFieldValue | undefined): value is T {
	return value !== null && typeof value === "object";
}

export function getResponseField(response: ResponseFieldValue | undefined, path: Array<string | number>): ResponseFieldValue | undefined {
	if (!isResponseFields(response)) {
		return undefined;
	}

	return path.reduce<ResponseFieldValue | undefined>((result, fieldName) => {
		if (!isResponseFields(result)) {
			return undefined;
		}

		return result[fieldName];
	}, response);
}

export function requestJson(parameters: RequestParameters, payload?: RequestPayload): Promise<ResponseFields> {
	return new Promise<ResponseFields>((resolve, reject) => {
		const pollRequest = request({
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

		pollRequest.on("error", (err) => {
			reject(err);
		});

		if (payload !== undefined) {
			pollRequest.write(JSON.stringify(payload));
		}

		pollRequest.end();
	});
}
