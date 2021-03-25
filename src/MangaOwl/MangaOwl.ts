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

const MANGAOWL_DOMAIN = 'https://mangaowl.net/'

export const MangaOwlInfo: SourceInfo = {
    version: '1.0.0',
    name: 'MangaOwl',
    description: 'Extension that pulls manga from MangaOwl, includes Advanced Search and Updated manga fetching',
    author: 'Grimes',
    authorWebsite: 'https://github.com/Synstress',
    icon: "logo.png",
    hentaiSource: false,
    websiteBaseURL: MANGAOWL_DOMAIN,
    sourceTags: []
}


export class MangaOwl extends Source {

    parser = new Parser()

    
    getMangaShareUrl(mangaId: string): string | null {
        return `${MANGAOWL_DOMAIN}/single/${mangaId}`
    }



    get rateLimit() { return 100 }

    async getMangaDetails(mangaId: string): Promise<Manga> {

        let request = createRequestObject({
            url: `${MANGAOWL_DOMAIN}/single/${mangaId}`,
            method: 'GET',
            
        })
        const data = await this.requestManager.schedule(request, 1)

        let $ = this.cheerio.load(data.data)
        

        return this.parser.parseMangaDetails($, mangaId)
    }


    async getChapters(mangaId: string): Promise<Chapter[]> {
        let request = createRequestObject({
            url: `${MANGAOWL_DOMAIN}/single/${mangaId}`,
            method: "GET",
            
        })

        const data = await this.requestManager.schedule(request, 1)
        let $ = this.cheerio.load(data.data)

        let chapters = this.parser.parseChapterList($, mangaId)

        return chapters
    }


    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {

        let request = createRequestObject({
            url: `${MANGAOWL_DOMAIN}/single/${mangaId}`,
            method: 'GET',
            param: '?readType=1&quality=hq',
            
        })

        let data = await this.requestManager.schedule(request, 1)

        let $ = this.cheerio.load(data.data)
        let pages = this.parser.parseChapterDetails(data.data,this.cheerio)




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
                    url: `${MANGAOWL_DOMAIN}/ComicList/Newest`,
                    method: 'GET',
                   
                }),
                section: createHomeSection({
                    id: '0',
                    title: 'NEWEST COMICS',
                    view_more: true
                }),
            },
            {
                request: createRequestObject({
                    url: `${MANGAOWL_DOMAIN}/ComicList/LatestUpdate`,
                    method: 'GET',
                    
                }),
                section: createHomeSection({
                    id: '1',
                    title: 'RECENTLY UPDATED',
                    view_more: true,
                }),
            },
            {
                request: createRequestObject({
                    url: `${MANGAOWL_DOMAIN}/ComicList/MostPopular`,
                    method: 'GET',
                    
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
            url: `${MANGAOWL_DOMAIN}${webPage}`,
            method: 'GET',
            
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
            url: `${MANGAOWL_DOMAIN}/Search/Comic`,
            method: 'POST',
            data: this.urlEncodeObject(data),
        })
    }
}