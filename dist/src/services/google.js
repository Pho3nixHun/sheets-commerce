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
exports.AccessType = void 0;
const fs_1 = require("fs");
const googleapis_1 = require("googleapis");
const fileRights_1 = require("@utils/fileRights");
const util_1 = require("util");
var AccessType;
(function (AccessType) {
    AccessType["OFFLINE"] = "offline";
})(AccessType = exports.AccessType || (exports.AccessType = {}));
class GoogleService {
    constructor(credentials, tokenPath) {
        this.credentials = credentials;
        this.tokenPath = tokenPath;
        // This needs to be passed in
        this.scopes = [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/drive.readonly'
        ];
        this.accesType = AccessType.OFFLINE;
        if (GoogleService.initialized) {
            return GoogleService.instance;
        }
        this.initializeOauth2Client();
    }
    static get initialized() {
        return GoogleService.instance instanceof GoogleService;
    }
    initializeOauth2Client() {
        const { client_id, client_secret, redirect_uris } = this.credentials.web;
        this.client = new googleapis_1.google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    }
    isTokenAvailable() {
        return __awaiter(this, void 0, void 0, function* () {
            return !!this.tokenPath && (yield fileRights_1.fileExists(this.tokenPath));
        });
    }
    readToken() {
        return __awaiter(this, void 0, void 0, function* () {
            const rawContent = yield fs_1.promises.readFile(this.tokenPath);
            return JSON.parse(rawContent.toString("utf-8"));
        });
    }
    loadToken(token) {
        return __awaiter(this, void 0, void 0, function* () {
            if (token) {
                this.client.setCredentials(token);
                return true;
            }
            else if (yield this.isTokenAvailable()) {
                const existingToken = yield this.readToken().catch(ex => false);
                if (existingToken) {
                    this.client.setCredentials(existingToken);
                    return true;
                }
            }
            return false;
        });
    }
    saveToken(token) {
        return __awaiter(this, void 0, void 0, function* () {
            return fs_1.promises.writeFile(this.tokenPath, JSON.stringify(token));
        });
    }
    retreiveToken(authCode) {
        return __awaiter(this, void 0, void 0, function* () {
            const getToken = util_1.promisify(this.client.getToken.bind(this.client));
            const token = yield getToken(authCode);
            if (token instanceof Error) {
                throw token;
            }
            this.saveToken(token);
            yield this.loadToken(token);
            return token;
        });
    }
    isAuthorized() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.loadToken();
        });
    }
    generateAuthUrl(redirect_uri) {
        if (this.client) {
            return this.client.generateAuthUrl({
                access_type: this.accesType,
                scope: this.scopes,
                redirect_uri,
                prompt: 'consent' // Needed to get the full token.
            });
        }
        throw new Error('Client needs to be initialized, before you can generate auth url.');
    }
    initializeApis() {
        this.Drive = googleapis_1.google.drive({ version: 'v3', auth: this.client });
        this.Sheets = googleapis_1.google.sheets({ version: 'v4', auth: this.client });
        this.Gmail = googleapis_1.google.gmail({ version: 'v1', auth: this.client });
    }
}
exports.default = GoogleService;
