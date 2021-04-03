import {
    Chapter,
    ChapterDetails,
    HomeSection,
    Manga,
    PagedResults,
    Request,
    SearchRequest,
    Source,
    SourceInfo,
    TagSection,
} from "paperback-extensions-common"
import {NovelCoolParser} from "./NovelCoolParser";

const BASE = "https://www.novelcool.com"

export const NovelCoolInfo: SourceInfo = {
    icon: "icon.png",
    version: "1.0.0",
    name: "NovelCool",
    author: "PythonCoderAS",
    authorWebsite: "https://github.com/PythonCoderAS",
    description: "Extension that pulls manga from NovelCool",
    language: "en",
    hentaiSource: false,
    websiteBaseURL: BASE
}

export class NovelCool extends Source {

    private readonly parser: NovelCoolParser = new NovelCoolParser();

    getMangaShareUrl(mangaId: string): string {
        return `${BASE}/novel/${mangaId}.html`;
    }

    async getTags(): Promise<TagSection[] | null> {
        const options: Request = createRequestObject({
            url: `${BASE}/search?name=awdasdsadsa`,
            method: 'GET'
        });
        let response = await this.requestManager.schedule(options, 1);
        let $ = this.cheerio.load(response.data);
        return this.parser.parseGlobalTagList($);
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const options: Request = createRequestObject({
            url: `${BASE}`,
            method: 'GET'
        });
        let response = await this.requestManager.schedule(options, 1);
        let $ = this.cheerio.load(response.data);
        let carouselItems = this.parser.parseCarousel($, BASE);
        sectionCallback(createHomeSection({
            id: "carousel",
            title: "Popular",
            items: carouselItems
        }))
        const sections = this.parser.parseHomepage($, BASE);
        for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            sectionCallback(createHomeSection({
                id: section.name.toLowerCase(),
                title: section.name,
                items: section.items,
                view_more: true
            }));
        }
    }

    async doGetWebsiteMangaDirectory(page: number = 1, end: number | null = null){
        const options: Request = createRequestObject({
            url: `${BASE}/category/index_${page}.html`,
            method: 'GET'
        });
        let response = await this.requestManager.schedule(options, 1);
        let $ = this.cheerio.load(response.data);
        let results = this.parser.parseMangaListingPage($, BASE);
        if (!end){
            end = Number($("div.dis-inline-block.para-h8").first().text().trim())
            for (let i = 2; i <= end; i++) {
                results = results.concat(await this.doGetWebsiteMangaDirectory(i, end))
            }
        }
        return results;
    }

    async getWebsiteMangaDirectory(metadata: any): Promise<PagedResults> {
        return createPagedResults({
            results: await this.doGetWebsiteMangaDirectory()
        });
    }

    async doGetPages(chapterId: string, page: number = 1, end: number | null = null): Promise<string[]>{
        const options: Request = createRequestObject({
            url: `${BASE}/chapter/${chapterId}-10-${page}.html`,
            method: 'GET'
        });
        let response = await this.requestManager.schedule(options, 1);
        let $: CheerioStatic = this.cheerio.load(response.data);
        let pages: string[] = this.parser.parsePages($);
        if (end === null){
            end = $("select.sl-page option").length
            for (let i = 2; i < end; i++) {
                pages = pages.concat(await this.doGetPages(chapterId, page + 1, end));
            }
        }
        return pages;
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        return createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            longStrip: false,
            pages: await this.doGetPages(chapterId)
        });
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const options: Request = createRequestObject({
            url: this.getMangaShareUrl(mangaId),
            method: 'GET'
        });
        let response = await this.requestManager.schedule(options, 1);
        let $ = this.cheerio.load(response.data);
        return this.parser.parseChapterList($, mangaId, BASE, this.convertTime);
    }

    async getMangaDetails(mangaId: string): Promise<Manga> {
        const options: Request = createRequestObject({
            url: this.getMangaShareUrl(mangaId),
            method: 'GET'
        });
        let response = await this.requestManager.schedule(options, 1);
        let $ = this.cheerio.load(response.data);
        return this.parser.parseManga($, mangaId, BASE, this.convertTime);
    }

    async doSearchRequest(url: string, page: number = 1, end: number | null = null){
        const original_url = url;
        url += `&page=${page}.html`
        const options: Request = createRequestObject({
            url: url,
            method: 'GET'
        });
        let response = await this.requestManager.schedule(options, 1);
        let $ = this.cheerio.load(response.data);
        if ($("div.search-nores-hint").length !== 0){
            return [];
        } else {
        let results = this.parser.parseMangaListingPage($, BASE);
            if (!end){
                end = Number($("div.dis-inline-block.para-h8").first().text().trim())
                for (let i = 2; i <= end; i++) {
                    results = results.concat(await this.doSearchRequest(original_url, i, end))
                }
            }
            return results;
        }
    }

    async searchRequest(query: SearchRequest, metadata: any): Promise<PagedResults> {
        let url = `${BASE}/search/?name_sel=contain`
        if (query.title){
            url += `&name=${query.title}`;
        }
        if (query.author){
            url += `&author_sel=contain&author=${query.author}`;
        }
        return createPagedResults({
            results: await this.doSearchRequest(url)
        });
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        const options: Request = createRequestObject({
            url: `${BASE}/category/${homepageSectionId}.html`,
            method: 'GET'
        });
        let response = await this.requestManager.schedule(options, 1);
        let $ = this.cheerio.load(response.data);
        let results = this.parser.parseMangaListingPage($, BASE);
        return createPagedResults({
            results: results
        });
    }
}