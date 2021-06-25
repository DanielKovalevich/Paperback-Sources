import {
    Chapter,
    ChapterDetails,
    HomeSection,
    Manga,
    MangaUpdates,
    PagedResults,
    SearchRequest,
    Source,
    SourceInfo,
    TagSection,
    TagType,
} from "paperback-extensions-common"

import {Parser,} from './Parser'

const MANGAPILL_DOMAIN = 'https://www.mangapill.com'

export const MangaPillInfo: SourceInfo = {
    version: '1.1.6',
    name: 'MangaPill',
    description: 'Extension that pulls manga from mangapill.com. It has a lot of officially translated manga but can sometimes miss manga notifications',
    author: 'GameFuzzy',
    authorWebsite: 'http://github.com/gamefuzzy',
    icon: "icon.png",
    hentaiSource: false,
    websiteBaseURL: MANGAPILL_DOMAIN,
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

export class MangaPill extends Source {
    parser = new Parser()

    getMangaShareUrl(mangaId: string): string | null {
        return `${MANGAPILL_DOMAIN}/manga/${mangaId}`
    }

    async getMangaDetails(mangaId: string): Promise<Manga> {

        let request = createRequestObject({
            url: `${MANGAPILL_DOMAIN}/manga/${mangaId}`,
            method: 'GET'
        })
        const data = await this.requestManager.schedule(request, 1)

        let $ = this.cheerio.load(data.data)

        return this.parser.parseMangaDetails($, mangaId)
    }


    async getChapters(mangaId: string): Promise<Chapter[]> {
        let chapters: Chapter[] = []
        let pageRequest = createRequestObject({
            url: `${MANGAPILL_DOMAIN}/manga/${mangaId}`,
            method: "GET"
        })
        const pageData = await this.requestManager.schedule(pageRequest, 1)
        let $ = this.cheerio.load(pageData.data)
        chapters = chapters.concat(this.parser.parseChapterList($, mangaId))

        return this.parser.sortChapters(chapters)
    }


    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        let request = createRequestObject({
            url: `${MANGAPILL_DOMAIN}${chapterId}`,
            method: 'GET',
        })

        let data = await this.requestManager.schedule(request, 1)

        let $ = this.cheerio.load(data.data)
        let pages = this.parser.parseChapterDetails($)

        return createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages,
            longStrip: false
        })
    }

    async filterUpdatedManga(mangaUpdatesFoundCallback: (updates: MangaUpdates) => void, time: Date, ids: string[]): Promise<void> {

        let request = createRequestObject({
            url: `${MANGAPILL_DOMAIN}/chapters`,
            method: 'GET'
        })

        let data = await this.requestManager.schedule(request, 1)
        let $ = this.cheerio.load(data.data)

        let updatedManga = this.parser.filterUpdatedManga($, time, ids)

        if (updatedManga.updates.length > 0) {
            mangaUpdatesFoundCallback(createMangaUpdates({
                ids: updatedManga.updates
            }))
        }

    }

    async searchRequest(query: SearchRequest, metadata: any): Promise<PagedResults> {
        let page: number = metadata?.page ?? 1
        let genres: string = (query.includeGenre ?? []).join('&genre=')
        if (genres != '') {
            genres = '&genre=' + genres
        }
        let format = '&type=' + (query.includeFormat ?? '')
        let status: string
        switch (query.status) {
            case 0:
                status = '&status=2';
                break
            case 1:
                status = '&status=1';
                break
            default:
                status = ''
        }
        let request = createRequestObject({
            url: `${MANGAPILL_DOMAIN}/search`,
            method: "GET",
            param: `?q=${encodeURIComponent(query.title ?? '')}${format}${status}${genres}&page=${page}`
        })

        let data = await this.requestManager.schedule(request, 1)
        let $ = this.cheerio.load(data.data)
        let manga = this.parser.parseSearchResults($)
        let mData
        if (!this.parser.isLastPage($)) {
            mData = {page: (page + 1)}
        } else {
            mData = undefined  // There are no more pages to continue on to, do not provide page metadata
        }

        return createPagedResults({
            results: manga,
            metadata: mData
        })

    }


    async getTags(): Promise<TagSection[] | null> {
        const request = createRequestObject({
            url: `${MANGAPILL_DOMAIN}/search`,
            method: 'GET'
        })

        const data = await this.requestManager.schedule(request, 1)
        let $ = this.cheerio.load(data.data)

        return this.parser.parseTags($)
    }


    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {

        // Add featured section back in whenever a section type for that comes around

        const sections = [
            {
                request: createRequestObject({
                    url: `${MANGAPILL_DOMAIN}/chapters`,
                    method: 'GET'
                }),
                section: createHomeSection({
                    id: '1',
                    title: 'RECENTLY UPDATED MANGA',
                    view_more: true,
                }),
            },
            {
                request: createRequestObject({
                    url: `${MANGAPILL_DOMAIN}/search?q=&type=&status=`,
                    method: 'GET'
                }),
                section: createHomeSection({
                    id: '2',
                    title: 'POPULAR MANGA',
                    view_more: true
                }),
            },
        ]

        const promises: Promise<void>[] = []

        for (const section of sections) {
            // Let the app load empty sections
            sectionCallback(section.section)

            // Get the section data
            promises.push(
                this.requestManager.schedule(section.request, 1).then(response => {
                    const $ = this.cheerio.load(response.data)
                    section.section.items = section.section.id === '1' ? this.parser.parseRecentUpdatesSection($) : this.parser.parsePopularSection($)
                    sectionCallback(section.section)
                }),
            )
        }

        // Make sure the function completes
        await Promise.all(promises)
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults | null> {
        let page: number = metadata?.page ?? 1
        let manga
        let mData = undefined
        switch (homepageSectionId) {

            case '1': {
                let request = createRequestObject({
                    url: `${MANGAPILL_DOMAIN}/chapters`,
                    method: 'GET'
                })

                let data = await this.requestManager.schedule(request, 1)
                let $ = this.cheerio.load(data.data)

                manga = this.parser.parseRecentUpdatesSection($)
                break
            }
            case '2': {
                let request = createRequestObject({
                    url: `${MANGAPILL_DOMAIN}/search?q=&type=&status=&page=${page}`,
                    method: 'GET'
                })

                let data = await this.requestManager.schedule(request, 1)
                let $ = this.cheerio.load(data.data)

                manga = this.parser.parsePopularSection($)
                if (!this.parser.isLastPage($)) {
                    mData = {page: (page + 1)}
                }

                break
            }
            default:
                return Promise.resolve(null)
        }

        return createPagedResults({
            results: manga,
            metadata: mData
        })
    }

    getCloudflareBypassRequest() {
        return createRequestObject({
            url: `${MANGAPILL_DOMAIN}`,
            method: 'GET',
        })
    }

}
