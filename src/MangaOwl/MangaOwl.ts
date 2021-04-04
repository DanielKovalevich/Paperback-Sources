import {
    Chapter,
    ChapterDetails,
    HomeSection,
    Manga,
    MangaTile,
    MangaUpdates,
    PagedResults,
    Request,
    RequestHeaders,
    SearchRequest,
    Source,
    SourceInfo,
    TagSection,
    TagType,
} from "paperback-extensions-common"
import {MangaOwlParser} from "./MangaOwlParser";

const BASE = "https://www.mangaowl.com"

export const MangaOwlInfo: SourceInfo = {
    icon: "icon.png",
    version: "1.2.3",
    name: "MangaOwl",
    author: "PythonCoderAS",
    authorWebsite: "https://github.com/PythonCoderAS",
    description: "Extension that pulls manga from MangaOwl",
    language: "en",
    hentaiSource: false,
    websiteBaseURL: BASE,
    sourceTags: [
        {
            text: "Notifications",
            type: TagType.GREEN
        },
        {
            text: "Cloudflare",
            type: TagType.RED
        }
    ]
}

export class MangaOwl extends Source {

    private readonly parser: MangaOwlParser = new MangaOwlParser();
    private readonly constantHeaders: RequestHeaders = {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 11_2_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.114 Safari/537.36",
        referer: BASE + "/",
        origin: BASE
    };

    readonly requestManager = createRequestManager({
        requestsPerSecond: 3,
        requestTimeout: 30000,
    })

    getMangaShareUrl(mangaId: string): string | null {
        return `${BASE}/single/${mangaId}`;
    }

    getCloudflareBypassRequest(): Request {
        return createRequestObject({
            url: `${BASE}/single/46862`,
            method: "GET"
        });
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const options: Request = createRequestObject({
            url: `${BASE}`,
            method: 'GET'
        });
        let response = await this.requestManager.schedule(options, 1);
        let $ = this.cheerio.load(response.data);
        sectionCallback(createHomeSection({
            id: "mustReadToday",
            items: this.parser.parseTileSection($, "popular", 0),
            title: "Must Read Today"
        }));
        sectionCallback(createHomeSection({
            id: "new_release",
            items: this.parser.parseTileSection($, "general"),
            title: "New Releases",
            view_more: true
        }));
        sectionCallback(createHomeSection({
            id: "lastest",
            items: this.parser.parseTileSection($, "lastest"),
            title: "Latest",
            view_more: true
        }));
        sectionCallback(createHomeSection({
            id: "popular",
            items: this.parser.parseTileSection($, "popular", 1),
            title: "Most Popular Manga",
            view_more: true
        }));
        const apiURL = this.parser.parseAPIUrl(response.data);
        if (apiURL){
            sectionCallback(createHomeSection({
                id: "updated_raw_manga",
                items: await this.getJapaneseManga(sectionCallback, apiURL),
                title: "Japanese Manga",
                view_more: true
            }));
        }

    }

    async getJapaneseManga(sectionCallback: (section: HomeSection) => void, apiUrl: string): Promise<MangaTile[]>{
        const options: Request = createRequestObject({
            url: `${apiUrl}/raw_updated_manga`,
            method: 'GET'
        });
        const tiles: MangaTile[] = [];
        let response = await this.requestManager.schedule(options, 1);
        let result: object[] = typeof response.data === "string" ? JSON.parse(response.data) : response.data
        for (let i = 0; i < result.length; i++) {
            // Typescript cannot find these attributes because it does not know the output of JSON.parse, but I do.
            // @ts-ignore
            const {id, thumbnailUrl, title} = result[i];
            if (id) {
                tiles.push(createMangaTile({
                    id: String(id),
                    image: thumbnailUrl || "",
                    title: createIconText({
                        text: title || ""
                    })
                }))
            }
        }
        return tiles;
    }

    async getTags(): Promise<TagSection[]> {
        const options: Request = createRequestObject({
            url: `${BASE}`,
            method: 'GET'
        });
        let response = await this.requestManager.schedule(options, 1);
        let $ = this.cheerio.load(response.data);
        return [createTagSection({
            id: "1",
            label: "1",
            tags: this.parser.parseTags($)
        })];
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        const options: Request = createRequestObject({
            url: `${BASE}/${homepageSectionId}`,
            method: 'GET'
        });
        let response = await this.requestManager.schedule(options, 1);
        let $ = this.cheerio.load(response.data);
        return createPagedResults({
            results: this.parser.parseTileSection($, "flexslider")
        });
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const options: Request = createRequestObject({
            url: `${chapterId}`,
            method: 'GET'
        });
        let response = await this.requestManager.schedule(options, 1);
        let $ = this.cheerio.load(response.data);
        return createChapterDetails({
            id: chapterId,
            longStrip: true,
            mangaId: mangaId,
            pages: this.parser.parsePages($)
        })
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const options: Request = createRequestObject({
            url: `${BASE}/single/${mangaId}`,
            method: 'GET'
        });
        let response = await this.requestManager.schedule(options, 1);
        let $ = this.cheerio.load(response.data);
        return this.parser.parseChapterList($, mangaId);
    }

    async getMangaDetails(mangaId: string): Promise<Manga> {
        const options: Request = createRequestObject({
            url: `${BASE}/single/${mangaId}`,
            method: 'GET'
        });
        let response = await this.requestManager.schedule(options, 1);
        let $ = this.cheerio.load(response.data);
        return this.parser.parseManga($, mangaId);
    }

    async searchRequest(query: SearchRequest, metadata: any): Promise<PagedResults> {
        let url = `${BASE}/search/1?&search_field=123&sort=4&completed=2&genres=`
        if (query.title) {
            url += `&search=${query.title}`
        }
        const options: Request = createRequestObject({
            url: url,
            method: 'GET'
        });
        let response = await this.requestManager.schedule(options, 1);
        let $ = this.cheerio.load(response.data);
        return createPagedResults({
            results: this.parser.parseTileSection($, "browse-inner")
        });
    }

    async filterUpdatedManga(mangaUpdatesFoundCallback: (updates: MangaUpdates) => void, time: Date, ids: string[]): Promise<void> {
        let page: number = 1;
        let idsFound: string[] | null = [];
        while (idsFound !== null && ids.length !== 0) {
            const actualIds: string[] = []
            for (let i = 0; i < idsFound.length; i++) {
                const id = idsFound[i];
                if (ids.includes(id)){
                    actualIds.push(id)
                    ids.splice(ids.indexOf(id), 1);
                }
            }
            mangaUpdatesFoundCallback(createMangaUpdates({
                ids: actualIds
            }))
            const options: Request = createRequestObject({
                url: `${BASE}/lastest/${page}`,
                method: 'GET',
                headers: this.constantHeaders
            });
            let response = await this.requestManager.schedule(options, 1);
            let $ = this.cheerio.load(response.data);
            idsFound = this.parser.parseTimesFromTiles($, time);
            page++;
        }
    }
}