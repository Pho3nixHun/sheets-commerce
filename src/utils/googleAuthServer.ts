import * as Koa from 'koa';
import * as Router from 'koa-router';
import * as pkg from '@package';
import { Config, ServerConfig } from '@definitions/config'; 
import LoggerRouteGenerator from '@routers/logger';
import GoogleService from '@services/google';
import { GoogleCredentials } from '@services/google';
import * as url from 'url';
import { createReadStream, promises as fs } from 'fs';
import { Server } from 'http';
import { promisify } from 'util';
import * as path from 'path';

export const loadGoogleCredentials = async (path: string): Promise<GoogleCredentials | Boolean>  => {
    const googleCredentials = await import(path).catch(e => false);
    return googleCredentials;
}

export const setupGoogleService = async (googleCredentials: GoogleCredentials, refreshTokenPath: string): Promise<GoogleService|Error> => {
    if (googleCredentials && refreshTokenPath) {
        const googleService = new GoogleService(googleCredentials, refreshTokenPath);
        return googleService;
    }
    return new Error('Google credentials or refreshToken was not set.');
}
const getFile = async (googleService: GoogleService, fileId: string) => {
    const getFile = promisify(googleService.Drive.files.get.bind(googleService.Drive.files));

        const response = await getFile({fileId}).catch(err => err);
        if (response && response.status >= 200 && response.status < 300) {
            return response;
        }
        return false;
}

export const main = async (config: Config): Promise<Server|boolean> => {
    const googleCredentials = await loadGoogleCredentials(config['google-credentials-file']);
    const googleRefreshTokenPath = config['google-refreshtoken-file'];
    const googleService = await setupGoogleService(<GoogleCredentials> googleCredentials, googleRefreshTokenPath);
    if (googleService instanceof Error) {
        console.error(<Error> googleService);
        return false;
    }
    const isTokenLoaded = await googleService.loadToken();
    if (isTokenLoaded) return false;
    const { web: { redirect_uris: [ redirect_uri ] }} = <GoogleCredentials> googleCredentials
    const authUrl = googleService.generateAuthUrl(redirect_uri);

    const app = new Koa();
    const router = new Router();
    let server: Server;
    const { port, host, logs }: ServerConfig = config.server;

    const loggerRoutes = LoggerRouteGenerator(logs, config['persistent-storage']);
    loggerRoutes.forEach(route => app.use(route));
    const callbackUrl = url.parse(redirect_uri).pathname;
    router
        .get(callbackUrl, async (ctx: Koa.Context) => {
            const token = await googleService.retreiveToken(ctx.query.code).catch(e => e);
            if (token instanceof Error) {
                ctx.status = 503;
                ctx.body = token.message;
                return;
            }
            ctx.redirect('/');
            googleService.initializeApis();
            const fileInfo = await getFile(googleService, config['spreadsheet']['spreadsheetId']);
            await fs.writeFile(path.join(config['persistent-storage'], 'fileinfo.json'), JSON.stringify(fileInfo, null, 4)).catch(Function);
            return server.close();
        })
        .get('/challenge', async (ctx: Koa.Context) => {
            ctx.redirect(authUrl);
            return;
        })
        .get('/abort', async (ctx: Koa.Context) => {
            ctx.status = 200;
            ctx.body = 'Server killed';
            return server.close();
        });

    server = app
        .use(router.routes())
        .use(router.allowedMethods())
        .use(async (ctx: Koa.Context) => {
            ctx.type = 'html';
            ctx.body = createReadStream(config['google-auth-page']);
        })
        .listen(port, host, () => {
            console.log(`Google authorization server us listening on port ${host}:${port}`);
        });
    return server;
}

export default main;