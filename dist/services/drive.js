"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("util");
const fs_1 = require("fs");
class DriveWatchService {
    constructor(googleService, id, resourceId, address) {
        this.googleService = googleService;
        this.id = id;
        this.resourceId = resourceId;
        this.address = address;
        this._watch = util_1.promisify(this.googleService.Drive.changes.watch.bind(this.googleService.Drive.changes));
        this._unwatch = util_1.promisify(this.googleService.Drive.channels.stop.bind(this.googleService.Drive.channels));
        this.onWatchExpired = () => {
            const now = Date.now();
            const expiration = new Date(parseInt(this.token.expiration)).getTime();
            this.timeoutId = setTimeout(this.rewatch.bind(this), expiration - now);
        };
        process.on('beforeExit', () => __awaiter(this, void 0, void 0, function* () {
            console.log('Closing watch channel');
            yield this.unwatch().catch(ex => false);
            console.log('Watch channel closed');
        }));
        DriveWatchService.instances.push(this);
    }
    watch() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this._watch({
                pageToken: 1,
                resource: {
                    id: this.id,
                    type: 'web_hook',
                    address: this.address,
                    resourceId: this.resourceId
                }
            });
        });
    }
    unwatch() {
        return __awaiter(this, void 0, void 0, function* () {
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
        });
    }
    rewatch(saveResponsePath) {
        return __awaiter(this, void 0, void 0, function* () {
            const unwatchResponse = yield this.unwatch().catch(err => err);
            const watchResponse = yield this.watch().catch(err => err);
            if (saveResponsePath) {
                fs_1.promises.writeFile(saveResponsePath, JSON.stringify([unwatchResponse, watchResponse], null, 4)).catch(Boolean);
            }
            if ((!(unwatchResponse instanceof Error) || unwatchResponse.code === 404) &&
                !(watchResponse instanceof Error) &&
                watchResponse.status >= 200 &&
                watchResponse.status < 300) {
                //const isUnwatched = unwatchResponse.status >= 200 && unwatchResponse.status < 300;
                this.token = watchResponse.data;
                this.onWatchExpired();
                return this.token;
            }
            else {
                console.warn(unwatchResponse.message);
                console.error(watchResponse.message);
            }
            return false;
        });
    }
}
exports.default = DriveWatchService;
DriveWatchService.instances = [];
