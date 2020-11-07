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
const Ejs = require("ejs");
const util_1 = require("util");
const Router = require("koa-router");
const orderManager_1 = require("../services/orderManager");
const render = util_1.promisify(Ejs.renderFile.bind(Ejs));
exports.default = (prefix, orderManagerSerive, view, { redirectPath = '/redirect', callbackPath = '/callback' } = {}) => {
    const router = new Router();
    router.get(`${prefix}${redirectPath}`, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        const { paymentId } = ctx.query;
        const result = yield orderManagerSerive.getOrderState(paymentId).catch(ex => ex);
        if (result instanceof orderManager_1.ErrorWithDetails) {
            ctx.body = yield render(view.html, Object.assign({}, view.locals, {
                error: true,
                message: result.message
            }));
            return;
        }
        else if (result instanceof Error) {
            ctx.body = yield render(view.html, Object.assign({}, view.locals, {
                error: true,
                message: 'Whoops...'
            }));
            return;
        }
        ctx.body = yield render(view.html, Object.assign({}, view.locals, {
            orderNumber: result.Data.OrderNumber,
            orderState: result.Data.State
        }));
        return;
    }));
    router.post(`${prefix}${callbackPath}`, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        const { paymentId } = ctx.query;
        const result = yield orderManagerSerive.onPaymentUpdate(paymentId).catch(ex => ex);
        if (result instanceof orderManager_1.ErrorWithDetails) {
            ctx.status = 404;
            ctx.body = result.message;
            return;
        }
        else if (result instanceof Error) {
            ctx.status = 503;
            return;
        }
        ctx.body = "OK";
    }));
    return router;
};
