import { PaymentMethod, Seller, Client, Buyer, Invoice, Item, Currency, Language } from 'szamlazz.js';

import { promisify } from "util";
import { promises as fs } from 'fs';
import { join } from 'path';
export { PaymentMethod, Currency, Language }

export type ClientOptions = {
    authToken: string,
    eInvoice?: Boolean, // create e-invoice. optional, default: false
    passphrase?: string, // passphrase for e-invoice. optional
    requestInvoiceDownload?: boolean, // downloads the issued pdf invoice. optional, default: false
    downloadedInvoiceCount?: number, // optional, default: 1
    responseVersion?: number // optional, default: 1
}

export type BankOptions = {
    name: string,
    accountNumber: string
}

export type EmailOptions = {
    replyToAddress: string,
    subject: string,
    message: string
}

export type SellerOptions = {
    bank: BankOptions,
    email: EmailOptions,
    issuerName: string,
    vat: number,
    unit: string
}

export type BuyerOptions = {
    name: string,
    country: string,
    zip: string,
    city: string,
    address: string,
    taxNumber?: string,
    postAddress?: {
        name: string,
        zip: string,
        city: string,
        address: string
    },
    issuerName: string,
    identifier: number,
    phone?: string,
    comment?: string,
    email?: string,
    sendEmail?: boolean
}

export type ItemOptions = {
    label: string,
    quantity: number,
    unit: string,
    vat: number | string, // can be a number or a special string
    netUnitPrice?: number, // calculates gross and net values from per item net
    grossUnitPrice?: number,
    comment: string
}

export type InvoiceOptions = {
  paymentMethod: keyof PaymentMethod, // optional, default: BankTransfer
  currency?: keyof Currency, // optional, default: Ft
  language?: keyof Language, // optional, default: Hungarian
  //seller: typeof Seller, // the seller, required
  //buyer: typeof Buyer, // the buyer, required
  items: (typeof Item)[], // the sold items, required
  prepaymentInvoice?: boolean // prepayment/deposit invoice should be issued, optional, default: false 
}

export type InvioceResponse = {
    pdf: Buffer,
    invoiceId: string
}

export default class SzamlazzService {
    private client = new Client(Object.assign({ requestInvoiceDownload: true }, this.options.clientOptions));
    private seller = new Seller(this.options.sellerOptions);
    private issueInvoice = promisify(this.client.issueInvoice.bind(this.client));
    public readonly defaultVat = this.options.sellerOptions.vat || 27;
    public readonly defaultUnit = this.options.sellerOptions.unit || 'db';
    public defaultInvoiceOptions = {
        currency: Currency.Ft,
        seller: this.seller,
        language: Language.Hungarian,
        prepaymentInvoice: false
    }
    constructor(private options: {
        clientOptions: ClientOptions,
        sellerOptions: SellerOptions
        storagePath: string
    }) {
        fs.mkdir(options.storagePath, { recursive: true }).catch(ex => false);
    }
    itemMapper(label, quantity, grossUnitPrice, unit = this.defaultUnit, vat = this.defaultVat) {
        return { label, quantity, unit, vat, grossUnitPrice };
    }
    buyerBuilder(name: string, zip: string, city: string, address: string, email: string, country: string = 'HU'){
        return {
            name, country, zip, city, address, email,
            issuerName: this.options.sellerOptions.issuerName,
            sendEmail: false,
            identifier: 1
        }
    }

    async createInvoice(invoiceOptions: InvoiceOptions, buyer: BuyerOptions): Promise<InvioceResponse> {
        const invoice = new Invoice(Object.assign(
            {
                buyer: new Buyer(buyer)
            },
            this.defaultInvoiceOptions,
            invoiceOptions,
            {
                items: invoiceOptions.items.map(item => new Item(item)),
            }
        ));
        return this.issueInvoice(invoice);
    }
    async savePdf(filename: string, data: Buffer) {
        const filepath = join(
            this.options.storagePath, 
            /.*\.pdf$/ig.test(filename) ? filename : `${filename}.pdf`
        );
        return fs.writeFile(filepath, data);
    }
}
