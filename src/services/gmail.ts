import GoogleService from "@services/google";
import { promisify } from "util";
import MailComposer = require('nodemailer/lib/mail-composer');
import Mail = require("nodemailer/lib/mailer");
import Ejs = require('ejs');
import { promises as fs } from "fs";

export type SimpleMailOptions = {
    from?: string,
    to: string,
    cc?: string,
    subject: string,
    html?: string,
    text?: string,
    attachments?: Mail.Attachment[],
    template?: string
    locals?: string|any
}

export default class GmailService {

    private templateCache = {};
    private localsCache = {};

    constructor(private googleService: GoogleService) {
    }
    
    public async loadTemplate(file: string) {
        if (!this.templateCache[file]) {
            this.templateCache[file] = (await fs.readFile(file)).toString('utf-8');
        }
        return this.templateCache[file];
    }   
    public async loadLocals(file: string) {
        if (!this.localsCache[file]) {
            const text = (await fs.readFile(file)).toString('utf-8');
            this.localsCache[file] = JSON.parse(text);
        }
        return this.localsCache[file];
    } 
    private sendRaw = promisify(this.googleService.Gmail.users.messages.send.bind(this.googleService.Gmail.users.messages))
    public async send(options: SimpleMailOptions) {
        if (options.template) {
            options.html = await this.renderTemplate(options.template, options.locals);
        }
        const {from, to, cc, subject, html, text, attachments } = options;
        const mail = await new MailComposer({
            from, to, cc, subject, html, text, attachments
        }).compile().build();
        const response = await this.sendRaw({
            userId: 'me',
            resource: {
              raw: mail.toString('base64')
            }
        })
    }
    private async renderTemplate(template: string, locals?: string|object) {
        const html = await this.loadTemplate(template);
        if (typeof locals === 'string') {
            return Ejs.render(html, await this.loadLocals(locals));
        } else if(typeof locals === 'object') {
            return Ejs.render(html, await locals);
        }
        return html;
    }
}