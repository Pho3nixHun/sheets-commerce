import { OrderRow, State as OrderRowState } from "@definitions/Order";
import SheetsService from "./sheets";
import { ProductRow } from "@definitions/Product";
import { v4 as uuidv4 } from 'uuid';

import * as ZIPS from '@utils/zip.json';
import BarionService, { PaymentStatus } from "@services/barion";
import SzamlazzService, { BuyerOptions, InvoiceOptions, PaymentMethod } from "@services/szamlazz";
import GmailService, { SimpleMailOptions } from "@services/gmail";

export class ErrorWithDetails extends Error {
    constructor(public readonly message, public readonly details?: Object) {
        super(message);
    }
}

export enum Action {
    REDIRECT = 'REDIRECT',
    NONE = 'NONE',
    INFORM = 'INFORM',
    ERROR = 'ERROR'
}

export type ClientTask = {
    Action: Action,
    Data: any 
}

export class Order {

    public $row: number;
    public InvoiceNumber: string;

    constructor(
        public readonly name: string,
        public readonly email: string,
        public readonly phone: string,
        public readonly address: Order.Address,
        public readonly invoice: Order.InvoiceAddress,
        public readonly description?: string,
        public readonly comment?: string,
        public readonly items: Order.Item[] = [],
        public readonly orderNumber: string = uuidv4(),
        public details: any[] = [],
        public state: Order.State = Order.State.INITIAL
    ) {
        
    }

    static fromSheets(orderRow: OrderRow) {
        const order = new Order(
            orderRow.Customer,
            orderRow.Email,
            orderRow.Phone,
            <Order.Address> orderRow.ShippingAddress,
            <Order.InvoiceAddress> orderRow.InvoiceAddress,
            orderRow.Description,
            orderRow.Comment,
            orderRow.Items,
            orderRow.OrderNumber,
            orderRow.Details
        );
        order.$row = orderRow.$row;
        return order;
    }

    static fromNativeInput(order: NativeInput.NativeOrder): Order {
        const { Address, Comment, Email, Invoice, Name, Phone, Items: NativeItem } = order;
        const isNameValid = Order.validateName(Name);
        const isAddressValid = Order.validateAddress(Address);
        const isInvoiceAddressValid = Order.validateAddress(Invoice);
        const isEmailValid = Order.validateEmail(Email);
        const isPhoneValid = Order.validatePhoneNumber(Phone);
        const isOrderValid = isNameValid && isAddressValid && isInvoiceAddressValid && isEmailValid && isPhoneValid;
        if (!isOrderValid) {
            throw new ErrorWithDetails('Input does not seems to be a valid order.', { isNameValid, isAddressValid, isInvoiceAddressValid, isEmailValid, isPhoneValid, isOrderValid });
        }
        return new Order(Name, Email, Phone, Address, Invoice, Comment);
    }

    static validateName(name: string): boolean {
        return typeof name === 'string' && name.length > 0;
    }

    static validatePhoneNumber(phonenumber: string): boolean {
        return /^(\+|0{2})?(\d{2})?(\d{2})(\d{6,7})$/g.test(phonenumber);
    }

    static validateEmail(email: string): boolean {
        return /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(email);
    }

    static readonly zips = ZIPS.map(x => x.code)

    static validateAddress(address: any): boolean {
        if (address) {
            const { City, Street, Zip, TaxNumber } = <NativeInput.NativeInvoiceAddress> address;
            const isCityValid = City && typeof City === 'string';
            const isStreetValid = Street && typeof Street === 'string'
            const isZipValid = Zip && Order.zips.includes(`${Zip}`);
            const parsedTaxNumber = Order.taxNumberValidators.parseNumber(TaxNumber);
            let isTaxNumberValid = TaxNumber === '' || TaxNumber === undefined;
            if (parsedTaxNumber.parsed) {
                const {base, check, type, place} = parsedTaxNumber;
                const isBaseValid = true; // Too much hasle
                const isCheckValid = true; // Too much hasle
                const isTypeValid = Order.taxNumberValidators.types.includes(type);
                const isPlaceValid = Order.taxNumberValidators.places.includes(place);
                isTaxNumberValid = isBaseValid && isCheckValid && isTypeValid && isPlaceValid;
            }
            return isCityValid && isStreetValid && isZipValid && isTaxNumberValid;
        }
        return false;
    }

