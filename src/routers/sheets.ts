import * as Koa from 'koa';
import Router = require('koa-router');
import SheetsService from '@services/sheets';
import * as bodyParser from 'koa-bodyparser';

export default (prefix: string, sheets: SheetsService<any>): Router => {
    const router = new Router();
    const findRow = async (ctx: Koa.Context, next: Koa.Next) => {
        const { request: { body }, params: { row } } = ctx;
        if (isNaN(row)) {
            ctx.status = 400;
            return 'Field `$row` is mandatory and it has to be a number.';
        }
        const rows = await sheets.find({ $row: { $aeq: row }});
        if (rows.length < 1) {
            ctx.status = 404;
            ctx.body = 'No matching entity found.';
            return;
        }
        if (rows.length > 1) {
            ctx.status = 412;
            ctx.body = 'Multiple entities found.';
            return;
        }
        ctx.local.row = rows.pop();
        await next();
        return;
    }
    router.use(bodyParser());
    router.use(async (ctx: Koa.Context, next: Koa.Next) => {
        ctx.local = {};
        await next();
        return;
    })
    router.get(prefix, async (ctx: Koa.Context) => {
        ctx.type = 'json';
        const { q = '' } = ctx.query;
        if (q.length > 0) {
            const items = q.split(',').map(Number);
            ctx.body = await sheets.find({ $row: { $in: items }});
        } else {
            ctx.body = await sheets.find(() => true);
        }
    });
    router.get(`${prefix}/:row`, findRow);
    router.put(`${prefix}/:row`, findRow);
    router.delete(`${prefix}/:row`, findRow);
    router.get(`${prefix}/:row`, async (ctx: Koa.Context) => {
        const { local: { row } } = ctx;
        ctx.type = 'json';
        ctx.body = row;
    });
    router.post(`${prefix}`, async (ctx: Koa.Context) => {
        // @ts-ignore
        const data = ctx.request.body;
        const result = await sheets.create(data).catch(ex => ex);
        if (result instanceof Error) {
            ctx.status = 500;
            ctx.body = 'Cannot create row';
        } else {
            ctx.type = 'json';
            ctx.body = result;
        }
    }); 
    
    router.put(`${prefix}/:row`, async (ctx: Koa.Context) => {
        const { local: { row }, request: { body } } = ctx;
        for(let key in row) {
            if (body[key] !== undefined) {
                row[key] = body[key];
            }
        }
        const result = await sheets.update(row).catch(ex => ex);
        if (result instanceof Error) {
            ctx.status = 500;
            ctx.body = `Cannot update row (${row.$row})`;
        } else {
            ctx.type = 'json';
            ctx.body = result;
        }
    });
    router.delete(`${prefix}/:row`, async (ctx: Koa.Context) => {
        const { local: { row } } = ctx;
        const result = await sheets.delete(row.$row).catch(ex => ex);
        if (result instanceof Error) {
            ctx.status = 500;
            ctx.body = `Cannot delete row (${row.$row})`;
        } else {
            ctx.type = 'json';
            ctx.body = row;
        }
    });

    return router;
}