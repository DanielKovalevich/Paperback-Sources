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

const COMICEXTRA_DOMAIN = 'https://www.comicextra.com'

export const ComicExtraInfo: SourceInfo = {
    version: '1.5.4',
    name: 'ComicExtra',
    description: 'Extension that pulls western comics from comicextra.com',
    author: 'GameFuzzy',
    authorWebsite: 'http://github.com/gamefuzzy',
    icon: "icon.png",
    hentaiSource: false,
    websiteBaseURL: COMICEXTRA_DOMAIN,
    sourceTags: [
        {
            text: "Notifications",
            type: TagType.GREEN
        }
    ]
}

export class ComicExtra extends Source {
    parser = new Parser()

    getMangaShareUrl(mangaId: string): string | null {
        return `${COMICEXTRA_DOMAIN}/comic/${mangaId}`
    }

    async getMangaDetails(mangaId: string): Promise<Manga> {

        let request = createRequestObject({
            url: `${COMICEXTRA_DOMAIN}/comic/${mangaId}`,
            method: 'GET'
        })
        const data = await this.requestManager.schedule(request, 1)

        let $ = this.cheerio.load(data.data)

        return this.parser.parseMangaDetails($, mangaId)
    }


    async getChapters(mangaId: string): Promise<Chapter[]> {
        let request = createRequestObject({
            url: `${COMICEXTRA_DOMAIN}/comic/${mangaId}`,
            method: "GET"
        })

        const data = await this.requestManager.schedule(request, 1)
        let $ = this.cheerio.load(data.data)

        let chapters: Chapter[] = []
        let pagesLeft = $('a', $('.general-nav')).toArray().length
        pagesLeft = pagesLeft == 0 ? 1 : pagesLeft

        while (pagesLeft > 0) {
            let pageRequest = createRequestObject({
                url: `${COMICEXTRA_DOMAIN}/comic/${mangaId}/${pagesLeft}`,
                method: "GET"
            })
            const pageData = await this.requestManager.schedule(pageRequest, 1)
            $ = this.cheerio.load(pageData.data)
            chapters = chapters.concat(this.parser.parseChapterList($, mangaId))
            pagesLeft--
        }

        return this.parser.sortChapters(chapters)
    }


    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {

        let request = createRequestObject({
            url: `${COMICEXTRA_DOMAIN}/${mangaId}/${chapterId}/full`,
            method: 'GET',
        })

        let data = await this.requestManager.schedule(request, 1)

        let $ = this.cheerio.load(data.data)
        let unFilteredPages = this.parser.parseChapterDetails($)
        let pages: string[] = []

        const fallback = 'https://cdn.discordapp.com/attachments/549267639881695289/801836271407726632/fallback.png'
        // Fallback if empty
        if (unFilteredPages.length < 1) {
            pages.push(fallback)
        } else {
            // Filter out 404 status codes
            request = createRequestObject({
                url: `${unFilteredPages[0]}`,
                method: 'HEAD',
            })
            // Try/catch is because the testing framework throws an error on 404
            try {
                data = await this.requestManager.schedule(request, 1)
                if (data.status == 404) {
                    pages.push(fallback)
                } else {
                    for (let page of unFilteredPages) {
                        pages.push(page)
                    }
                }
            } catch {
                pages.push(fallback)
            }

        }

        return createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages,
            longStrip: false
        })
    }

    async filterUpdatedManga(mangaUpdatesFoundCallback: (updates: MangaUpdates) => void, time: Date, ids: string[]): Promise<void> {

        let loadNextPage: boolean = true
        let currPageNum: number = 1

        while (loadNextPage) {

            let request = createRequestObject({
                url: `${COMICEXTRA_DOMAIN}/comic-updates/${String(currPageNum)}`,
                method: 'GET'
            })

            let data = await this.requestManager.schedule(request, 1)
            let $ = this.cheerio.load(data.data)

            let updatedComics = this.parser.filterUpdatedManga($, time, ids)
            loadNextPage = updatedComics.loadNextPage
            if (loadNextPage) {
                currPageNum++
            }
            if (updatedComics.updates.length > 0) {
                mangaUpdatesFoundCallback(createMangaUpdates({
                    ids: updatedComics.updates
                }))
            }
        }
    }

    async searchRequest(query: SearchRequest, metadata: any): Promise<PagedResults> {
        let page: number = metadata?.page ?? 1

        let request = createRequestObject({
            url: `${COMICEXTRA_DOMAIN}/comic-search`,
            method: "GET",
            param: `?key=${encodeURIComponent(query.title ?? '')}&page=${page}`
        })

        let data = await this.requestManager.schedule(request, 1)
        let $ = this.cheerio.load(data.data)
        let manga = this.parser.parseSearchResults($)
        let mData = undefined
        if (!this.parser.isLastPage($)) {
            mData = {page: (page + 1)}
        }

        return createPagedResults({
            results: manga,
            metadata: mData
        })

    }


    async getTags(): Promise<TagSection[] | null> {
        const request = createRequestObject({
            url: `${COMICEXTRA_DOMAIN}/comic-genres/`,
            method: 'GET'
        })

        const data = await this.requestManager.schedule(request, 1)
        let $ = this.cheerio.load(data.data)

        return this.parser.parseTags($)
    }


    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {

        // Let the app know what the homesections are without filling in the data
        let popularSection = createHomeSection({id: '2', title: 'POPULAR COMICS', view_more: true})
        let recentSection = createHomeSection({id: '1', title: 'RECENTLY ADDED COMICS', view_more: true})
        let newTitlesSection = createHomeSection({id: '0', title: 'LATEST COMICS', view_more: true})
        sectionCallback(popularSection)
        sectionCallback(recentSection)
        sectionCallback(newTitlesSection)

        // Make the request and fill out available titles
        let request = createRequestObject({
            url: `${COMICEXTRA_DOMAIN}/popular-comic`,
            method: 'GET'
        })

        const popularData = await this.requestManager.schedule(request, 1)
        let $ = this.cheerio.load(popularData.data)

        popularSection.items = this.parser.parseHomePageSection($)
        sectionCallback(popularSection)

        request = createRequestObject({
            url: `${COMICEXTRA_DOMAIN}/recent-comic`,
            method: 'GET'
        })

        const recentData = await this.requestManager.schedule(request, 1)
        $ = this.cheerio.load(recentData.data)

        recentSection.items = this.parser.parseHomePageSection($)
        sectionCallback(recentSection)

        request = createRequestObject({
            url: `${COMICEXTRA_DOMAIN}/new-comic`,
            method: 'GET'
        })

        const newData = await this.requestManager.schedule(request, 1)
        $ = this.cheerio.load(newData.data)

        newTitlesSection.items = this.parser.parseHomePageSection($)
        sectionCallback(newTitlesSection)
    }


    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults | null> {
        let webPage = ''
        let page: number = metadata?.page ?? 1
        switch (homepageSectionId) {
            case '0': {
                webPage = `/new-comic/${page}`
                break
            }
            case '1': {
                webPage = `/recent-comic/${page}`
                break
            }
            case '2': {
                webPage = `/popular-comic/${page}`
                break
            }
            default:
                return Promise.resolve(null)
        }

        let request = createRequestObject({
            url: `${COMICEXTRA_DOMAIN}${webPage}`,
            method: 'GET'
        })

        let data = await this.requestManager.schedule(request, 1)
        let $ = this.cheerio.load(data.data)
        let manga = this.parser.parseHomePageSection($)
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

}
