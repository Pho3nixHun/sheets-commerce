import * as Barion from 'node-barion';

export enum Environment {
    PROD = 'prod',
    TEST = 'test'
}
export enum Locale {
    CZ ='cs-CZ',
    DE = 'de-DE', 
    US = 'en-US',
    ES = 'es-ES',
    FR = 'fr-FR', 
    HU = 'hu-HU',
    SK = 'sk-SK',
    SI = 'sl-SI',
    GR = 'el-GR'
}

export enum Currency {
    CZK = 'CZK',
    EUR = 'EUR',
    HUF = 'HUF',
    USD = 'USD'
}
export enum FundingSources {
    BALANCE = 'Balance',
    ALL = 'All'
}

export type BarionClientOptions = {
    POSKey: string,
    Environment?: Environment,
    ValidateModels?: boolean,
    FundingSources?: FundingSources[]
    GuestCheckOut?: boolean,
    Locale?: Locale,
    Currency?: Currency
}
export type BarionServiceOptions = {
    publicId?: string,
    pixelId?: string,
    defaults: {
        RedirectUrl: string,
        CallbackUrl: string,
    },
    Payee: string
}

export enum PaymentType {
    IMMIDIATE = "Immediate",
    RESERVATION = "Reservation",
    DELAYEDCAPTURE = "DelayedCapture"
}

export enum RecurrenceType {
    MERCHANTINiTiATEDPAYMENT = 'MerchantInitiatedPayment',
    ONECLICKPAYMENT = 'OneClickPayment',
    RECURRINGPAYMENT = 'RecurringPayment'
}

export type PayeeTransactions = {
    POSTransactionId: string,
    Payee: string //e-mail address of a valid Barion wallet,
    Total: number,
    Comment?: string,
}

export enum Unit {
    PC = 'DB',
    NONE = ''
}

export type Item = {
    Name: string,
    Description: string,
    ImageUrl?: string,
    Quantity: number,
    Unit: string,
    UnitPrice: number,
    ItemTotal: number,
    SKU?: string
}

export type PaymentTransaction = PayeeTransactions & {
    PayeeTransactions?: PayeeTransactions[],
    Items: Item[],
}

export type BillingAddress = {
    Country: string,
    City?: string,
    Region?: string | null,
    Zip?: string,
    Street?: string,
    Street2?: string,
    Street3?: string
}

export type ShippingAddress = BillingAddress & {
    FullName?: string
}

export type PayerAccountInformation = {
    AccountId?: string,
    AccountCreated?: Date,
    AccountCreationIndicator?,
    AccountLastChanged?: Date,
    AccountChangeIndicator?,
    PasswordLastChanged?: Date,
    PasswordChangeIndicator?,
    PurchasesInTheLast6Months?: number,
    ShippingAddressAdded?: Date,
    ShippingAddressUsageIndicator?,
    ProvisionAttempts?: number,
    TransactionalActivityPerDay?: number,
    TransactionalActivityPerYear?: number,
    PaymentMethodAdded?: Date,
    SuspiciousActivityIndicator?
}

export type PurchaseInformation = {
    DeliveryTimeframe?,
    DeliveryEmailAddress?: string,
    PreOrderDate?: Date,
    AvailabilityIndicator?,
    ReOrderIndicator?,
    ShippingAddressIndicator?,
    RecurringExpiry?: Date,
    RecurringFrequency?: number,
    PurchaseType?,
    GiftCardPurchase: {
        Amount?: number,
        Count?: number
    },
    PurchaseDate?: Date
}

export enum ChallengePreference {
    NOPREFERENCE = 'NoPreference',
    CHALLENGEREQUIRED = 'ChallengeRequired',
    NOCHALLENGENEEDED = 'NoChallengeNeeded'
}

export type PaymentOptions = {
    PaymentType: PaymentType,
    ReservationPeriod?: string, // Format: d:hh:mm:ss
    DelayedCapturePeriod?: string, // Format: d:hh:mm:ss
    PaymentWindow?: string, // Format: d:hh:mm:ss Default: 30min,
    GuestCheckOut?: boolean,
    InitiateRecurrence?: boolean,
    RecurrenceId?: string,
    FundingSources?: FundingSources[],
    PaymentRequestId: string,
    PayerHint?: string,
    CardHolderNameHint?: string,
    RecurrenceType?: RecurrenceType,
    RedirectUrl?: string,
    CallbackUrl?: string,
    Transactions?: PaymentTransaction[],
    OrderNumber?: string,
    ShippingAddress: ShippingAddress,
    Locale?: Locale,
    Currency?: Currency,
    PayerPhoneNumber?: string,
    PayerWorkPhoneNumber?: string,
    PayerHomeNumber?: string,
    BillingAddress?: BillingAddress,
    PayerAccount?: PayerAccountInformation,
    PurchaseInformation?: PurchaseInformation,
    ChallengePreference: ChallengePreference
}

export enum PaymentStatus {
    PREPARED = 'Prepared',
    STARTED = 'Started',
    IN_PROGRESS = 'InProgress',
    WAITING = 'Waiting',
    RESERVED = 'Reserved',
    AUTHORIZED = 'Authorized',
    CANCELED = 'Canceled',
    SUCCEEDED = 'Succeeded',
    FAILED = 'Failed',
    PARTIALLY_SUCCEEDED = 'PartiallySucceeded',
    EXPIRED = 'Expired'
}

export default class BarionService {
    private client = new Barion(this.clientOptions);
    constructor(private clientOptions: BarionClientOptions, private serviceOptions: BarionServiceOptions) {
        
    }
    async initiatePayment(order: PaymentOptions) {
        const paymentBody = Object.assign({}, this.serviceOptions.defaults, order);
        return this.client.startPayment(paymentBody);
    }
    public async getPaymentState(PaymentId: string) {
        return this.client.getPaymentState({ PaymentId });
    }

    public isPaymentSucceeded(paymentDetails): boolean {
        return paymentDetails.Status === PaymentStatus.SUCCEEDED
    }
}