    static readonly taxNumberValidators = {
        parseNumber(taxNumber: string): {base: string, check: string, type: string, place: string, parsed: boolean} {
            const regexResult = /^(\d{7})(\d{1})-?(\d{1})-?(\d{2})$/g.exec(taxNumber);
            return regexResult ? {
                base: regexResult[1],
                check: regexResult[2], 
                type: regexResult[3],
                place: regexResult[4],
                parsed: true
            } : {
                base: '',
                check: '', 
                type: '',
                place: '',
                parsed: false
            };
        },
        types: ['1', '2', '3', '4', '5'],
        places: [
            '02', '22',
            '03', '23',
            '04', '24',
            '05', '25',
            '06', '26',
            '07', '27',
            '08', '28',
            '09', '29',
            '10', '30',
            '11', '31',
            '12', '32',
            '13', '33',
            '14', '34',
            '15', '35',
            '16', '36',
            '17', '37',
            '18', '38',
            '19', '39',
            '20', '40',
            '41', '42', '43', '44', '51'
        ]
    }

    addItems(Items: ProductRow[]) {
        Items.forEach(this.items.push.bind(this.items));
    }

    get total(): number {
        return this.items.reduce((acc, itm) => acc + itm.count * itm.Price, 0);
    }

    private get orderItems() {
        return this.items.map(itm => ({
            Quantity: itm.count,
            Name: itm.Name,
            Description: itm.Description,
            Unit: itm.Unit || 'x',
            UnitPrice: itm.Price,
            ItemTotal: itm.Price * itm.count
        }))
    }
    
    toJSON() {
        return {
            OrderNumber: this.orderNumber,
            Description: this.description,
            Items: this.items,
            Customer: this.name,
            Phone: this.phone,
            Email: this.email,
            Total: this.total,
            ShippingAddress: this.address,
            InvoiceAddress: this.invoice,
            Comment: this.comment,
            State: this.state,
            InvoiceNumber: this.InvoiceNumber,
            $row: this.$row
        }
    }

    toOrderBody(payee: string, defaults: any) {
        return Object.assign({}, defaults, {
            OrderNumber: this.orderNumber,
            PaymentRequestId: `PR-${this.orderNumber}`,
            Transactions: [{
                POSTransactionId: this.orderNumber,
                Payee: payee,
                Items: this.orderItems,
                Total: this.total,
            }]
        });
    }
}

export namespace Order {
    export import State = OrderRowState;
    export type Address = {
        City: string,
        Zip: string,
        Street: string
    };
    export type InvoiceAddress = { TaxNumber: string } & Address;
    export type Item = {
        id: number,
        count: number
    } & ProductRow;
    export type Order = {
        Address: Address,
        Comment?: string,
        Email: string,
        Items: Item[]
        Invoice: InvoiceAddress,
        Name: string,
        Phone: string
    };
    export type OrderBody = {
        OrderNumber: string,
        PaymentRequestId: string,
        Transactions: {
            POSTransactionId: string,
            Payee: string,
            Items: Order.Item[],
            Total: number
        }[]
    };
}

export class OrderManager {
    static Order = Order;
    static StateOrder = [
        Order.State.AWAITING_PAYMENT,
        Order.State.PAYMENT_FAILED,
        Order.State.INVOICE_FAILED,
        Order.State.EMAIL_FAILED,
        Order.State.DONE
    ];

    constructor(
        private paymentService: BarionService,
        private invoiceService: SzamlazzService,
        private emailService: GmailService,
        private orderService: SheetsService<OrderRow>,
        private productService: SheetsService<ProductRow>,
        private options: OrderManager.Options
    ) {
    }
/*
    private checkOutstandingOrdersInterval: typeof setInterval;
    async checkOutstandingOrders() {
        const [outstandingPayments, missingInvoice, missingEmail] = await Promise.all([
            await this.orderService.find({ State: Order.State.AWAITING_PAYMENT }),
            await this.orderService.find({ State: Order.State.INVOICE_FAILED }),
            await this.orderService.find({ State: Order.State.EMAIL_FAILED })
        ]);

        for (let order of outstandingPayments) {
            const lastDetail = order.Details.slice(-1);
            const { PaymentId, Status } = lastDetail.pop();
            const paymentState = await this.paymentService.getPaymentState(PaymentId).catch(ex => ex);
            if (paymentState.Status !== Status) {
                this.onPaymentUpdate(PaymentId, paymentState, order);
            }
        }
        for (let order of missingInvoice) {
            //Fetch invoice if available, send mail
        }
        for (let order of missingEmail) {
            //Fetch invoice if available, send mail
        }
    } */

