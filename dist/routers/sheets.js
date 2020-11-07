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
const bodyParser = require("koa-bodyparser");
exports.default = (prefix, sheets) => {
    const router = new Router();
    const findRow = (ctx, next) => __awaiter(void 0, void 0, void 0, function* () {
        const { request: { body }, params: { row } } = ctx;
        if (isNaN(row)) {
            ctx.status = 400;
            return 'Field `$row` is mandatory and it has to be a number.';
        }
        const rows = yield sheets.find({ $row: { $aeq: row } });
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
        yield next();
        return;
    });
    router.use(bodyParser());
    router.use((ctx, next) => __awaiter(void 0, void 0, void 0, function* () {
        ctx.local = {};
        yield next();
        return;
    }));
    router.get(prefix, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        ctx.type = 'json';
        const { q = '' } = ctx.query;
        if (q.length > 0) {
            const items = q.split(',').map(Number);
            ctx.body = yield sheets.find({ $row: { $in: items } });
        }
        else {
            ctx.body = yield sheets.find(() => true);
        }
    }));
    router.get(`${prefix}/:row`, findRow);
    router.put(`${prefix}/:row`, findRow);
    router.delete(`${prefix}/:row`, findRow);
    router.get(`${prefix}/:row`, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        const { local: { row } } = ctx;
        ctx.type = 'json';
        ctx.body = row;
    }));
    router.post(`${prefix}`, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        // @ts-ignore
        const data = ctx.request.body;
        const result = yield sheets.create(data).catch(ex => ex);
        if (result instanceof Error) {
            ctx.status = 500;
            ctx.body = 'Cannot create row';
        }
        else {
            ctx.type = 'json';
            ctx.body = result;
        }
    }));
    router.put(`${prefix}/:row`, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        const { local: { row }, request: { body } } = ctx;
        for (let key in row) {
            if (body[key] !== undefined) {
                row[key] = body[key];
            }
        }
        const result = yield sheets.update(row).catch(ex => ex);
        if (result instanceof Error) {
            ctx.status = 500;
            ctx.body = `Cannot update row (${row.$row})`;
        }
        else {
            ctx.type = 'json';
            ctx.body = result;
        }
    }));
    router.delete(`${prefix}/:row`, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        const { local: { row } } = ctx;
        const result = yield sheets.delete(row.$row).catch(ex => ex);
        if (result instanceof Error) {
            ctx.status = 500;
            ctx.body = `Cannot delete row (${row.$row})`;
        }
        else {
            ctx.type = 'json';
            ctx.body = row;
        }
    }));
    return router;
};
