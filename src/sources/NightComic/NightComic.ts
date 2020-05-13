import { Madara } from '../Madara'
import { LanguageCode } from '../../models/Languages/Languages'


export class NightComic extends Madara {

    constructor(cheerio: CheerioAPI) {
        super(cheerio)
    }

    get version(): string { return '1.0.0' }
    get name(): string { return 'Night Comics' }
    get author(): string { return 'Abdullah Mohamed' }
    get description(): string { return 'Madara source which pulls manga from the Night Comics website' }
    get hentaiSource(): boolean { return false }
    get icon(): string { return 'icon.png' }
    get language(): string { return 'English' }
    get langFlag(): string { return 'en' }
    get langCode(): LanguageCode { return LanguageCode.ENGLISH }
    get MadaraDomain(): string { return 'https://www.nightcomic.com' }
}
