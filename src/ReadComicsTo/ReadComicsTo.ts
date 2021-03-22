import {
    Chapter,
    ChapterDetails,
    HomeSection,
    Manga,
    MangaUpdates,
    PagedResults,
    SearchRequest,
    RequestHeaders,
    Source,
    SourceInfo,
    TagSection,
    TagType,
} from "paperback-extensions-common"

import {Parser,} from './Parser'

const READCOMICSTO_DOMAIN = 'https://readcomiconline.to'

export const ReadComicsToInfo: SourceInfo = {
    version: '1.0.0',
    name: 'ReadComicsOnlineTo',
    description: 'Extension that pulls western comics from readcomiconline.to',
    author: 'Aurora',
    authorWebsite: 'https://github.com/Aur0raN',
    icon: "icon.png",
    hentaiSource: false,
    websiteBaseURL: READCOMICSTO_DOMAIN,
    sourceTags: [
        {
            text: "Notifications",
            type: TagType.GREEN
        }
    ]
}

export class ReadComicsTo extends Source {


    baseUrl: string = READCOMICSTO_DOMAIN
    userAgentRandomizer: string = `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:77.0) Gecko/20100101 Firefox/78.0${Math.floor(Math.random() * 100000)}`
    parser = new Parser()


    getMangaShareUrl(mangaId: string): string | null {
        return `${READCOMICSTO_DOMAIN}/Comic/${mangaId}`
    }

    async getMangaDetails(mangaId: string): Promise<Manga> {

        let request = createRequestObject({
            url: `${READCOMICSTO_DOMAIN}/Comic/${mangaId}`,
            method: 'GET',
            headers: this.constructHeaders({})
        })
        const data = await this.requestManager.schedule(request, 1)

        let $ = this.cheerio.load(data.data)
        

        return this.parser.parseMangaDetails($, mangaId)
    }


    async getChapters(mangaId: string): Promise<Chapter[]> {
        let request = createRequestObject({
            url: `${READCOMICSTO_DOMAIN}/comic/${mangaId}`,
            method: "GET"
        })

        const data = await this.requestManager.schedule(request, 1)
        let $ = this.cheerio.load(data.data)

        let chapters = this.parser.parseChapterList($, mangaId)

        return this.parser.sortChapters(chapters)
    }


    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {

        let request = createRequestObject({
            url: `${READCOMICSTO_DOMAIN}/${mangaId}/${chapterId}/&readType=1`,
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
                url: `${READCOMICSTO_DOMAIN}/ComicList/LatestUpdate`,
                method: 'GET',
                param: `?page=${currPageNum}`
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

    async searchRequest(query: SearchRequest, metadata: any, ): Promise<PagedResults> {
        let page: number = metadata?.page ?? 1

        let request = this.constructSearchRequest(query.title??'')



        let data = await this.requestManager.schedule(request, 1)
        let $ = this.cheerio.load(data.data)
        let manga = this.parser.parseSearchResults($,this.cheerio)
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
            url: `${READCOMICSTO_DOMAIN}/comic-genres/`,
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
            url: `${READCOMICSTO_DOMAIN}/popular-comic`,
            method: 'GET'
        })

        const popularData = await this.requestManager.schedule(request, 1)
        let $ = this.cheerio.load(popularData.data)

        popularSection.items = this.parser.parseHomePageSection($)
        sectionCallback(popularSection)

        request = createRequestObject({
            url: `${READCOMICSTO_DOMAIN}/recent-comic`,
            method: 'GET'
        })

        const recentData = await this.requestManager.schedule(request, 1)
        $ = this.cheerio.load(recentData.data)

        recentSection.items = this.parser.parseHomePageSection($)
        sectionCallback(recentSection)

        request = createRequestObject({
            url: `${READCOMICSTO_DOMAIN}/new-comic`,
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
            url: `${READCOMICSTO_DOMAIN}${webPage}`,
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
    

    constructHeaders(headers: any, refererPath?: string): any {
        if(this.userAgentRandomizer !== '') {
            headers["user-agent"] = this.userAgentRandomizer
        }
        headers["referer"] = `${this.baseUrl}${refererPath ?? ''}`
        headers["content-type"] = "application/x-www-form-urlencoded"
        return headers
    }

    globalRequestHeaders(): RequestHeaders {
        if(this.userAgentRandomizer !== '') {
            return {
                "referer": `${this.baseUrl}/`,
                "user-agent": this.userAgentRandomizer,
                "accept": "image/jpeg,image/png,image/*;q=0.8"
            }
        }
        else {
            return {
                "referer": `${this.baseUrl}/`,
                "accept": "image/jpeg,image/png,image/*;q=0.8"
            }
        }
    }

    CloudFlareError(status: any) {
        if(status == 503) {
            throw new Error('CLOUDFLARE BYPASS ERROR:\nPlease go to Settings > Sources > \<\The name of this source\> and press Cloudflare Bypass')
        }
    }


    constructSearchRequest(searchQuery: string): any {
        let isSearch = searchQuery != ''
        let data: any = {
            "keyword": searchQuery,
        }

        return createRequestObject({
            url: `${READCOMICSTO_DOMAIN}/Search/Comic`,
            method: 'POST',
            headers: this.constructHeaders({}),
            data: this.urlEncodeObject(data),
        })
    }

}
