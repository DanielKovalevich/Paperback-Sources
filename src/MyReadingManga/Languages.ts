import { LanguageCode } from "paperback-extensions-common";

export const parseLanguage = (language: string): LanguageCode => {
    let langCode: LanguageCode = LanguageCode.UNKNOWN;
    switch (language.toUpperCase()) {
        case "BENGALI":
            langCode = LanguageCode.BENGALI;
            break;
        case "BULGARIAN":
            langCode = LanguageCode.BULGARIAN;
            break;
        case "BRAZILIAN":
            langCode = LanguageCode.BRAZILIAN;
            break;
        case "CHINESE":
            langCode = LanguageCode.CHINEESE;
            break;
        case "CZECH":
            langCode = LanguageCode.CZECH;
            break;
        case "GERMAN":
            langCode = LanguageCode.GERMAN;
            break;
        case "DANISH":
            langCode = LanguageCode.DANISH;
            break;
        case "ENGLISH":
            langCode = LanguageCode.ENGLISH;
            break;
        case "SPANISH":
            langCode = LanguageCode.SPANISH;
            break;
        case "FINNISH":
            langCode = LanguageCode.FINNISH;
            break;
        case "FRENCH":
            langCode = LanguageCode.FRENCH;
            break;
        case "WELSH":
            langCode = LanguageCode.WELSH;
            break;
        case "GREEK":
            langCode = LanguageCode.GREEK;
            break;
        case "CHINESE":
            langCode = LanguageCode.CHINEESE_HONGKONG;
            break;
        case "HUNGARIAN":
            langCode = LanguageCode.HUNGARIAN;
            break;
        case "INDONESIAN":
            langCode = LanguageCode.INDONESIAN;
            break;
        case "ISRAELI":
            langCode = LanguageCode.ISRELI;
            break;
        case "INDIAN":
            langCode = LanguageCode.INDIAN;
            break;
        case "IRAN":
            langCode = LanguageCode.IRAN;
            break;
        case "ITALIAN":
            langCode = LanguageCode.ITALIAN;
            break;
        case "JAPANESE":
            langCode = LanguageCode.JAPANESE;
            break;
        case "KOREAN":
            langCode = LanguageCode.KOREAN;
            break;
        case "LITHUANIAN":
            langCode = LanguageCode.LITHUANIAN;
            break;
        case "MONGOLIAN":
            langCode = LanguageCode.MONGOLIAN;
            break;
        case "MEXICAN":
            langCode = LanguageCode.MEXIAN;
            break;
        case "MALAY":
            langCode = LanguageCode.MALAY;
            break;
        case "DUTCH":
            langCode = LanguageCode.DUTCH;
            break;
        case "NORWEGIAN":
            langCode = LanguageCode.NORWEGIAN;
            break;
        case "FILIPINO":
            langCode = LanguageCode.PHILIPPINE;
            break;
        case "POLISH":
            langCode = LanguageCode.POLISH;
            break;
        case "PORTUGUESE":
            langCode = LanguageCode.PORTUGUESE;
            break;
        case "ROMANIAN":
            langCode = LanguageCode.ROMANIAN;
            break;
        case "RUSSIAN":
            langCode = LanguageCode.RUSSIAN;
            break;
        case "SANSKRIT":
            langCode = LanguageCode.SANSKRIT;
            break;
        case "SAMI":
            langCode = LanguageCode.SAMI;
            break;
        case "THAI":
            langCode = LanguageCode.THAI;
            break;
        case "TURKISH":
            langCode = LanguageCode.TURKISH;
            break;
        case "UKRAINIAN":
            langCode = LanguageCode.UKRAINIAN;
            break;
        case "VIETNAMESE":
            langCode = LanguageCode.VIETNAMESE;
            break;
        default:
            langCode = LanguageCode.UNKNOWN;
            break;
    }

    return langCode;
};
