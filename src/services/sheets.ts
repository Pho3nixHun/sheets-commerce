import GoogleService from "@services/google";
import { promisify } from "util";
import * as Loki from 'lokijs';

type RangeRegexCaptureGroup = {
    sheet: string,
    startColumn: string,
    startRow: string,
    endColumn: string,
    endRow: string
}

export class RangeDefinition {
    constructor(
        public sheet?: string,
        public startColumn?: string,
        public startRow?: number,
        public endColumn?: string,
        public endRow?: number
        ) { }
    static fromRange(range: string) {
        const formats = [
            // Sheet!A1:B1
            /^(?<sheet>[A-Za-z0-9\-\.\_]+)?\!?(?<startColumn>[A-Z]+)(?<startRow>[0-9]+)\:(?<endColumn>[A-Z]+)(?<endRow>[0-9]+)$/g,
            // Sheet!A:A
            /^(?<sheet>[A-Za-z0-9\-\.\_]+)?\!?(?<startColumn>[A-Z]+)\:(?<endColumn>[A-Z]+)$/g,
            // Sheet!1:1
            /^(?<sheet>[A-Za-z0-9\-\.\_]+)?\!?(?<startRow>[0-9]+)\:(?<endRow>[0-9]+)$/g,
            // Sheet!A1
            /^(?<sheet>[A-Za-z0-9\-\.\_]+)?\!?(?<startColumn>[A-Z]+)(?<startRow>[0-9]+)$/g
        ]
        const execResult = formats.reduce((res:RegExpExecArray | null, re): RegExpExecArray | null => res || re.exec(range), null);
        
        if (!execResult) throw new Error(`Cannot translate range (${range}) to RangeDefinition`);
        const {sheet, startColumn, startRow, endColumn, endRow} = <RangeRegexCaptureGroup> execResult.groups;
        return new RangeDefinition(sheet, startColumn, parseInt(startRow), endColumn, parseInt(endRow));
    }
    public get range(): string {
        if (this.startColumn && this.startRow && this.endColumn && this.endRow) {
            return `${this.sheet}!${this.startColumn}${this.startRow}:${this.endColumn}${this.endRow}`;
        } else if (this.startColumn && this.endColumn) {
            return `${this.sheet}!${this.startColumn}:${this.endColumn}`;
        } else if (this.startRow && this.endRow) {
            return `${this.sheet}!${this.startRow}:${this.endRow}`;
        } else if (this.startColumn && this.startRow) {
            return `${this.sheet}!${this.startColumn}${this.startRow}`;
        } else if (this.sheet) {
            return `${this.sheet}`;
        }
        return '';
    }
}

export type Row<T> = T & {
    isEmpty?: boolean,
    $row: number
}
export type CreateResult = {
    updatedRange: string
    updatedRows: number
    updatedColumns: number
    updatedCells: number,
    $row: number
}
export type DeleteResult = {
    clearedRange: string
}
export type FilterFunction = (r: Row<any>) => boolean|Promise<boolean>;

export default class SheetsService<T> {
    static readonly instances: SheetsService<any>[] = [];
    static async refreshInstances(resourceId: string): Promise<boolean> {
        const affectedInstances = SheetsService.instances
            .filter(instance => instance.fileId === resourceId);
        if (affectedInstances.length > 0) {
            const refreshPromises = affectedInstances.map(instance => instance.refresh().catch(ex => false))
            const results = await Promise.all(refreshPromises);
            return results.every(res => (!!res) === true);
        }
        return false;
    }
    private db: Loki = new Loki(this.dbPath);
    private collection = this.db.addCollection("entities", {
        unique: ["$row"],
        autoupdate: false,
        disableChangesApi: false
    });
    static transformRow(headers: string[], adjustIndexBy: number = 1, row: string[], rowIndex: number): Row<any> {
        const reducer = (acc: Row<any>, header: string, index: number): Row<any> => {
            acc[header] = row[index];
            return acc;
        }
        if (row.length === 0) {
            return { $row: rowIndex + adjustIndexBy, isEmpty: true }
        }
        return headers.reduce(reducer, { $row: rowIndex + adjustIndexBy, isEmpty: false });
    }
    private static stripUpdateResponse(response: any): CreateResult {
        const { updatedCells, updatedRange, updatedColumns, updatedRows, $row } = response;
        return {
            updatedRange,
            updatedCells,
            updatedRows,
            updatedColumns,
            $row
        }
    }
    private static stripAppendResponse(response: any): CreateResult {
        const { updatedCells, updatedRange, updatedColumns, updatedRows, $row } = response;
        return {
            updatedRange,
            updatedCells,
            updatedRows,
            updatedColumns,
            $row
        }
    }
    private static stripClearResponse(response: any): DeleteResult {
        const { clearedRange } = response;
        return {
            clearedRange
        }
    }
    public readonly valueRenderOption = 'UNFORMATTED_VALUE';
    public readonly valueInputOption = 'USER_ENTERED';
    public readonly rangeDefinition: RangeDefinition = RangeDefinition.fromRange(this.range);

