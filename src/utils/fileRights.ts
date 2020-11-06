import { promises as fs, constants as fsConstants } from 'fs';

export const checkFileRights = async (filePath: string, mode: number) => {
    if (await fs.access(filePath, mode).catch(ex => false) !== false) {
        return true;
    }
    return false;
}

export const fileExists = async (filePath: string) => {
    return await checkFileRights(filePath, fsConstants.F_OK);
}
export const fileReadable = async (filePath: string) => {
    return await checkFileRights(filePath, fsConstants.R_OK);
}
export const fileWriteable = async (filePath: string) => {
    return await checkFileRights(filePath, fsConstants.W_OK);
}