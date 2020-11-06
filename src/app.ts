import * as Koa from 'koa';
import * as Router from 'koa-router';
import * as pkg from '@package';
import * as Static from 'koa-static';
import Ejs = require('ejs');

import { promises as fs } from 'fs';

import { Config, ServerConfig } from '@definitions/config';
import { OrderRow } from '@definitions/Order';
import { ProductRow } from '@definitions/Product';
import LoggerRouteGenerator from '@routers/logger';
import SheetsRouteGenerator from '@routers/sheets';
import OrderRouteGenerator from '@routers/orders';
import DriveChanhesHookGenerator from '@routers/drive-changes';
import BarionRouteGenerator from '@routers/barion'
import GoogleAuthServerHelper, { loadGoogleCredentials, setupGoogleService } from '@utils/googleAuthServer';
import { Server } from 'http';
import { once } from 'events';
import { GoogleCredentials } from '@services/google';
import SheetsService from '@services/sheets';
import GmailService from '@services/gmail';
import DriveWatchService from '@services/drive';
import SzamlazzService, { Currency } from '@services/szamlazz';
import BarionService, { BarionClientOptions, BarionServiceOptions, ChallengePreference, PaymentType } from '@services/barion';
import { OrderManager } from '@services/orderManager';
import { promisify } from 'util';

type BarionConfig = { clientOptions: BarionClientOptions, serviceOptions: BarionServiceOptions};

const render = promisify(Ejs.renderFile.bind(Ejs));

const createServices = async (config: Config) => {
    const googleCredentials = await loadGoogleCredentials(config['google-credentials-file']);
    const googleRefreshTokenPath = config['google-refreshtoken-file'];
    const googleService = await setupGoogleService(<GoogleCredentials> googleCredentials, googleRefreshTokenPath);
    if (googleService instanceof Error) throw googleService;
    await googleService.loadToken()
    googleService.initializeApis();

    const { spreadsheetId, ranges: { products, orders }, dbPath, fileId } = config.spreadsheet;
    const productsSheetsService = new SheetsService<ProductRow>(googleService, spreadsheetId, fileId, products, dbPath);
    const ordersSheetsService = new SheetsService<OrderRow>(googleService, spreadsheetId, fileId, orders, dbPath);
    ordersSheetsService.transforms.Items = {to: any => JSON.stringify(any, null, 4), from: JSON.parse}
    ordersSheetsService.transforms.Details = {to: any => JSON.stringify(any, null, 4), from: JSON.parse};
    ordersSheetsService.transforms.ShippingAddress = {to: any => JSON.stringify(any, null, 4), from: JSON.parse};
    ordersSheetsService.transforms.InvoiceAddress = {to: any => JSON.stringify(any, null, 4), from: JSON.parse};


    const { watchChannelId, watchNotificationUrl } = config.spreadsheet;
    const driveWatchService = new DriveWatchService(googleService, watchChannelId, fileId, watchNotificationUrl)

    const gmailService = new GmailService(googleService);
    
    const szamlazzConfigPath = config['szamlazz.hu-config'];
    const szamlazzOptions = await import(szamlazzConfigPath);
    const szamlazzService = new SzamlazzService(szamlazzOptions);

    const barionConfigPath = config['barion-config'];
    const { 
        clientOptions,
        serviceOptions 
    }: BarionConfig = await import(barionConfigPath);
    const barionService = new BarionService(clientOptions, serviceOptions);
    
    const orderManagerService = new OrderManager(
        barionService,
        szamlazzService,
        gmailService,
        ordersSheetsService,
        productsSheetsService,
        {
            paymentOptions: {
                default: {
                    PaymentType: PaymentType.IMMIDIATE,
                    Currency: Currency.HUF.value,
                    GuestCheckOut: true,
                    ChallengePreference: ChallengePreference.NOCHALLENGENEEDED,
                    ShippingAddress: {
                        Country: 'HU'
                    }
                },
                Payee: serviceOptions['Payee']
            },
            emailOptions: config['email'],
            invoiceOptions: {

            }
        }
    )

    return {
        googleService,
        productsSheetsService,
        ordersSheetsService,
        driveWatchService,
        gmailService,
        szamlazzService,
        barionService,
        orderManagerService
    }
}

const loadViewTemplates = async (views) => {
    const loadedViews = {};
    for (let key in views) {
        const { html, locals } = views[key];
        const rawJson = await fs.readFile(locals);
        loadedViews[key] = {
            html,
            locals: JSON.parse(rawJson.toString('utf-8'))
        }
    }
    return loadedViews;
}

const createAppServer = async (config: Config) => {
    const app = new Koa();
    const router = new Router();
    const { port, host, logs } : ServerConfig = config.server;

    const viewTemplates = await loadViewTemplates(config['views']['templates']);

    const services = await createServices(config);

    const loggerRoutes = LoggerRouteGenerator(logs, config["persistent-storage"]);
    loggerRoutes.forEach(route => app.use(route));
    const productRoutes = SheetsRouteGenerator('/products', services.productsSheetsService);
    const orderRoutes = OrderRouteGenerator(
        '/orders',
        services.orderManagerService,
        viewTemplates['order']
    );
    const driveChangesHookRoutes = DriveChanhesHookGenerator(services.driveWatchService);

    const barionRoutes = BarionRouteGenerator(
        '/barion',
        services.orderManagerService,
        viewTemplates['order']
    );

    router
        .get('/version', (ctx: Koa.Context) => {
            ctx.body = pkg.version;
        })
        .get("/", async (ctx: Koa.Context) => {
            const { html, locals } = viewTemplates['checkout'];
            ctx.body = await render(html, locals, config['views']['options']);
        });

    const server = app
        .use(router.routes())
        .use(router.allowedMethods())
        .use(driveChangesHookRoutes.routes())
        .use(productRoutes.routes())
        //.use(orderRoutes.routes())
        .use(barionRoutes.routes())
        .use(Static(config.server.static.root, config.server.static.opts))
        .listen(port, host, () => {
            console.log(`Listening on port ${host}:${port}`);
        });
    return server;
}

export const main = async (config: Config): Promise<Server|boolean> => {
    const googleAuthServer = await GoogleAuthServerHelper(config);
    if (googleAuthServer instanceof Server) {
        await once(googleAuthServer, 'close');
    }
    return createAppServer(config);
}
