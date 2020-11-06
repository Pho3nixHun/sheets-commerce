"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.State = exports.Status = void 0;
var Status;
(function (Status) {
    Status["INITIAL"] = "Initial";
    Status["CREATED"] = "Created";
    Status["PENDING"] = "Pending";
    Status["SUCCEEDED"] = "Succeeded";
    Status["CANCELED"] = "Canceled";
    Status["EXPIRED"] = "Expired";
})(Status = exports.Status || (exports.Status = {}));
var State;
(function (State) {
    State["INITIAL"] = "INITIAL";
    State["AWAITING_PAYMENT"] = "AWAITING PAYMENT";
    State["PAYMENT_FAILED"] = "PAYMENT FAILED";
    State["INVOICE_FAILED"] = "INVOICE FAILED";
    State["DONE"] = "DONE";
    State["EMAIL_FAILED"] = "EMAIL FAILED";
})(State = exports.State || (exports.State = {}));
