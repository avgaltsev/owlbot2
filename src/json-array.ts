import type {Json} from "./json";

export type JsonArray = Array<Json>;

export function isJsonArray<T extends JsonArray>(value: Json): value is T {
	return Array.isArray(value);
}
