import {Injectable} from '@angular/core';
import {CommonConfig, mergeDeepOverrideLists} from '@geoengine/common';
import {Configuration, DefaultConfig} from '@geoengine/openapi-client';
/**
 * The structure of the config file containing the URL of the backend API and the branding information.
 */
export interface ConfigStructure {
    readonly BRANDING: Branding;
}

/**
 * Information about the branding of the Geo Engine instance.
 */
interface Branding {
    readonly LOGO_URL: string;
    readonly LOGO_ICON_URL: string;
    readonly LOGO_ALT_URL: string;
    readonly PAGE_TITLE: string;
    readonly HOMEPAGE?: Homepage;
}

/**
 * Specifies a link to a homepage (e.g. project website) and a button image.
 */
interface Homepage {
    readonly URL: string;
    readonly BUTTON_IMAGE_URL: string;
    readonly BUTTON_ALT_TEXT: string;
    readonly BUTTON_TOOLTIP_TEXT: string;
}

export const DEFAULT_CONFIG: ConfigStructure = {
    BRANDING: {
        LOGO_URL: 'assets/geoengine.svg',
        LOGO_ICON_URL: 'assets/geoengine-favicon-white.svg',
        LOGO_ALT_URL: 'assets/geoengine-white.svg',
        PAGE_TITLE: 'Geo Engine',
    },
};

@Injectable()
export class AppConfig {
    static readonly CONFIG_FILE = 'assets/config.json';

    protected config!: ConfigStructure;

    constructor(protected readonly commonConfig: CommonConfig) {}

    get BRANDING(): Branding {
        return this.config.BRANDING;
    }

    // noinspection JSUnusedGlobalSymbols <- function used in parent app
    /**
     * Initialize the config on app start.
     */
    async load(defaults: ConfigStructure = DEFAULT_CONFIG): Promise<void> {
        const configFileResponse = await fetch(AppConfig.CONFIG_FILE);

        const appConfig = await configFileResponse.json().catch(() => ({}));
        this.config = mergeDeepOverrideLists(defaults, {...appConfig});

        await this.commonConfig.load();
        // we alter the config in the openapi-client so that it uses the correct API_URL
        DefaultConfig.config = new Configuration({
            basePath: this.commonConfig.API_URL,
            fetchApi: DefaultConfig.fetchApi,
            middleware: DefaultConfig.middleware,
            queryParamsStringify: DefaultConfig.queryParamsStringify,
            username: DefaultConfig.username,
            password: DefaultConfig.password,
            apiKey: DefaultConfig.apiKey,
            accessToken: DefaultConfig.accessToken,
            headers: DefaultConfig.headers,
            credentials: DefaultConfig.credentials,
        });
    }
}