    private getRaw = promisify(this.googleService.Sheets.spreadsheets.values.get.bind(this.googleService.Sheets.spreadsheets.values));
    private appendRaw = promisify(this.googleService.Sheets.spreadsheets.values.append.bind(this.googleService.Sheets.spreadsheets.values));
    private updateRaw = promisify(this.googleService.Sheets.spreadsheets.values.update.bind(this.googleService.Sheets.spreadsheets.values));
    private clearRaw = promisify(this.googleService.Sheets.spreadsheets.values.clear.bind(this.googleService.Sheets.spreadsheets.values));
    
    private readPromise: Promise<any> = Promise.resolve();
    private headers: Array<string> = [];
    constructor(
        private googleService: GoogleService, 
        public readonly spreadsheetId: string,
        public readonly fileId: string,
        private range: string, 
        private dbPath: string
    ) {
        SheetsService.instances.push(this);
        this.refresh();
        this.collection.on('update', this.onUpdate);
        this.collection.on('insert', this.onInsert);
        this.collection.on('delete', this.onDelete);
    }
    public readonly transforms: {
        [key in keyof T]?: {
            to: (any: any) => any
            from: (str: string) => any
        }
    } = {}
    private applyTransforms = (row: Row<T>): Row<T> => {
        const transforms = Object.keys(this.transforms);
        const keys = Object.keys(row).filter(key => transforms.includes(key));
        keys.forEach(key => {
            try {
                row[key] = this.transforms[key].from(row[key]);
            } catch (ex) {
                row[key] = ex.message
            }
        });
        return row;
    }
    public async refresh() {
        const raw: Row<T>[] = (await this.read()).filter(row => !row.isEmpty);

        this.collection.clear({ removeIndices: true });
        return this.collection.insert(raw);
    }
    private onUpdate = async (row: Row<T>) => {
        
    }
    private onInsert = async (changedRow, ...args) => {
        //console.log(changedRow, args);
    }
    private onDelete = async (changedRow, ...args) => {
        //console.log(changedRow, args);
    }
    private async read(range: string = this.range, withHeaders: boolean = true): Promise<any[]> {
        this.readPromise = this.getRaw({
            spreadsheetId: this.spreadsheetId,
            range,
            valueRenderOption: this.valueRenderOption
        });
        const response = await this.readPromise;
        const rows = response.data.values || [];
        this.headers = withHeaders ? rows.shift() : this.headers;
        return rows
            .map(SheetsService.transformRow.bind(null, this.headers, 2))
            .map(this.applyTransforms);
    }
    private entityToRow(entity) {
        return this.headers.reduce((acc, key) => {
            const value = entity[key];
            if (value instanceof Object) {
                const transformedValue = this.transforms[key] ? this.transforms[key].to(value) : value;
                acc.push(transformedValue);
            } else {
                acc.push(value);
            }
            return acc;
        }, []);
    }
    public async create(rowOrEntity: [] | {}): Promise<CreateResult> {
        let values;
        if (rowOrEntity instanceof Array) {
            values = rowOrEntity;
        } else if (rowOrEntity instanceof Object) {
            values = this.entityToRow(rowOrEntity);
        }
        return this.appendRaw({
            spreadsheetId: this.spreadsheetId,
            range: this.range,
            valueInputOption: this.valueInputOption,
            resource: {
                values: [values]
            }
        })
        .then(response => response.data.updates)
        .then(result => {
            const rd = RangeDefinition.fromRange(result.updatedRange);
            return Object.assign({ $row: rd.startRow }, result)
        })
        .then(SheetsService.stripAppendResponse);
    }
    public async update(row: Row<T>) {
        const rd = RangeDefinition.fromRange(this.range);
        rd.startRow = row.$row;
        rd.endRow = row.$row;
        return this.updateRaw({
            spreadsheetId: this.spreadsheetId,
            range: rd.range,
            valueInputOption: this.valueInputOption,
            resource: {
                values: [this.entityToRow(row)]
            }
        })
        .then(response => response.data)
        .then(result => {
            const rd = RangeDefinition.fromRange(result.updatedRange);
            return Object.assign({ $row: rd.startRow }, result)
        })
        .then(SheetsService.stripUpdateResponse);
    }
    public async delete($row: number) {
        const rd = RangeDefinition.fromRange(this.range);
        rd.startRow = $row;
        rd.endRow = $row;
        return this.clearRaw({
            spreadsheetId: this.spreadsheetId,
            range: rd.range,
            resource: {}
        })
        .then(response => response.data)
        .then(SheetsService.stripClearResponse);
    }
    public async find(...args): Promise<(LokiObj & Row<T>)[]> {
        await this.readPromise;
        return <(T & LokiObj & Row<T>)[]> this.collection.find(...args);
    }
    public async findOne(...args): Promise<(T & LokiObj & Row<T>)> {
        await this.readPromise;
        return <(T & LokiObj & Row<T>)> this.collection.findOne(...args);
    }
    public async where(where): Promise<(T & LokiObj & Row<T>)[]> {
        await this.readPromise;
        return <(T & LokiObj & Row<T>)[]> this.collection.where(where);
    }
}