import { Madara } from '../Madara'
import { LanguageCode } from '../../models/Languages/Languages'


export class IsekaiScan extends Madara {

    constructor(cheerio: CheerioAPI) {
        super(cheerio)
    }

    get version(): string { return '0.0.1' }
    get name(): string { return 'IsekaiScan (Aggregator)' }
    get author(): string { return 'Abdullah Mohamed' }
    get description(): string { return 'Madara source which pulls manga from the IsekaiScan website' }
    get hentaiSource(): boolean { return false }
    get icon(): string { return 'icon.png' }
    get language(): string { return 'English' }
    get langFlag(): string { return 'en' }
    get langCode(): LanguageCode { return LanguageCode.ENGLISH }
    get MadaraDomain(): string { return 'https://isekaiscan.com' }
    get pageImageAttr(): string { return 'data-src' }
}
