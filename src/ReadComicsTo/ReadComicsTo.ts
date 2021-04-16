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

const READCOMICSTO_DOMAIN = 'https://readcomiconline.li'

export const ReadComicsToInfo: SourceInfo = {
    version: '1.0.5',
    name: 'ReadComicsOnlineLi',
    description: 'Extension that pulls western comics from readcomiconline.li',
    author: 'Aurora',
    authorWebsite: 'https://github.com/Aur0raN',
    icon: "logo.png",
    hentaiSource: false,
    websiteBaseURL: READCOMICSTO_DOMAIN,
    sourceTags: []
}

export class ReadComicsTo extends Source {

    requestManager = createRequestManager({
        requestsPerSecond: 1.5,
        requestTimeout: 15000,
      })


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
            url: `${READCOMICSTO_DOMAIN}/Comic/${mangaId}`,
            method: "GET",
            headers: this.constructHeaders({})
        })

        const data = await this.requestManager.schedule(request, 1)
        let $ = this.cheerio.load(data.data)

        let chapters = this.parser.parseChapterList($, mangaId)

        return chapters
    }


    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {

        let request = createRequestObject({
            url: `${READCOMICSTO_DOMAIN}/Comic/${mangaId}/${chapterId}`,
            method: 'GET',
            param: '?readType=1&quality=hq',
            headers: this.constructHeaders({})
        })

        let data = await this.requestManager.schedule(request, 1)

        let $ = this.cheerio.load(data.data)
        let pages = this.parser.parseChapterDetails(data.data)




        return createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages,
            longStrip: false
        })
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


    // async getTags(): Promise<TagSection[] | null> {
    //     const request = createRequestObject({
    //         url: `${READCOMICSTO_DOMAIN}/comic-genres/`,
    //         method: 'GET'
    //     })

    //     const data = await this.requestManager.schedule(request, 1)
    //     let $ = this.cheerio.load(data.data)

    //     return this.parser.parseTags($)
    // }


    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {

        const sections = [
            {
                request: createRequestObject({
                    url: `${READCOMICSTO_DOMAIN}/ComicList/Newest`,
                    method: 'GET',
                    headers: this.constructHeaders({})
                }),
                section: createHomeSection({
                    id: '0',
                    title: 'NEWEST COMICS',
                    view_more: true
                }),
            },
            {
                request: createRequestObject({
                    url: `${READCOMICSTO_DOMAIN}/ComicList/LatestUpdate`,
                    method: 'GET',
                    headers: this.constructHeaders({})
                }),
                section: createHomeSection({
                    id: '1',
                    title: 'RECENTLY UPDATED',
                    view_more: true,
                }),
            },
            {
                request: createRequestObject({
                    url: `${READCOMICSTO_DOMAIN}/ComicList/MostPopular`,
                    method: 'GET',
                    headers: this.constructHeaders({})
                }),
                section: createHomeSection({
                    id: '2',
                    title: 'MOST POPULAR',
                    view_more: true,
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
                    section.section.items = this.parser.parseSearchResults($, this.cheerio)
                    sectionCallback(section.section)
                }),
            )
        }

        // Make sure the function completes
        await Promise.all(promises)
    }


    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults | null> {
        let webPage = ''
        let page: number = metadata?.page ?? 1
        switch (homepageSectionId) {
            case '0': {
                webPage = `/ComicList/Newest?page=${page}`
                break
            }
            case '1': {
                webPage = `/ComicList/LatestUpdate?page=${page}`
                break
            }
            case '2': {
                webPage = `/ComicList/MostPopular?page=${page}`
                break
            }
            default:
                return Promise.resolve(null)
        }

        let request = createRequestObject({
            url: `${READCOMICSTO_DOMAIN}${webPage}`,
            method: 'GET',
            headers: this.constructHeaders({})
        })

        let data = await this.requestManager.schedule(request, 1)
        let $ = this.cheerio.load(data.data)
        let manga = this.parser.parseHomePageSection($,this.cheerio)
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

    getCloudflareBypassRequest() {
        return createRequestObject({
            url: `${READCOMICSTO_DOMAIN}`,
            method: 'GET',
        })
    }
    

    

}
