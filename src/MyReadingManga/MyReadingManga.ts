import { Source, Manga, Chapter, ChapterDetails, HomeSection, SearchRequest, PagedResults, SourceInfo, TagType, RequestHeaders } from "paperback-extensions-common";
import { isLastPage, parseChapterDetails, parseChapters, parseHomeSections, parseMangaDetails, parseSearchResults } from "./MyReadingMangaParser";

const MRM_DOMAIN = "https://myreadingmanga.info";

export const MyReadingMangaInfo: SourceInfo = {
    version: "1.0.2",
    name: "MyReadingManga",
    icon: "icon.png",
    author: "Ankah",
    authorWebsite: "https://github.com/AdrienSeon",
    description: "Extension that pulls manga from MyReadingManga",
    hentaiSource: false, // ! Temporary until Mangadex is back up / Paperback login is in place
    websiteBaseURL: MRM_DOMAIN,
    sourceTags: [
        {
            text: "18+",
            type: TagType.YELLOW,
        },
        {
            text: "Yaoi",
            type: TagType.YELLOW,
        },
        {
            text: "Cloudflare",
            type: TagType.RED,
        },
    ],
};

export class MyReadingManga extends Source {
    getMangaShareUrl(mangaId: string): string | null {
        return `${MRM_DOMAIN}/${mangaId}/`;
    }

    async getMangaDetails(mangaId: string): Promise<Manga> {
        const request = createRequestObject({
            url: `${MRM_DOMAIN}/${mangaId}/`,
            method: "GET",
        });
        const response = await this.requestManager.schedule(request, 1);
        this.cloudflareError(response.status);
        let $ = this.cheerio.load(response.data);

        return parseMangaDetails($, mangaId);
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = createRequestObject({
            url: `${MRM_DOMAIN}/`,
            method: "GET",
            param: mangaId,
        });
        const response = await this.requestManager.schedule(request, 1);
        this.cloudflareError(response.status);
        const $ = this.cheerio.load(response.data);

        return parseChapters($, mangaId);
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = createRequestObject({
            url: `${MRM_DOMAIN}/`,
            method: "GET",
            cookies: [{ name: "content_lazyload", value: "off", domain: `${MRM_DOMAIN}` }],
            param: `${mangaId}/${chapterId}`,
        });
        const response = await this.requestManager.schedule(request, 1);
        this.cloudflareError(response.status);
        const $ = this.cheerio.load(response.data);

        return parseChapterDetails($, mangaId, chapterId);
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const sections = [
            {
                request: createRequestObject({
                    url: `${MRM_DOMAIN}/search/?wpsolr_sort=sort_by_date_desc`,
                    method: "GET",
                }),
                section: createHomeSection({
                    id: "1_recently_updated",
                    title: "RECENTLY UPDATED",
                    view_more: true,
                }),
            },
            {
                request: createRequestObject({
                    url: `${MRM_DOMAIN}/yaoi-manga/`,
                    method: "GET",
                }),
                section: createHomeSection({
                    id: "2_yaoi",
                    title: "YAOI MANGAS",
                    view_more: true,
                }),
            },
            {
                request: createRequestObject({
                    url: `${MRM_DOMAIN}/manhwa/`,
                    method: "GET",
                }),
                section: createHomeSection({
                    id: "3_manhwa",
                    title: "MANHWA",
                    view_more: true,
                }),
            },
            {
                request: createRequestObject({
                    url: `${MRM_DOMAIN}/manhua/`,
                    method: "GET",
                }),
                section: createHomeSection({
                    id: "4_manhua",
                    title: "MANHUA",
                    view_more: true,
                }),
            },
            {
                request: createRequestObject({
                    url: `${MRM_DOMAIN}/genre/bara/`,
                    method: "GET",
                }),
                section: createHomeSection({
                    id: "5_bara",
                    title: "BARA",
                    view_more: true,
                }),
            },
            {
                request: createRequestObject({
                    url: `${MRM_DOMAIN}/search/?wpsolr_sort=sort_by_random`,
                    method: "GET",
                }),
                section: createHomeSection({
                    id: "6_randomly_selected",
                    title: "RANDOMLY SELECTED",
                    view_more: true,
                }),
            },
        ];
        const promises: Promise<void>[] = [];
        for (const section of sections) {
            // Load empty sections
            sectionCallback(section.section);
            // Populate data in sections
            promises.push(
                this.requestManager.schedule(section.request, 1).then((response) => {
                    const $ = this.cheerio.load(response.data);
                    this.cloudflareError(response.status);
                    section.section.items = parseHomeSections($, section.section.id);
                    sectionCallback(section.section);
                })
            );
        }
        // Make sure the function completes
        await Promise.all(promises);
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults | null> {
        const page: number = metadata?.page ?? 1;
        let param: string = "";
        switch (homepageSectionId) {
            case "1_recently_updated":
                param = `/search/?wpsolr_sort=sort_by_date_desc&wpsolr_page=${page}`;
                break;
            case "2_yaoi":
                param = `/yaoi-manga/page/${page}/`;
                break;
            case "3_manhwa":
                param = `/manhwa/page/${page}/`;
                break;
            case "4_manhua":
                param = `/manhua/page/${page}/`;
                break;
            case "5_bara":
                param = `/genre/bara/page/${page}/`;
                break;
            case "6_randomly_selected":
                param = `/search/?wpsolr_sort=sort_by_random&wpsolr_page=${page}`;
                break;
            default:
                return Promise.resolve(null);
        }
        const request = createRequestObject({
            url: `${MRM_DOMAIN}`,
            method: "GET",
            param,
        });
        const response = await this.requestManager.schedule(request, 1);
        const $ = this.cheerio.load(response.data);
        const mangaTiles = parseHomeSections($, homepageSectionId);
        if (homepageSectionId === "1_recently_updated" || homepageSectionId === "6_randomly_selected") {
            // Different page structure since it's a search result
            metadata = isLastPage($, true) ? undefined : { page: page + 1 };
        } else {
            metadata = isLastPage($, false) ? undefined : { page: page + 1 };
        }

        return createPagedResults({
            results: mangaTiles,
            metadata,
        });
    }

    async searchRequest(query: SearchRequest, metadata: any): Promise<PagedResults> {
        let page: number = metadata?.page ?? 1;
        const request = createRequestObject({
            url: `${MRM_DOMAIN}/search/?search=${encodeURIComponent(query.title ?? "")}${"&wpsolr_page=" + page}`,
            method: "GET",
        });
        const response = await this.requestManager.schedule(request, 1);
        const $ = this.cheerio.load(response.data);
        const results = parseSearchResults($);
        metadata = isLastPage($, true) ? undefined : { page: page + 1 };

        return createPagedResults({
            results,
            metadata,
        });
    }

    cloudflareError(status: any) {
        if (status === 503) {
            throw new Error("CLOUDFLARE BYPASS ERROR: Please go to Settings > Sources > MyReadingManga and press Cloudflare Bypass");
        }
    }

    getCloudflareBypassRequest() {
        return createRequestObject({
            url: `${MRM_DOMAIN}`,
            method: "GET",
        });
    }

    globalRequestHeaders(): RequestHeaders {
        return {
            referer: `${MRM_DOMAIN}/`,
            accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        };
    }
}
