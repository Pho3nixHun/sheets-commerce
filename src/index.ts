import { main } from '@app';
import { Config } from '@definitions/config';

(async (configPath: string) => {
    const config: Config | Boolean = await import(configPath)
        .catch(() => false);
    const app = config && main(<Config> config);
})(process.argv.slice(2).pop());