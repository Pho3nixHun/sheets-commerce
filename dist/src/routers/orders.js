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
const bodyparser = require("koa-bodyparser");
const orderManager_1 = require("@services/orderManager");
const defaultErrorHandler = ex => ex;
exports.default = (prefix, orderManagerService, view) => {
    const router = new Router();
    router.use(bodyparser());
    router.post(`${prefix}`, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        const { body } = ctx.request;
        const task = yield orderManagerService.onNewOrder(body).catch(defaultErrorHandler);
        if (task instanceof orderManager_1.ErrorWithDetails) {
            ctx.status = 403;
            ctx.body = task.message;
            return;
        }
        else if (task instanceof Error) {
            ctx.status = 503;
            return;
        }
        ctx.type = 'json';
        ctx.body = task;
        return;
    }));
    return router;
};
