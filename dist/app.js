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
exports.main = void 0;
const Koa = require("koa");
const Router = require("koa-router");
const Static = require("koa-static");
const Ejs = require("ejs");
const fs_1 = require("fs");
const logger_1 = require("./routers/logger");
const sheets_1 = require("./routers/sheets");
const orders_1 = require("./routers/orders");
const drive_changes_1 = require("./routers/drive-changes");
const barion_1 = require("./routers/barion");
const googleAuthServer_1 = require("./utils/googleAuthServer");
const http_1 = require("http");
const events_1 = require("events");
const sheets_2 = require("./services/sheets");
const gmail_1 = require("./services/gmail");
const drive_1 = require("./services/drive");
const szamlazz_1 = require("./services/szamlazz");
const barion_2 = require("./services/barion");
const orderManager_1 = require("./services/orderManager");
const util_1 = require("util");
const render = util_1.promisify(Ejs.renderFile.bind(Ejs));
const createServices = (config) => __awaiter(void 0, void 0, void 0, function* () {
    const googleCredentials = yield googleAuthServer_1.loadGoogleCredentials(config['google-credentials-file']);
    const googleRefreshTokenPath = config['google-refreshtoken-file'];
    const googleService = yield googleAuthServer_1.setupGoogleService(googleCredentials, googleRefreshTokenPath);
    if (googleService instanceof Error)
        throw googleService;
    yield googleService.loadToken();
    googleService.initializeApis();
    const { spreadsheetId, ranges: { products, orders }, dbPath, fileId } = config.spreadsheet;
    const productsSheetsService = new sheets_2.default(googleService, spreadsheetId, fileId, products, dbPath);
    const ordersSheetsService = new sheets_2.default(googleService, spreadsheetId, fileId, orders, dbPath);
    ordersSheetsService.transforms.Items = { to: any => JSON.stringify(any, null, 4), from: JSON.parse };
    ordersSheetsService.transforms.Details = { to: any => JSON.stringify(any, null, 4), from: JSON.parse };
    ordersSheetsService.transforms.ShippingAddress = { to: any => JSON.stringify(any, null, 4), from: JSON.parse };
    ordersSheetsService.transforms.InvoiceAddress = { to: any => JSON.stringify(any, null, 4), from: JSON.parse };
    const { watchChannelId, watchNotificationUrl } = config.spreadsheet;
    const driveWatchService = new drive_1.default(googleService, watchChannelId, fileId, watchNotificationUrl);
    const gmailService = new gmail_1.default(googleService);
    const szamlazzConfigPath = config['szamlazz.hu-config'];
    const szamlazzOptions = yield Promise.resolve().then(() => require(szamlazzConfigPath));
    const szamlazzService = new szamlazz_1.default(szamlazzOptions);
    const barionConfigPath = config['barion-config'];
    const { clientOptions, serviceOptions } = yield Promise.resolve().then(() => require(barionConfigPath));
    const barionService = new barion_2.default(clientOptions, serviceOptions);
    const orderManagerService = new orderManager_1.OrderManager(barionService, szamlazzService, gmailService, ordersSheetsService, productsSheetsService, {
        paymentOptions: {
            default: {
                PaymentType: barion_2.PaymentType.IMMIDIATE,
                Currency: szamlazz_1.Currency.HUF.value,
                GuestCheckOut: true,
                ChallengePreference: barion_2.ChallengePreference.NOCHALLENGENEEDED,
                ShippingAddress: {
                    Country: 'HU'
                }
            },
            Payee: serviceOptions['Payee']
        },
        emailOptions: config['email'],
        invoiceOptions: {}
    });
    return {
        googleService,
        productsSheetsService,
        ordersSheetsService,
        driveWatchService,
        gmailService,
        szamlazzService,
        barionService,
        orderManagerService
    };
});
const loadViewTemplates = (views) => __awaiter(void 0, void 0, void 0, function* () {
    const loadedViews = {};
    for (let key in views) {
        const { html, locals } = views[key];
        const rawJson = yield fs_1.promises.readFile(locals);
        loadedViews[key] = {
            html,
            locals: JSON.parse(rawJson.toString('utf-8'))
        };
    }
    return loadedViews;
});
const createAppServer = (config) => __awaiter(void 0, void 0, void 0, function* () {
    const app = new Koa();
    const router = new Router();
    const { port, host, logs } = config.server;
    const viewTemplates = yield loadViewTemplates(config['views']['templates']);
    const services = yield createServices(config);
    const loggerRoutes = logger_1.default(logs, config["persistent-storage"]);
    loggerRoutes.forEach(route => app.use(route));
    const productRoutes = sheets_1.default('/products', services.productsSheetsService);
    const orderRoutes = orders_1.default('/orders', services.orderManagerService, viewTemplates['order']);
    const driveChangesHookRoutes = drive_changes_1.default(services.driveWatchService);
    const barionRoutes = barion_1.default('/barion', services.orderManagerService, viewTemplates['order']);
    router
        .get("/", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
        const { html, locals } = viewTemplates['checkout'];
        ctx.body = yield render(html, locals, config['views']['options']);
    }));
    const server = app
        .use(router.routes())
        .use(router.allowedMethods())
        .use(driveChangesHookRoutes.routes())
        .use(productRoutes.routes())
        .use(orderRoutes.routes())
        .use(barionRoutes.routes())
        .use(Static(config.server.static.root, config.server.static.opts))
        .listen(port, host, () => {
        console.log(`Listening on port ${host}:${port}`);
    });
    return server;
});
exports.main = (config) => __awaiter(void 0, void 0, void 0, function* () {
    const googleAuthServer = yield googleAuthServer_1.default(config);
    if (googleAuthServer instanceof http_1.Server) {
        yield events_1.once(googleAuthServer, 'close');
    }
    return createAppServer(config);
});