    async createOrder(nativeOrder: NativeInput.NativeOrder): Promise<Order> {
        const order = Order.fromNativeInput(nativeOrder);
        const nativeItems = (nativeOrder && nativeOrder.Items) || [];
        if (nativeItems.length < 1)
            throw new ErrorWithDetails('Invalid Item length', {nativeItems});
        const isCountsValid = nativeItems.every(itm => parseInt(itm.count) > 0);
        if (!isCountsValid)
            throw new ErrorWithDetails('Invalid count property', {nativeItems});
        const ids = [...new Set(nativeItems.map(itm => itm.id))];
        const uniqueItems = ids.map((id) => {
            const count = nativeItems.filter(itm => itm.id === id).reduce((acc, itm) => acc + parseInt(itm.count), 0);
            return { id: parseInt(id), count };
        })
        const validItems = await this.productService.find({ $row: { $in: uniqueItems.map(itm => itm.id) }});
        if (validItems.length !== uniqueItems.length)
            throw new ErrorWithDetails('Some items cannot be found', { uniqueItems, nativeItems });
        const finalItems = uniqueItems.map(itm => Object.assign({}, itm, validItems.find(vitm => vitm.$row === itm.id )));
        finalItems.forEach(itm => order.items.push(itm));
        const result = await this.orderService.create({
            OrderNumber: order.orderNumber,
            Description: finalItems.map(itm => `${itm.count} x ${itm.Id}, ${itm.Description}`).join('\n'),
            Items: finalItems,
            Customer: order.name,
            Phone: order.phone,
            Email: order.email,
            Total: order.total,
            ShippingAddress: order.address,
            InvoiceAddress: order.invoice,
            Comment: order.comment,
            State: order.state,
            Details: order.details
        }).catch(ex => ex);
        if (result instanceof Error) {
            throw result;
        }
        return order;

    }

    async onNewOrder(data) {
        const order = await this.createOrder(data).catch(ex => ex);
        if (order instanceof Order) {
            return {
                Action: Action.REDIRECT,
                Data: await this.getPaymentUrl(order)
            }
        }
        return {
            Action: Action.ERROR,
            Data: order
        }
    }

    async onPaymentUpdate(paymentId: string, paymentState?, orderRow?: OrderRow) {
        const _paymentState = paymentState || await this.paymentService.getPaymentState(paymentId).catch(ex => ex);
        if (_paymentState instanceof Error) {
            throw new ErrorWithDetails(_paymentState.message, { paymentId });
        }
        const { Status, OrderNumber } = _paymentState;
        !orderRow && await this.orderService.refresh();
        const _orderRow = orderRow || await this.orderService.findOne({ OrderNumber, State: Order.State.AWAITING_PAYMENT });
        if (_orderRow) {
            const order = Order.fromSheets(_orderRow);
            if (Status === PaymentStatus.SUCCEEDED) {
                const invoiceResponse = await this.createInvoice(order).catch(ex => ex);
                if (invoiceResponse instanceof Error) {
                    this.updateOrder(order, Order.State.INVOICE_FAILED, invoiceResponse);
                    throw new ErrorWithDetails('Invoice creation failed', { invoiceResponse });
                }
                order.InvoiceNumber = invoiceResponse.invoiceId;
                const emailResponse = await this.sendEmails(order, invoiceResponse.pdf).catch(ex => ex);
                if (emailResponse instanceof Error)  {
                    this.updateOrder(order, Order.State.EMAIL_FAILED, emailResponse);
                    throw new ErrorWithDetails('Email cannot be sent', { emailResponse });
                }
                this.updateOrder(order, Order.State.DONE, _paymentState);
            }
            if ([PaymentStatus.CANCELED, PaymentStatus.EXPIRED, PaymentStatus.FAILED, PaymentStatus].includes(Status)) {
                this.updateOrder(order, Order.State.PAYMENT_FAILED);
            }
            return {
                Action: Action.NONE,
                Data: _paymentState
            };
        }
        throw new ErrorWithDetails(`There is no active order with id: ${paymentId}`, { paymentId });
    }
    async createInvoice(order: Order) {
        const invoiceOptions: InvoiceOptions = {
            paymentMethod: PaymentMethod.CreditCard,
            items: order.items.map(itm => this.invoiceService.itemMapper(itm.Name, itm.count, itm.Price))
        };
        const buyerOptions: BuyerOptions = this.invoiceService.buyerBuilder(
            order.name,
            order.invoice.Zip,
            order.invoice.City,
            order.invoice.Street,
            order.email
        )
        const response = await this.invoiceService.createInvoice(
            invoiceOptions,
            buyerOptions
        );
        return response;
    }
    async sendEmails(order: Order, invoice: Buffer) {
        const locals = <any> Object.assign({}, this.options.emailOptions.templates.transactional.locals);
        locals.coupon.link = `${locals.coupon.base}/${order.orderNumber}`;
        const emailOptions: SimpleMailOptions = {
            to: order.email,
            subject: this.options.emailOptions.templates.transactional.subject,
            attachments: [
                { filename: `${order.name}.pdf`, content: invoice}
            ],
            template: this.options.emailOptions.templates.transactional.html,
            locals: this.options.emailOptions.templates.transactional.locals
        }
        return this.emailService.send(emailOptions);
    }

