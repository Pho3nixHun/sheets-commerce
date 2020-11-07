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
exports.PaymentStatus = exports.ChallengePreference = exports.Unit = exports.RecurrenceType = exports.PaymentType = exports.FundingSources = exports.Currency = exports.Locale = exports.Environment = void 0;
const Barion = require("node-barion");
var Environment;
(function (Environment) {
    Environment["PROD"] = "prod";
    Environment["TEST"] = "test";
})(Environment = exports.Environment || (exports.Environment = {}));
var Locale;
(function (Locale) {
    Locale["CZ"] = "cs-CZ";
    Locale["DE"] = "de-DE";
    Locale["US"] = "en-US";
    Locale["ES"] = "es-ES";
    Locale["FR"] = "fr-FR";
    Locale["HU"] = "hu-HU";
    Locale["SK"] = "sk-SK";
    Locale["SI"] = "sl-SI";
    Locale["GR"] = "el-GR";
})(Locale = exports.Locale || (exports.Locale = {}));
var Currency;
(function (Currency) {
    Currency["CZK"] = "CZK";
    Currency["EUR"] = "EUR";
    Currency["HUF"] = "HUF";
    Currency["USD"] = "USD";
})(Currency = exports.Currency || (exports.Currency = {}));
var FundingSources;
(function (FundingSources) {
    FundingSources["BALANCE"] = "Balance";
    FundingSources["ALL"] = "All";
})(FundingSources = exports.FundingSources || (exports.FundingSources = {}));
var PaymentType;
(function (PaymentType) {
    PaymentType["IMMIDIATE"] = "Immediate";
    PaymentType["RESERVATION"] = "Reservation";
    PaymentType["DELAYEDCAPTURE"] = "DelayedCapture";
})(PaymentType = exports.PaymentType || (exports.PaymentType = {}));
var RecurrenceType;
(function (RecurrenceType) {
    RecurrenceType["MERCHANTINiTiATEDPAYMENT"] = "MerchantInitiatedPayment";
    RecurrenceType["ONECLICKPAYMENT"] = "OneClickPayment";
    RecurrenceType["RECURRINGPAYMENT"] = "RecurringPayment";
})(RecurrenceType = exports.RecurrenceType || (exports.RecurrenceType = {}));
var Unit;
(function (Unit) {
    Unit["PC"] = "DB";
    Unit["NONE"] = "";
})(Unit = exports.Unit || (exports.Unit = {}));
var ChallengePreference;
(function (ChallengePreference) {
    ChallengePreference["NOPREFERENCE"] = "NoPreference";
    ChallengePreference["CHALLENGEREQUIRED"] = "ChallengeRequired";
    ChallengePreference["NOCHALLENGENEEDED"] = "NoChallengeNeeded";
})(ChallengePreference = exports.ChallengePreference || (exports.ChallengePreference = {}));
var PaymentStatus;
(function (PaymentStatus) {
    PaymentStatus["PREPARED"] = "Prepared";
    PaymentStatus["STARTED"] = "Started";
    PaymentStatus["IN_PROGRESS"] = "InProgress";
    PaymentStatus["WAITING"] = "Waiting";
    PaymentStatus["RESERVED"] = "Reserved";
    PaymentStatus["AUTHORIZED"] = "Authorized";
    PaymentStatus["CANCELED"] = "Canceled";
    PaymentStatus["SUCCEEDED"] = "Succeeded";
    PaymentStatus["FAILED"] = "Failed";
    PaymentStatus["PARTIALLY_SUCCEEDED"] = "PartiallySucceeded";
    PaymentStatus["EXPIRED"] = "Expired";
})(PaymentStatus = exports.PaymentStatus || (exports.PaymentStatus = {}));
class BarionService {
    constructor(clientOptions, serviceOptions) {
        this.clientOptions = clientOptions;
        this.serviceOptions = serviceOptions;
        this.client = new Barion(this.clientOptions);
    }
    initiatePayment(order) {
        return __awaiter(this, void 0, void 0, function* () {
            const paymentBody = Object.assign({}, this.serviceOptions.defaults, order);
            return this.client.startPayment(paymentBody);
        });
    }
    getPaymentState(PaymentId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.client.getPaymentState({ PaymentId });
        });
    }
    isPaymentSucceeded(paymentDetails) {
        return paymentDetails.Status === PaymentStatus.SUCCEEDED;
    }
}
exports.default = BarionService;
