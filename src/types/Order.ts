import { ShippingAddress, PaymentTransaction, PaymentType, Currency, ChallengePreference, PaymentStatus } from "@services/barion"
import { Row } from "@services/sheets";
import { ProductRow } from '@definitions/Product';

export enum Status {
    INITIAL = 'Initial',
    CREATED = 'Created',
    PENDING = 'Pending',
    SUCCEEDED = 'Succeeded',
    CANCELED = 'Canceled',
    EXPIRED = 'Expired'
}

export enum State {
    INITIAL = 'INITIAL',
    AWAITING_PAYMENT = 'AWAITING PAYMENT',
    PAYMENT_FAILED = 'PAYMENT FAILED',
    INVOICE_FAILED = 'INVOICE FAILED',
    DONE = 'DONE',
    EMAIL_FAILED = 'EMAIL FAILED'
}

export type OrderRow = {
    $row: number,
    OrderNumber: string,
    Description: string,
    Items: ({id: number, count: number} & Row<ProductRow>)[],
    Customer: string,
    Phone: string,
    Email: string,
    Total: number,
    ShippingAddress: {City: string, Zip: string, Street: string},
    InvoiceAddress: {City: string, Zip: string, Street: string, TaxNumber: string},
    InvoiceNumber?: string,
    Details?: {
        OrderNumber: string,
        PaymentRequestId: string,
        PaymentType: PaymentType,
        Transactions: PaymentTransaction[],
        ShippingAddress: ShippingAddress,
        Currency?: Currency,
        CallbackUrl: string,
        ChallengePreference: ChallengePreference,
        RedirectUrl?: string,
        GuestCheckOut?: boolean,
        Status: PaymentStatus,
        PaymentId: string
    }[],
    Comment: string,
    State: State
}

