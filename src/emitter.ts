/* eslint-disable @typescript-eslint/no-explicit-any */

import {EventEmitter} from "events";

// TODO: test with unknown instead of any
type ListenerFunction = (...args: Array<any>) => void;

type EmitterEventName<T> = keyof T extends string ? keyof T : never;
type EmitterEventListener<T> = T[keyof T] extends ListenerFunction ? T[keyof T] : never;

type EmitterEvents<T> = {
	[K in EmitterEventName<T>]: T[K] extends EmitterEventListener<T> ? EmitterEventListener<T> : never;
};

export interface Emitter<T extends EmitterEvents<T>> {
	addListener<K extends EmitterEventName<T>>(eventName: K, listener: T[K]): this;
	removeListener<K extends EmitterEventName<T>>(eventName: K, listener: T[K]): this;
	on<K extends EmitterEventName<T>>(eventName: K, listener: T[K]): this;
	once<K extends EmitterEventName<T>>(eventName: K, listener: T[K]): this;
	off<K extends EmitterEventName<T>>(eventName: K, listener: T[K]): this;
	emit<K extends EmitterEventName<T>>(eventName: K, ...args: Parameters<T[K]>): boolean;
}

export class Emitter<T extends EmitterEvents<T>> extends EventEmitter {}
