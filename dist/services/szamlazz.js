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
exports.Language = exports.Currency = exports.PaymentMethod = void 0;
const szamlazz_js_1 = require("szamlazz.js");
Object.defineProperty(exports, "PaymentMethod", { enumerable: true, get: function () { return szamlazz_js_1.PaymentMethod; } });
Object.defineProperty(exports, "Currency", { enumerable: true, get: function () { return szamlazz_js_1.Currency; } });
Object.defineProperty(exports, "Language", { enumerable: true, get: function () { return szamlazz_js_1.Language; } });
const util_1 = require("util");
const fs_1 = require("fs");
const path_1 = require("path");
class SzamlazzService {
    constructor(options) {
        this.options = options;
        this.client = new szamlazz_js_1.Client(Object.assign({ requestInvoiceDownload: true }, this.options.clientOptions));
        this.seller = new szamlazz_js_1.Seller(this.options.sellerOptions);
        this.issueInvoice = util_1.promisify(this.client.issueInvoice.bind(this.client));
        this.defaultVat = this.options.sellerOptions.vat || 27;
        this.defaultUnit = this.options.sellerOptions.unit || 'db';
        this.defaultInvoiceOptions = {
            currency: szamlazz_js_1.Currency.Ft,
            seller: this.seller,
            language: szamlazz_js_1.Language.Hungarian,
            prepaymentInvoice: false
        };
        fs_1.promises.mkdir(options.storagePath, { recursive: true }).catch(ex => false);
    }
    itemMapper(label, quantity, grossUnitPrice, unit = this.defaultUnit, vat = this.defaultVat) {
        return { label, quantity, unit, vat, grossUnitPrice };
    }
    buyerBuilder(name, zip, city, address, email, country = 'HU') {
        return {
            name, country, zip, city, address, email,
            issuerName: this.options.sellerOptions.issuerName,
            sendEmail: false,
            identifier: 1
        };
    }
    createInvoice(invoiceOptions, buyer) {
        return __awaiter(this, void 0, void 0, function* () {
            const invoice = new szamlazz_js_1.Invoice(Object.assign({
                buyer: new szamlazz_js_1.Buyer(buyer)
            }, this.defaultInvoiceOptions, invoiceOptions, {
                items: invoiceOptions.items.map(item => new szamlazz_js_1.Item(item)),
            }));
            return this.issueInvoice(invoice);
        });
    }
    savePdf(filename, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const filepath = path_1.join(this.options.storagePath, /.*\.pdf$/ig.test(filename) ? filename : `${filename}.pdf`);
            return fs_1.promises.writeFile(filepath, data);
        });
    }
}
exports.default = SzamlazzService;
