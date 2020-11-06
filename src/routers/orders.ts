import * as Koa from 'koa';
import Router = require('koa-router');
import * as bodyparser from 'koa-bodyparser';
import { OrderManager, ErrorWithDetails, ClientTask } from '@services/orderManager';

const defaultErrorHandler = ex => ex;

type RawOrder = {
    Items: { id: string, count: string }[],
    Name: string,
    Email: string,
    Phone: string,
    Address: {
        City: string,
        Zip: string,
        Street: string
    },
    Invoice: RawOrder['Address'] & { TaxNumber: string },
    Comment?: string
}

export type view = {
    html: string,
    locals: any
}


export default (
    prefix: string,
    orderManagerService: OrderManager,
    view: view
): Router => {
    const router = new Router();
    router.use(bodyparser());
    router.post(`${prefix}`, async (ctx: Koa.Context) => {
        const { body }: { body?: RawOrder } = ctx.request;
        const task: ClientTask|Error|ErrorWithDetails = await orderManagerService.onNewOrder(body).catch(defaultErrorHandler);
        if (task instanceof ErrorWithDetails) {
            ctx.status = 403;
            ctx.body = (<ErrorWithDetails> task).message;
            return;
        } else if (task instanceof Error) {
            ctx.status = 503;
            return;
        }
        ctx.type = 'json';
        ctx.body = task;
        return;
    });
    return router;
} 