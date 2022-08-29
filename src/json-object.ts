import type {Json} from "./json";

export interface JsonObject {
	[name: string]: Json;
}

export function isJsonObject<T extends JsonObject>(value: Json): value is T {
	return typeof value === "object" && value !== null;
}
