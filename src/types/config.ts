export type LogConfig = {
    format?: string,
    interval?: string,
    size?: string,
    compress?: string,
    maxFiles?: number
}
export enum LogName {
    DEBUG ='debug',
    ACCESS = 'access',
    ERROR ='error'
}
export type LogConfigs = {
    [name in LogName]: LogConfig
}

export type Static = {
    root: string,
    opts?: {
        maxage?: number,
        hidden?: boolean,
        index?: string,
        defer?: boolean,
        gzip?: boolean,
        brotli?: boolean,
        extensions?: string[] | boolean;
    }
}

export type ServerConfig = {
    port: number,
    host: string,
    logs: LogConfigs,
    static?: Static
}
export type SpreadsheetConfig = {
    spreadsheetId: string,
    ranges: { [key in string]: string },
    fileId: string,
    dbPath: string,
    watchChannelId: string,
    watchNotificationUrl: string
}
export type Email = string;
export type EmailConfig = {
    from: Email,
    technical: Email,
    sales: Email,
    templates: {
        transactional: {
            html: string,
            locals: string
        }
    }
}
export type viewRenderOptions = {
    layout: boolean,
    cache: boolean,
    async: boolean
}
export type templates = {
    [key in string]: {
        html: string,
        locals: string
    }
}
export type views = {
    options: viewRenderOptions,
    templates: templates
}

export type Config = {
    "persistent-storage": string,
    "google-credentials-file": string,
    "google-refreshtoken-file": string,
    "szamlazz.hu-config": string,
    "barion-config": string,
    "google-watch-response-file": string,
    views: views
    spreadsheet: SpreadsheetConfig,
    email: EmailConfig,
    url: string,
    server: ServerConfig
}