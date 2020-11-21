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
exports.OrderManager = exports.Order = exports.Action = exports.ErrorWithDetails = void 0;
const Order_1 = require("../types/Order");
const uuid_1 = require("uuid");
const fs = require("fs");
const ZIPS = require("../utils/zip.json");
const barion_1 = require("./barion");
const szamlazz_1 = require("./szamlazz");
class ErrorWithDetails extends Error {
    constructor(message, details) {
        super(message);
        this.message = message;
        this.details = details;
    }
}
exports.ErrorWithDetails = ErrorWithDetails;
var Action;
(function (Action) {
    Action["REDIRECT"] = "REDIRECT";
    Action["NONE"] = "NONE";
    Action["INFORM"] = "INFORM";
    Action["ERROR"] = "ERROR";
})(Action = exports.Action || (exports.Action = {}));
class Order {
    constructor(name, email, phone, address, invoice, description, comment, items = [], orderNumber = uuid_1.v4(), details = [], state = Order.State.INITIAL) {
        this.name = name;
        this.email = email;
        this.phone = phone;
        this.address = address;
        this.invoice = invoice;
        this.description = description;
        this.comment = comment;
        this.items = items;
        this.orderNumber = orderNumber;
        this.details = details;
        this.state = state;
    }
    static fromSheets(orderRow) {
        const order = new Order(orderRow.Customer, orderRow.Email, orderRow.Phone, orderRow.ShippingAddress, orderRow.InvoiceAddress, orderRow.Description, orderRow.Comment, orderRow.Items, orderRow.OrderNumber, orderRow.Details);
        order.$row = orderRow.$row;
        return order;
    }
    static fromNativeInput(order) {
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
    static validateName(name) {
        return typeof name === 'string' && name.length > 0;
    }
    static validatePhoneNumber(phonenumber) {
        return /^(\+|0{2})?(\d{2})?(\d{2})(\d{6,7})$/g.test(phonenumber);
    }
    static validateEmail(email) {
        return /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(email);
    }
    static validateAddress(address) {
        if (address) {
            const { City, Street, Zip, TaxNumber } = address;
            const isCityValid = City && typeof City === 'string';
            const isStreetValid = Street && typeof Street === 'string';
            const isZipValid = Zip && Order.zips.includes(`${Zip}`);
            const parsedTaxNumber = Order.taxNumberValidators.parseNumber(TaxNumber);
            let isTaxNumberValid = TaxNumber === '' || TaxNumber === undefined;
            if (parsedTaxNumber.parsed) {
                const { base, check, type, place } = parsedTaxNumber;
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
    addItems(Items) {
        Items.forEach(this.items.push.bind(this.items));
    }
    get total() {
        return this.items.reduce((acc, itm) => acc + itm.count * itm.Price, 0);
    }
    get orderItems() {
        return this.items.map(itm => ({
            Quantity: itm.count,
            Name: itm.Name,
            Description: itm.Description,
            Unit: itm.Unit || 'x',
            UnitPrice: itm.Price,
            ItemTotal: itm.Price * itm.count
        }));
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
        };
    }
    toOrderBody(payee, defaults) {
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
exports.Order = Order;
Order.zips = ZIPS.map(x => x.code);
Order.taxNumberValidators = {
    parseNumber(taxNumber) {
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
};
(function (Order) {
    Order.State = Order_1.State;
})(Order = exports.Order || (exports.Order = {}));
class OrderManager {
    constructor(paymentService, invoiceService, emailService, orderService, productService, options) {
        this.paymentService = paymentService;
        this.invoiceService = invoiceService;
        this.emailService = emailService;
        this.orderService = orderService;
        this.productService = productService;
        this.options = options;
        this.emailLocals = this.loadJson(this.options.emailOptions.templates.transactional.locals);
    }
    loadJson(jsonPath) {
        const json = fs.readFileSync(jsonPath, { encoding: 'utf-8' });
        return JSON.parse(json);
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
    createOrder(nativeOrder) {
        return __awaiter(this, void 0, void 0, function* () {
            const order = Order.fromNativeInput(nativeOrder);
            const nativeItems = (nativeOrder && nativeOrder.Items) || [];
            if (nativeItems.length < 1)
                throw new ErrorWithDetails('Invalid Item length', { nativeItems });
            const isCountsValid = nativeItems.every(itm => parseInt(itm.count) > 0);
            if (!isCountsValid)
                throw new ErrorWithDetails('Invalid count property', { nativeItems });
            const ids = [...new Set(nativeItems.map(itm => itm.id))];
            const uniqueItems = ids.map((id) => {
                const count = nativeItems.filter(itm => itm.id === id).reduce((acc, itm) => acc + parseInt(itm.count), 0);
                return { id: parseInt(id), count };
            });
            const validItems = yield this.productService.find({ $row: { $in: uniqueItems.map(itm => itm.id) } });
            if (validItems.length !== uniqueItems.length)
                throw new ErrorWithDetails('Some items cannot be found', { uniqueItems, nativeItems });
            const finalItems = uniqueItems.map(itm => Object.assign({}, itm, validItems.find(vitm => vitm.$row === itm.id)));
            finalItems.forEach(itm => order.items.push(itm));
            const result = yield this.orderService.create({
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
        });
    }
    onNewOrder(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const order = yield this.createOrder(data).catch(ex => ex);
            if (order instanceof Order) {
                return {
                    Action: Action.REDIRECT,
                    Data: yield this.getPaymentUrl(order)
                };
            }
            return {
                Action: Action.ERROR,
                Data: order
            };
        });
    }
    onPaymentUpdate(paymentId, paymentState, orderRow) {
        return __awaiter(this, void 0, void 0, function* () {
            const _paymentState = paymentState || (yield this.paymentService.getPaymentState(paymentId).catch(ex => ex));
            if (_paymentState instanceof Error) {
                throw new ErrorWithDetails(_paymentState.message, { paymentId });
            }
            const { Status, OrderNumber } = _paymentState;
            !orderRow && (yield this.orderService.refresh());
            const _orderRow = orderRow || (yield this.orderService.findOne({ OrderNumber, State: Order.State.AWAITING_PAYMENT }));
            if (_orderRow) {
                const order = Order.fromSheets(_orderRow);
                if (Status === barion_1.PaymentStatus.SUCCEEDED) {
                    const invoiceResponse = yield this.createInvoice(order).catch(ex => ex);
                    if (invoiceResponse instanceof Error) {
                        this.updateOrder(order, Order.State.INVOICE_FAILED, invoiceResponse);
                        throw new ErrorWithDetails('Invoice creation failed', { invoiceResponse });
                    }
                    order.InvoiceNumber = invoiceResponse.invoiceId;
                    const emailResponse = yield this.sendEmails(order, invoiceResponse.pdf).catch(ex => ex);
                    if (emailResponse instanceof Error) {
                        this.updateOrder(order, Order.State.EMAIL_FAILED, emailResponse);
                        throw new ErrorWithDetails('Email cannot be sent', { emailResponse });
                    }
                    this.updateOrder(order, Order.State.DONE, _paymentState);
                }
                if ([barion_1.PaymentStatus.CANCELED, barion_1.PaymentStatus.EXPIRED, barion_1.PaymentStatus.FAILED, barion_1.PaymentStatus].includes(Status)) {
                    this.updateOrder(order, Order.State.PAYMENT_FAILED);
                }
                return {
                    Action: Action.NONE,
                    Data: _paymentState
                };
            }
            throw new ErrorWithDetails(`There is no active order with id: ${paymentId}`, { paymentId });
        });
    }
    createInvoice(order) {
        return __awaiter(this, void 0, void 0, function* () {
            const invoiceOptions = {
                paymentMethod: szamlazz_1.PaymentMethod.CreditCard,
                items: order.items.map(itm => this.invoiceService.itemMapper(itm.Name, itm.count, itm.Price))
            };
            const buyerOptions = this.invoiceService.buyerBuilder(order.name, order.invoice.Zip, order.invoice.City, order.invoice.Street, order.email);
            const response = yield this.invoiceService.createInvoice(invoiceOptions, buyerOptions);
            return response;
        });
    }
    sendEmails(order, invoice) {
        return __awaiter(this, void 0, void 0, function* () {
            const locals = Object.assign({}, this.emailLocals);
            locals.coupon.link = `${locals.coupon.base}/${order.orderNumber}`;
            const emailOptions = {
                to: order.email,
                subject: this.options.emailOptions.templates.transactional.subject,
                attachments: [
                    { filename: `${order.name}.pdf`, content: invoice }
                ],
                template: this.options.emailOptions.templates.transactional.html,
                locals
            };
            return this.emailService.send(emailOptions);
        });
    }
    updateOrder(order, state, ...details) {
        return __awaiter(this, void 0, void 0, function* () {
            let orderRowToUpdate;
            if (isNaN(order.$row)) {
                yield this.orderService.refresh();
                orderRowToUpdate = yield this.orderService.findOne({ OrderNumber: order.orderNumber }).catch(ex => ex);
                if (orderRowToUpdate instanceof Error)
                    throw new ErrorWithDetails('Insufficent parameters to find Order', { order });
            }
            else {
                orderRowToUpdate = order.toJSON();
            }
            orderRowToUpdate.State = state;
            if (orderRowToUpdate.Details)
                orderRowToUpdate.Details.push(...details);
            else
                orderRowToUpdate.Deatils = [...details];
            this.orderService.update(orderRowToUpdate);
        });
    }
    getOrderState(paymentId) {
        return __awaiter(this, void 0, void 0, function* () {
            const noOrderResponse = {
                Action: Action.ERROR,
                Data: new ErrorWithDetails('No such order', paymentId)
            };
            const paymentState = yield this.paymentService.getPaymentState(paymentId).catch(ex => false);
            if (!paymentState)
                return noOrderResponse;
            const { OrderNumber } = paymentState;
            yield this.orderService.refresh();
            const orderRow = yield this.orderService.findOne({ OrderNumber });
            if (!orderRow)
                return noOrderResponse;
            return {
                Action: Action.INFORM,
                Data: {
                    OrderNumber,
                    State: orderRow.State
                }
            };
        });
    }
    getPaymentUrl(order) {
        return __awaiter(this, void 0, void 0, function* () {
            const paymentBody = order.toOrderBody(this.options.paymentOptions.Payee, this.options.paymentOptions.default);
            const response = yield this.paymentService.initiatePayment(paymentBody);
            yield this.updateOrder(order, Order.State.AWAITING_PAYMENT, response).catch(ex => false);
            return response.GatewayUrl;
        });
    }
}
exports.OrderManager = OrderManager;
OrderManager.Order = Order;
OrderManager.StateOrder = [
    Order.State.AWAITING_PAYMENT,
    Order.State.PAYMENT_FAILED,
    Order.State.INVOICE_FAILED,
    Order.State.EMAIL_FAILED,
    Order.State.DONE
];
(function (OrderManager) {
    let InputVector;
    (function (InputVector) {
        InputVector[InputVector["NEW"] = 0] = "NEW";
        InputVector[InputVector["PAYMENT_UPDATE"] = 1] = "PAYMENT_UPDATE";
        InputVector[InputVector["USER_REQUESTS_UPDATE"] = 2] = "USER_REQUESTS_UPDATE";
    })(InputVector = OrderManager.InputVector || (OrderManager.InputVector = {}));
})(OrderManager = exports.OrderManager || (exports.OrderManager = {}));
