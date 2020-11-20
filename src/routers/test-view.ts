import * as Koa from 'koa';
import Router = require('koa-router');
import Ejs = require('ejs');
import { promisify } from 'util'; 
import { viewOptions } from '@definitions/config';
import { promises as fs } from 'fs';

const get = (p: (string|number)[], o: any) => p.reduce((xs, x) => (xs && xs[x]) ? xs[x] : null, o);
const render = promisify(Ejs.renderFile.bind(Ejs));

export default async (
    prefix: string,
    view: viewOptions
): Promise<Router> => {
    const rawJson = await fs.readFile(view.locals);
    const locals = JSON.parse(rawJson.toString('utf-8'));
    locals.coupon.link = `${locals.coupon.base}/${'xxx-xxx-xxx'}`;

    const router = new Router();
    router.get(prefix, async (ctx: Koa.Context) => {
        ctx.body = await render(view.html, locals);
    });
    return router;
};