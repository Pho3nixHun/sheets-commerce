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
const Router = require("koa-router");
const sheets_1 = require("../services/sheets");
const drive_1 = require("../services/drive");
const Url = require("url");
exports.default = (driveWatchService) => {
    const router = new Router();
    const notificationPath = Url.parse(driveWatchService.address).pathname;
    driveWatchService.rewatch();
    router.post(notificationPath, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        const { 
        //'x-goog-channel-expiration': expiration,
        //'x-goog-resource-uri': resourceUri,
        //'x-goog-message-number': messageCount,
        'x-goog-channel-id': channelId, 'x-goog-resource-id': resourceId } = ctx.headers;
        const channelExists = drive_1.default.instances.some(instance => instance.id === channelId);
        const refreshResult = channelExists && (yield sheets_1.default.refreshInstances(resourceId));
        ctx.status = refreshResult ? 200 : 400;
    }));
    return router;
};
