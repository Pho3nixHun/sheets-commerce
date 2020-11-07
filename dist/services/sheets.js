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
exports.RangeDefinition = void 0;
const util_1 = require("util");
const Loki = require("lokijs");
class RangeDefinition {
    constructor(sheet, startColumn, startRow, endColumn, endRow) {
        this.sheet = sheet;
        this.startColumn = startColumn;
        this.startRow = startRow;
        this.endColumn = endColumn;
        this.endRow = endRow;
    }
    static fromRange(range) {
        const formats = [
            // Sheet!A1:B1
            /^(?<sheet>[A-Za-z0-9\-\.\_]+)?\!?(?<startColumn>[A-Z]+)(?<startRow>[0-9]+)\:(?<endColumn>[A-Z]+)(?<endRow>[0-9]+)$/g,
            // Sheet!A:A
            /^(?<sheet>[A-Za-z0-9\-\.\_]+)?\!?(?<startColumn>[A-Z]+)\:(?<endColumn>[A-Z]+)$/g,
            // Sheet!1:1
            /^(?<sheet>[A-Za-z0-9\-\.\_]+)?\!?(?<startRow>[0-9]+)\:(?<endRow>[0-9]+)$/g,
            // Sheet!A1
            /^(?<sheet>[A-Za-z0-9\-\.\_]+)?\!?(?<startColumn>[A-Z]+)(?<startRow>[0-9]+)$/g
        ];
        const execResult = formats.reduce((res, re) => res || re.exec(range), null);
        if (!execResult)
            throw new Error(`Cannot translate range (${range}) to RangeDefinition`);
        const { sheet, startColumn, startRow, endColumn, endRow } = execResult.groups;
        return new RangeDefinition(sheet, startColumn, parseInt(startRow), endColumn, parseInt(endRow));
    }
    get range() {
        if (this.startColumn && this.startRow && this.endColumn && this.endRow) {
            return `${this.sheet}!${this.startColumn}${this.startRow}:${this.endColumn}${this.endRow}`;
        }
        else if (this.startColumn && this.endColumn) {
            return `${this.sheet}!${this.startColumn}:${this.endColumn}`;
        }
        else if (this.startRow && this.endRow) {
            return `${this.sheet}!${this.startRow}:${this.endRow}`;
        }
        else if (this.startColumn && this.startRow) {
            return `${this.sheet}!${this.startColumn}${this.startRow}`;
        }
        else if (this.sheet) {
            return `${this.sheet}`;
        }
        return '';
    }
}
exports.RangeDefinition = RangeDefinition;
class SheetsService {
    constructor(googleService, spreadsheetId, fileId, range, dbPath) {
        this.googleService = googleService;
        this.spreadsheetId = spreadsheetId;
        this.fileId = fileId;
        this.range = range;
        this.dbPath = dbPath;
        this.db = new Loki(this.dbPath);
        this.collection = this.db.addCollection("entities", {
            unique: ["$row"],
            autoupdate: false,
            disableChangesApi: false
        });
        this.valueRenderOption = 'UNFORMATTED_VALUE';
        this.valueInputOption = 'USER_ENTERED';
        this.rangeDefinition = RangeDefinition.fromRange(this.range);
        this.getRaw = util_1.promisify(this.googleService.Sheets.spreadsheets.values.get.bind(this.googleService.Sheets.spreadsheets.values));
        this.appendRaw = util_1.promisify(this.googleService.Sheets.spreadsheets.values.append.bind(this.googleService.Sheets.spreadsheets.values));
        this.updateRaw = util_1.promisify(this.googleService.Sheets.spreadsheets.values.update.bind(this.googleService.Sheets.spreadsheets.values));
        this.clearRaw = util_1.promisify(this.googleService.Sheets.spreadsheets.values.clear.bind(this.googleService.Sheets.spreadsheets.values));
        this.readPromise = Promise.resolve();
        this.headers = [];
        this.transforms = {};
        this.applyTransforms = (row) => {
            const transforms = Object.keys(this.transforms);
            const keys = Object.keys(row).filter(key => transforms.includes(key));
            keys.forEach(key => {
                try {
                    row[key] = this.transforms[key].from(row[key]);
                }
                catch (ex) {
                    row[key] = ex.message;
                }
            });
            return row;
        };
        this.onUpdate = (row) => __awaiter(this, void 0, void 0, function* () {
        });
        this.onInsert = (changedRow, ...args) => __awaiter(this, void 0, void 0, function* () {
            //console.log(changedRow, args);
        });
        this.onDelete = (changedRow, ...args) => __awaiter(this, void 0, void 0, function* () {
            //console.log(changedRow, args);
        });
        SheetsService.instances.push(this);
        this.refresh();
        this.collection.on('update', this.onUpdate);
        this.collection.on('insert', this.onInsert);
        this.collection.on('delete', this.onDelete);
    }
    static refreshInstances(resourceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const affectedInstances = SheetsService.instances
                .filter(instance => instance.fileId === resourceId);
            if (affectedInstances.length > 0) {
                const refreshPromises = affectedInstances.map(instance => instance.refresh().catch(ex => false));
                const results = yield Promise.all(refreshPromises);
                return results.every(res => (!!res) === true);
            }
            return false;
        });
    }
    static transformRow(headers, adjustIndexBy = 1, row, rowIndex) {
        const reducer = (acc, header, index) => {
            acc[header] = row[index];
            return acc;
        };
        if (row.length === 0) {
            return { $row: rowIndex + adjustIndexBy, isEmpty: true };
        }
        return headers.reduce(reducer, { $row: rowIndex + adjustIndexBy, isEmpty: false });
    }
    static stripUpdateResponse(response) {
        const { updatedCells, updatedRange, updatedColumns, updatedRows, $row } = response;
        return {
            updatedRange,
            updatedCells,
            updatedRows,
            updatedColumns,
            $row
        };
    }
    static stripAppendResponse(response) {
        const { updatedCells, updatedRange, updatedColumns, updatedRows, $row } = response;
        return {
            updatedRange,
            updatedCells,
            updatedRows,
            updatedColumns,
            $row
        };
    }
    static stripClearResponse(response) {
        const { clearedRange } = response;
        return {
            clearedRange
        };
    }
    refresh() {
        return __awaiter(this, void 0, void 0, function* () {
            const raw = (yield this.read()).filter(row => !row.isEmpty);
            this.collection.clear({ removeIndices: true });
            return this.collection.insert(raw);
        });
    }
    read(range = this.range, withHeaders = true) {
        return __awaiter(this, void 0, void 0, function* () {
            this.readPromise = this.getRaw({
                spreadsheetId: this.spreadsheetId,
                range,
                valueRenderOption: this.valueRenderOption
            });
            const response = yield this.readPromise;
            const rows = response.data.values || [];
            this.headers = withHeaders ? rows.shift() : this.headers;
            return rows
                .map(SheetsService.transformRow.bind(null, this.headers, 2))
                .map(this.applyTransforms);
        });
    }
    entityToRow(entity) {
        return this.headers.reduce((acc, key) => {
            const value = entity[key];
            if (value instanceof Object) {
                const transformedValue = this.transforms[key] ? this.transforms[key].to(value) : value;
                acc.push(transformedValue);
            }
            else {
                acc.push(value);
            }
            return acc;
        }, []);
    }
    create(rowOrEntity) {
        return __awaiter(this, void 0, void 0, function* () {
            let values;
            if (rowOrEntity instanceof Array) {
                values = rowOrEntity;
            }
            else if (rowOrEntity instanceof Object) {
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
                return Object.assign({ $row: rd.startRow }, result);
            })
                .then(SheetsService.stripAppendResponse);
        });
    }
    update(row) {
        return __awaiter(this, void 0, void 0, function* () {
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
                return Object.assign({ $row: rd.startRow }, result);
            })
                .then(SheetsService.stripUpdateResponse);
        });
    }
    delete($row) {
        return __awaiter(this, void 0, void 0, function* () {
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
        });
    }
    find(...args) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.readPromise;
            return this.collection.find(...args);
        });
    }
    findOne(...args) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.readPromise;
            return this.collection.findOne(...args);
        });
    }
    where(where) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.readPromise;
            return this.collection.where(where);
        });
    }
}
exports.default = SheetsService;
SheetsService.instances = [];
