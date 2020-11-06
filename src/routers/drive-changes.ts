import * as Koa from 'koa';
import Router = require('koa-router');
import SheetsService from '@services/sheets';
import DriveWatchService from '@services/drive';
import * as Url from 'url';

export default (driveWatchService: DriveWatchService): Router => {
    const router = new Router();
    const notificationPath = Url.parse(driveWatchService.address).pathname;
    driveWatchService.rewatch();
    router.post(notificationPath, async (ctx: Koa.Context) => {
        const {
            //'x-goog-channel-expiration': expiration,
            //'x-goog-resource-uri': resourceUri,
            //'x-goog-message-number': messageCount,
            'x-goog-channel-id': channelId,
            'x-goog-resource-id': resourceId
        } = ctx.headers;
        const channelExists = DriveWatchService.instances.some(instance => instance.id === channelId);
        const refreshResult = channelExists && await SheetsService.refreshInstances(resourceId);
        ctx.status = refreshResult ? 200 : 400;
    });

    return router;
}