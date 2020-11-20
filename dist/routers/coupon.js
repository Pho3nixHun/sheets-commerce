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
const Order_1 = require("../types/Order");
const Router = require("koa-router");
const Ejs = require("ejs");
const util_1 = require("util");
const get = (p, o) => p.reduce((xs, x) => (xs && xs[x]) ? xs[x] : null, o);
const render = util_1.promisify(Ejs.renderFile.bind(Ejs));
exports.default = (prefix, orderService, view) => {
    const router = new Router();
    router.get(`${prefix}/:OrderNumber`, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        const { params: { OrderNumber } } = ctx;
        const order = yield orderService.findOne({ OrderNumber, State: Order_1.State.DONE }).catch(ex => ex);
        if (order instanceof Error) {
            ctx.status = 503;
            ctx.body = yield render(view.html, Object.assign({}, view.locals, { error: ctx.status }));
            return;
        }
        else if (!order) {
            ctx.status = 404;
            ctx.body = yield render(view.html, Object.assign({}, view.locals, { error: ctx.status }));
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
            ctx.body = yield render(view.html, Object.assign({}, view.locals, { error: ctx.status }));
            return;
        }
        ctx.status = 200;
        ctx.body = yield render(view.html, Object.assign({}, view.locals, {
            name: lastItem.Name,
            description: lastItem.Description,
            purchaseDate: purchaseDate.getTime(),
            orderId: order.OrderNumber
        }));
    }));
    return router;
};