    async updateOrder(order: Order, state?, ...details) {
        let orderRowToUpdate;
        if (isNaN(order.$row)) {
            await this.orderService.refresh();
            orderRowToUpdate = await this.orderService.findOne({ OrderNumber: order.orderNumber }).catch(ex => ex);
            if (orderRowToUpdate instanceof Error) throw new ErrorWithDetails('Insufficent parameters to find Order', {order});
        } else {
            orderRowToUpdate = order.toJSON();
        }
        orderRowToUpdate.State = state;
        if (orderRowToUpdate.Details) orderRowToUpdate.Details.push(...details);
        else orderRowToUpdate.Deatils = [...details];
        this.orderService.update(orderRowToUpdate);
    }

    async getOrderState(paymentId: string) {
        const noOrderResponse = {
            Action: Action.ERROR,
            Data: new ErrorWithDetails('No such order', paymentId)
        }
        const paymentState = await this.paymentService.getPaymentState(paymentId).catch(ex => false);
        if (!paymentState) return noOrderResponse;

        const { OrderNumber } = paymentState;
        await this.orderService.refresh();
        const orderRow = await this.orderService.findOne({ OrderNumber });
        if (!orderRow) return noOrderResponse;
        
        return {
            Action: Action.INFORM,
            Data: {
                OrderNumber,
                State: orderRow.State
            }
        }
    }

    async getPaymentUrl(order: Order): Promise<string> {
        const paymentBody = order.toOrderBody(this.options.paymentOptions.Payee, this.options.paymentOptions.default);
        const response = await this.paymentService.initiatePayment(paymentBody);
        await this.updateOrder(order, Order.State.AWAITING_PAYMENT, response).catch(ex => false);
        return response.GatewayUrl;
    }

}

export namespace NativeInput {
    export type NativeOrder = {
        Address: NativeAddress,
        Comment?: string,
        Email: string,
        Items: NativeItem[]
        Invoice: NativeInvoiceAddress,
        Name: string,
        Phone: string
    }
    export type NativeItem = {
        count: string,
        id: string
    }
    export type NativeAddress = Order.Address
    export type NativeInvoiceAddress = Order.InvoiceAddress
}

export namespace OrderManager {
    export type Options = {
        paymentOptions: Options.paymentOptions & { [key: string]: any },
        emailOptions: {
            from: string,
            technical: string,
            sales: string,
            templates: {
                [key in string]: {
                    subject?: string,
                    html: string,
                    locals: string
                }
            }
        },
        invoiceOptions: Object
    }

    export namespace Options {
        export type paymentOptions = {
            Payee: string,
            default: {
                [key in string]: any
            }
        }
    }

    export enum InputVector {
        NEW,
        PAYMENT_UPDATE,
        USER_REQUESTS_UPDATE,
    } 

}