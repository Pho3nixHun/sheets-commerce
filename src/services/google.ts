import { promises as fs } from 'fs';
import { google } from 'googleapis';

import { fileExists } from '@utils/fileRights';
import { OAuth2Client } from 'google-auth-library';
import { promisify } from 'util';

export type GoogleCredentials = {
    web: {
        client_id: string,
        project_id: string,
        auth_uri: string,
        token_uri: string,
        auth_provider_x509_cert_url: string,
        client_secret: string,
        redirect_uris: string[]
    }
}
export enum AccessType {
    OFFLINE = 'offline'
}

export type AuthToken = any;

export default class GoogleService {
    public Sheets: typeof google.Sheets
    public Drive: typeof google.Drive
    public Gmail: typeof google.Gmail

    static instance: GoogleService;
    static get initialized(): boolean {
        return GoogleService.instance instanceof GoogleService;
    }
    // This needs to be passed in
    readonly scopes: string[] = [
        'https://www.googleapis.com/auth/spreadsheets', 
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/drive.readonly'
    ]
    readonly accesType: AccessType = AccessType.OFFLINE;
    private client: OAuth2Client;
    private initializeOauth2Client():void {
        const { client_id, client_secret, redirect_uris } = this.credentials.web;
        this.client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    }
    private async isTokenAvailable(): Promise<boolean> {
        return !!this.tokenPath && await fileExists(this.tokenPath);
    }
    private async readToken(): Promise<AuthToken> {
        const rawContent = await fs.readFile(this.tokenPath);
        return JSON.parse(rawContent.toString("utf-8"));
    }
    constructor(private credentials: GoogleCredentials, private tokenPath: string) {
        if (GoogleService.initialized) {
            return GoogleService.instance;
        }
        this.initializeOauth2Client();
    }
    async loadToken(token?: AuthToken): Promise<boolean> {
        if (token) {
            this.client.setCredentials(token);
            return true;
        } else if (await this.isTokenAvailable()) {
            const existingToken: AuthToken | boolean = await this.readToken().catch(ex => false);
            if (existingToken) {
                this.client.setCredentials(existingToken);
                return true;
            }
        }
        return false;
    }

    async saveToken(token: AuthToken): Promise<void> {
        return fs.writeFile(this.tokenPath, JSON.stringify(token));
    }
    async retreiveToken(authCode: string): Promise<AuthToken> {
        const getToken = promisify(this.client.getToken.bind(this.client));
        const token = await getToken(authCode);
        if (token instanceof Error) {
            throw token;
        }
        this.saveToken(token);
        await this.loadToken(token);
        return token;
    }
    async isAuthorized(): Promise<boolean> {
        return this.loadToken();
    }
    generateAuthUrl(redirect_uri: string): string {
        if (this.client) {
            return this.client.generateAuthUrl({
                access_type: this.accesType,
                scope: this.scopes,
                redirect_uri,
                prompt: 'consent' // Needed to get the full token.
            });
        }
        throw new Error('Client needs to be initialized, before you can generate auth url.')
    }
    initializeApis() {
        this.Drive = google.drive({ version: 'v3', auth: this.client })
        this.Sheets = google.sheets({ version: 'v4', auth: this.client })
        this.Gmail = google.gmail({ version: 'v1', auth: this.client })
    }
}