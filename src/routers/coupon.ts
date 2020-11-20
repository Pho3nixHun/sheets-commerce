import { OrderRow, State } from '@definitions/Order';
import SheetsService from '@services/sheets';
import * as Koa from 'koa';
import Router = require('koa-router');
import Ejs = require('ejs');
import { promisify } from 'util'; 
import { viewOptions } from '@definitions/config';

const get = (p: (string|number)[], o: any) => p.reduce((xs, x) => (xs && xs[x]) ? xs[x] : null, o);
const render = promisify(Ejs.renderFile.bind(Ejs));

export default (
    prefix: string,
    orderService: SheetsService<OrderRow>,
    view: viewOptions
): Router => {
    const router = new Router();
    router.get(`${prefix}/:OrderNumber`, async (ctx: Koa.Context) => {
        const { params: { OrderNumber } } = ctx;
        const order = await orderService.findOne({ OrderNumber, State: State.DONE }).catch(ex => ex);
        if (order instanceof Error) {
            ctx.status = 503;
            ctx.body = await render(view.html, Object.assign({}, view.locals, { error: ctx.status }));
            return;
        } else if(!order) {
            ctx.status = 404;
            ctx.body = await render(view.html, Object.assign({}, view.locals, { error: ctx.status }));
            return;
        }
        const item = (order.Items || []);
        const lastItem = item[item.length - 1];
        const detailsWithTransaction = ((order.Details || []).filter(d => d && d.Transactions));
        const lastDetailsWithTransaction = detailsWithTransaction[detailsWithTransaction.length - 1];
        const transactions = lastDetailsWithTransaction && (lastDetailsWithTransaction.Transactions || []);
        const transaction = transactions[transactions.length - 1];
        const purchaseDate = transaction && transaction.TransactionTime && new Date(transaction.TransactionTime);
        if (!purchaseDate) {
            ctx.status = 503;
            ctx.body = await render(view.html, Object.assign({}, view.locals, { error: ctx.status }));
            return;
        }
        ctx.status = 200;
        ctx.body = await render(view.html, Object.assign({}, view.locals, {
            name: lastItem.Name,
            description: lastItem.Description,
            purchaseDate: purchaseDate.getTime(),
            orderId: order.OrderNumber
        }));

    });
    return router;
}