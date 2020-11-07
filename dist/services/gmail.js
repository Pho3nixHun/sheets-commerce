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
const util_1 = require("util");
const MailComposer = require("nodemailer/lib/mail-composer");
const Ejs = require("ejs");
const fs_1 = require("fs");
class GmailService {
    constructor(googleService) {
        this.googleService = googleService;
        this.templateCache = {};
        this.localsCache = {};
        this.sendRaw = util_1.promisify(this.googleService.Gmail.users.messages.send.bind(this.googleService.Gmail.users.messages));
    }
    loadTemplate(file) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.templateCache[file]) {
                this.templateCache[file] = (yield fs_1.promises.readFile(file)).toString('utf-8');
            }
            return this.templateCache[file];
        });
    }
    loadLocals(file) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.localsCache[file]) {
                const text = (yield fs_1.promises.readFile(file)).toString('utf-8');
                this.localsCache[file] = JSON.parse(text);
            }
            return this.localsCache[file];
        });
    }
    send(options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (options.template) {
                options.html = yield this.renderTemplate(options.template, options.locals);
            }
            const { from, to, cc, subject, html, text, attachments } = options;
            const mail = yield new MailComposer({
                from, to, cc, subject, html, text, attachments
            }).compile().build();
            const response = yield this.sendRaw({
                userId: 'me',
                resource: {
                    raw: mail.toString('base64')
                }
            });
        });
    }
    renderTemplate(template, locals) {
        return __awaiter(this, void 0, void 0, function* () {
            const html = yield this.loadTemplate(template);
            if (locals) {
                return Ejs.render(html, yield this.loadLocals(locals));
            }
            return html;
        });
    }
}
exports.default = GmailService;
