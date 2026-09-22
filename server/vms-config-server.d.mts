import type { IncomingMessage, ServerResponse, Server } from "node:http";

export declare const CONFIG_FILE: string;
export declare function isValidChannel(c: unknown): boolean;
export declare function handleConfigRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean>;
export declare function startConfigServer(options?: { port?: number; host?: string }): Server;
