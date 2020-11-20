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
const Ejs = require("ejs");
const util_1 = require("util");
const fs_1 = require("fs");
const get = (p, o) => p.reduce((xs, x) => (xs && xs[x]) ? xs[x] : null, o);
const render = util_1.promisify(Ejs.renderFile.bind(Ejs));
exports.default = (prefix, view) => __awaiter(void 0, void 0, void 0, function* () {
    const rawJson = yield fs_1.promises.readFile(view.locals);
    const locals = JSON.parse(rawJson.toString('utf-8'));
    locals.coupon.link = `${locals.coupon.base}/${'xxx-xxx-xxx'}`;
    const router = new Router();
    router.get(prefix, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        ctx.body = yield render(view.html, locals);
    }));
    return router;
});
