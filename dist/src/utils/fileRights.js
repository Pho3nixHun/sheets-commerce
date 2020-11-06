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
exports.fileWriteable = exports.fileReadable = exports.fileExists = exports.checkFileRights = void 0;
const fs_1 = require("fs");
exports.checkFileRights = (filePath, mode) => __awaiter(void 0, void 0, void 0, function* () {
    if ((yield fs_1.promises.access(filePath, mode).catch(ex => false)) !== false) {
        return true;
    }
    return false;
});
exports.fileExists = (filePath) => __awaiter(void 0, void 0, void 0, function* () {
    return yield exports.checkFileRights(filePath, fs_1.constants.F_OK);
});
exports.fileReadable = (filePath) => __awaiter(void 0, void 0, void 0, function* () {
    return yield exports.checkFileRights(filePath, fs_1.constants.R_OK);
});
exports.fileWriteable = (filePath) => __awaiter(void 0, void 0, void 0, function* () {
    return yield exports.checkFileRights(filePath, fs_1.constants.W_OK);
});
