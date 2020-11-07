"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const RFS = require("rotating-file-stream");
const morgan = require("koa-morgan");
const config_1 = require("../types/config");
const createFilestream = (path, type, config) => {
    const rfsOptions = Object.assign({ path }, config);
    return RFS.createStream(`${type}.log`, rfsOptions);
};
const LogConfigToRfsOption = (logConfig) => {
    return ['interval', 'size', 'compress', 'maxFiles'].reduce((acc, option) => {
        if (logConfig[option] !== undefined)
            acc[option] = logConfig[option];
        return acc;
    }, {});
};
exports.default = (config, outputPath) => {
    const routes = [];
    const { debug, access, error } = config;
    if (outputPath !== undefined) {
        if (access && access.format) {
            const logConfig = LogConfigToRfsOption(config[config_1.LogName.ACCESS]);
            const stream = createFilestream(outputPath, config_1.LogName.ACCESS, logConfig);
            const logger = morgan(config[config_1.LogName.ACCESS].format, { stream });
            routes.push(logger);
        }
        if (error && error.format) {
            const logConfig = LogConfigToRfsOption(config[config_1.LogName.ERROR]);
            const stream = createFilestream(outputPath, config_1.LogName.ERROR, logConfig);
            const logger = morgan(config[config_1.LogName.ERROR].format, { stream });
            routes.push(logger);
        }
    }
    if (debug && debug.format) {
        const stream = { write: console.debug.bind(console, '[DEBUG-LOG]') };
        const logger = morgan(config[config_1.LogName.DEBUG].format, { stream });
        routes.push(logger);
    }
    return routes;
};
