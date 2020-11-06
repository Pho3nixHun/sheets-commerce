import * as Koa from 'koa';
import Ejs = require('ejs');
import { promisify } from 'util';
import Router = require('koa-router');
import { ErrorWithDetails, OrderManager } from '@services/orderManager';

export type Options = { redirectPath?: string, callbackPath?: string }
export type view = {
    html: string,
    locals: any
}

const render = promisify(Ejs.renderFile.bind(Ejs));

export default (
    prefix: string,
    orderManagerSerive: OrderManager,
    view: view,
    { redirectPath = '/redirect', callbackPath ='/callback'}: Options = {}
): Router => {
    const router = new Router();
    router.get(`${prefix}${redirectPath}`, async (ctx: Koa.Context) => {
        const { paymentId } = ctx.query;
        const result = await orderManagerSerive.getOrderState(paymentId).catch(ex => ex);
        if (result instanceof ErrorWithDetails) {
            ctx.body = await render(view.html, Object.assign({}, view.locals, {
                error: true,
                message: result.message
            }));
            return;
        } else if (result instanceof Error) {
            ctx.body = await render(view.html, Object.assign({}, view.locals, {
                error: true,
                message: 'Whoops...'
            }));
            return;
        }
        ctx.body = await render(view.html, Object.assign({}, view.locals, {
            orderNumber: result.Data.OrderNumber,
            orderState: result.Data.State
        }));
        return;
    });
    router.post(`${prefix}${callbackPath}`, async (ctx: Koa.Context) => {
        const { paymentId } = ctx.query;
        const result = await orderManagerSerive.onPaymentUpdate(paymentId).catch(ex => ex);
        if (result instanceof ErrorWithDetails) {
            ctx.status = 404;
            ctx.body = result.message;
            return;
        } else if (result instanceof Error) {
            ctx.status = 503;
            return;
        }
        ctx.body = "OK";
    });

    return router;
}