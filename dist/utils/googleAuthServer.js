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
exports.main = exports.setupGoogleService = exports.loadGoogleCredentials = void 0;
const Koa = require("koa");
const Router = require("koa-router");
const logger_1 = require("../routers/logger");
const google_1 = require("../services/google");
const url = require("url");
const fs_1 = require("fs");
exports.loadGoogleCredentials = (path) => __awaiter(void 0, void 0, void 0, function* () {
    const googleCredentials = yield Promise.resolve().then(() => require(path)).catch(e => false);
    return googleCredentials;
});
exports.setupGoogleService = (googleCredentials, refreshTokenPath) => __awaiter(void 0, void 0, void 0, function* () {
    if (googleCredentials && refreshTokenPath) {
        const googleService = new google_1.default(googleCredentials, refreshTokenPath);
        return googleService;
    }
    return new Error('Google credentials or refreshToken was not set.');
});
exports.main = (config) => __awaiter(void 0, void 0, void 0, function* () {
    const googleCredentials = yield exports.loadGoogleCredentials(config['google-credentials-file']);
    const googleRefreshTokenPath = config['google-refreshtoken-file'];
    const googleService = yield exports.setupGoogleService(googleCredentials, googleRefreshTokenPath);
    if (googleService instanceof Error) {
        console.error(googleService);
        return false;
    }
    const isTokenLoaded = yield googleService.loadToken();
    if (isTokenLoaded)
        return false;
    const { web: { redirect_uris: [redirect_uri] } } = googleCredentials;
    const authUrl = googleService.generateAuthUrl(redirect_uri);
    const app = new Koa();
    const router = new Router();
    let server;
    const { port, host, logs } = config.server;
    const loggerRoutes = logger_1.default(logs, config['persistent-storage']);
    loggerRoutes.forEach(route => app.use(route));
    const callbackUrl = url.parse(redirect_uri).pathname;
    router
        .get(callbackUrl, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        const token = yield googleService.retreiveToken(ctx.query.code).catch(e => e);
        if (token instanceof Error) {
            ctx.status = 503;
            ctx.body = token.message;
            return;
        }
        ctx.redirect('/');
        googleService.initializeApis();
        return server.close();
    }))
        .get('/challenge', (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        ctx.redirect(authUrl);
        return;
    }))
        .get('/abort', (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        ctx.status = 200;
        ctx.body = 'Server killed';
        return server.close();
    }));
    server = app
        .use(router.routes())
        .use(router.allowedMethods())
        .use((ctx) => __awaiter(void 0, void 0, void 0, function* () {
        ctx.type = 'html';
        ctx.body = fs_1.createReadStream(config['google-auth-page']);
    }))
        .listen(port, host, () => {
        console.log(`Google authorization server us listening on port ${host}:${port}`);
    });
    return server;
});
exports.default = exports.main;
