import GoogleService from "@services/google";
import { promisify } from "util";
import { promises as fs} from 'fs';

export type WatchToken = {
    expiration: string,
    id: string,
    kind: string,
    resourceId: string,
    resourceUri: string
}
export type WatchResponse = {
    config: object,
    data: WatchToken,
    headers: object,
    request: object,
    status: number,
    statusText: string
    message?: string
}

export type UnwatchResponse = {
    config: object,
    data: string|object,
    headers: object,
    request: object,
    status: number,
    statusText: string,
    code?: number,
    message?: string
}

export type ListResponse = {
    [key: string]: any
}

export default class DriveWatchService {
    private timeoutId: NodeJS.Timeout;
    static readonly instances: DriveWatchService[] = []

    private token: WatchToken;
    private _watch = promisify(this.googleService.Drive.changes.watch.bind(this.googleService.Drive.changes));
    private _unwatch = promisify(this.googleService.Drive.channels.stop.bind(this.googleService.Drive.channels));
    
    constructor(private googleService: GoogleService, public readonly id: string, public readonly resourceId: string, public readonly address: string) {
        process.on('beforeExit', async () => {
            console.log('Closing watch channel');
            await this.unwatch().catch(ex => false);
            console.log('Watch channel closed');
        });
        DriveWatchService.instances.push(this);
    }

    async watch(): Promise<WatchResponse> {
        return await this._watch({
            pageToken: 1,
            resource: {
                id: this.id,
                type: 'web_hook',
                address: this.address,
                resourceId: this.resourceId
            }
        });
    }
    async unwatch(): Promise<UnwatchResponse> {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = undefined;
        }
        return this._unwatch({
            pageToken: 1,
            resource: {
                id: this.id,
                resourceId: this.resourceId
            }
        });
    }

    async rewatch(saveResponsePath?: string): Promise<Boolean|any> {
        const unwatchResponse: UnwatchResponse = await this.unwatch( ).catch(err => err);
        const watchResponse: WatchResponse = await this.watch().catch(err => err);
        if (saveResponsePath) {
            fs.writeFile(saveResponsePath, JSON.stringify([unwatchResponse, watchResponse], null, 4)).catch(Boolean);
        }
        if (
            (!(unwatchResponse instanceof Error) || unwatchResponse.code === 404) &&
            !(watchResponse instanceof Error) &&
            (<WatchResponse> watchResponse).status >= 200 && 
            (<WatchResponse> watchResponse).status < 300
            ) {
            //const isUnwatched = unwatchResponse.status >= 200 && unwatchResponse.status < 300;
            this.token = (<WatchResponse> watchResponse).data;
            this.onWatchExpired();
            return this.token;
        } else {
            console.warn(unwatchResponse.message);
            console.error(watchResponse.message);
        }
        return false;
    }

    private onWatchExpired = () => {
        const now = Date.now();
        const expiration = new Date(parseInt(this.token.expiration)).getTime();
        this.timeoutId = setTimeout(this.rewatch.bind(this), expiration - now);
    }
}