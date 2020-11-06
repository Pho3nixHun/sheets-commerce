import * as RFS from 'rotating-file-stream';
import * as morgan from 'koa-morgan';
import { LogName, LogConfigs } from '@definitions/config';

const createFilestream = (path: string, type: LogName, config: RFS.Options): RFS.RotatingFileStream => {
    const rfsOptions: RFS.Options = Object.assign({path}, config);
    return RFS.createStream(`${type}.log`, rfsOptions);
}

const LogConfigToRfsOption = (logConfig): RFS.Options => {
    return ['interval', 'size', 'compress', 'maxFiles'].reduce((acc, option) => {
        if (logConfig[option] !== undefined)
            acc[option] = logConfig[option];
        return acc;
    }, {});
}

export default (config: LogConfigs, outputPath?: string) => {
    const routes = [];
    const { debug, access, error } = config;
    if (outputPath !== undefined) {
        if (access && access.format) {
            const logConfig: RFS.Options = LogConfigToRfsOption(config[LogName.ACCESS]);
            const stream: RFS.RotatingFileStream = createFilestream(<string> outputPath, LogName.ACCESS, logConfig);
            const logger = morgan(config[LogName.ACCESS].format, { stream });
            routes.push(logger);
        }
        if (error && error.format) {
            const logConfig: RFS.Options = LogConfigToRfsOption(config[LogName.ERROR]);
            const stream: RFS.RotatingFileStream = createFilestream(<string> outputPath, LogName.ERROR, logConfig);
            const logger = morgan(config[LogName.ERROR].format, { stream });
            routes.push(logger);
        }
    }
    if (debug && debug.format) {
        const stream = { write: console.debug.bind(console, '[DEBUG-LOG]') };
        const logger = morgan(config[LogName.DEBUG].format, { stream });
        routes.push(logger);
    }

    return routes;
}