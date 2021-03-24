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

const MANGAOWL_DOMAIN = 'https://mangaowl.net/'

export const ReadComicsToInfo: SourceInfo = {
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

    

    constructor(cheerio: CheerioAPI) {
        super(cheerio)
    }

    parser = new Parser()


    getMangaShareUrl(mangaId: string): string | null {
        return `${MANGAOWL_DOMAIN}/Comic/${mangaId}`
    }



    get rateLimit() { return 100 }
    getMangaDetailsRequest(ids: string[]): Request[] {
        return [createRequestObject({
            metadata: ids[0],
            url: "https://mangaowl.net/single/" + ids[0] + "/pp",
            method: 'GET'
        })]
    }
    getMangaDetails(data: any, metadata: any): Manga[] {
        let $ = this.cheerio.load(data)
        console.log(data)
        let mangaInfo = $(".single_detail")
        let mangaProps = $('div:nth-child(2) p', mangaInfo).toArray()
        let mangaIdRegex = /(?:single\/)(\w+)/gi
        let manga = {
            id: metadata,
            titles: [$('h2', mangaProps).text()],
            image: $('img', mangaInfo).attr('data-src')!.replace(/^(\/\/)/gi, 'https://'),
            rating: 0,
            status: MangaStatus.ONGOING,
            artist: "",
            author: "",
            desc: $('.single_detail .description').text().replace(/^\./gi, ''),
        }
        for (let prop of mangaProps) {
            let propertyValue = $(prop).text().toLowerCase()

            if (propertyValue.includes('rating')) {
                manga.rating = Number($('font', prop).text())
            } else if (propertyValue.includes('status')) {
                let status = $(prop).contents().filter((_, x) => {
                    return x.type === 'text';
                }).text();
                manga.status = status.toLowerCase().includes('ongoing') ? MangaStatus.ONGOING : MangaStatus.COMPLETED
            } else if (propertyValue.includes('author')) {
                let author = $(prop).contents().filter((_, x) => {
                    return x.type === 'text';
                }).text();
                manga.author = author.trim()
            } else if (propertyValue.includes('artist')) {
                let artist = $(prop).contents().filter((_, x) => {
                    return x.type === 'text'
                }).text();
                manga.artist = artist.trim()
            }
        }
        return [createManga(manga)]
    }
    getChaptersRequest(mangaId: string): Request {
        return createRequestObject({
            metadata: mangaId,
            url: "https://mangaowl.net/single/" + mangaId+ "/chapters-or-something",
            method: 'GET'
        })
    }
    getChapters(data: any, metadata: any): Chapter[] {
        let $ = this.cheerio.load(data)
        let chapters = $('.table-chapter-list .list-group-item.chapter_list').toArray()
        let chapterList = []
        let chapterStrRegex = /(chapter)\s?(\d+\.?\d+)/gim
        let chapterNumberRegex = /(\d+?)\.?(\d+$)/gim
                for (let chapter of chapters) {
            let chapNum = $('label.chapter-title', chapter).text().match(chapterStrRegex)![0].match(chapterNumberRegex)!
            // paste stuff here from now on
            chapterList.push(createChapter({
                id: $('.chapter-url', chapter).attr('chapter-id')!,
                chapNum: Number(chapNum[0]),
                langCode: LanguageCode.ENGLISH,
                volume: 0,
                mangaId: metadata,
                name: "",
                time: new Date($('.chapter-url small', chapter).text()),
            }))
        }
        return chapterList
    }
    searchRequest(query: SearchRequest, page: number): Request | null {
        return createRequestObject({
            url: "https://mangaowl.net/search/1?search=" + encodeURI(query.title ?? ""),
            method: "GET"
        })
    }
    search(data: any, metadata: any): MangaTile[] | null {
        let $ = this.cheerio.load(data)
        let searchResults = $('.flexslider .comicView').toArray()
        let mangaIdRegex = /(?:single\/)(\w+)/gi 
        let mangas = []
        for (let result of searchResults) {
            mangas.push(createMangaTile({
                id: $('a', result).attr('href')!.match(mangaIdRegex)![0].split('/')[1],
                image: $('.comic_thumbnail', result).attr('data-background-image')!,
                title: createIconText({ text: $('.comic_title', result).text().trim() }),
            
            }))
        }

        return mangas
    }
    getChapterDetailsRequest(mangaId: string, chapId: string): Request {
        return createRequestObject({
            url: "http://mangaowl.net/reader/" + mangaId + "/" + chapId,
            method: 'GET',
            metadata: {
                chapId: chapId,
                mangaId: mangaId
            }
        })
    }

    getChapterDetails(data: any, metadata: any): ChapterDetails {
        let $ = this.cheerio.load(data, { xmlMode: false })

        let allPages = $('#reader img[data-src]').toArray()
        let pages = []
        for (let page of allPages) {
            pages.push($(page).attr('data-src')!)
        }

        return createChapterDetails({
            id: metadata.chapId,
            longStrip: false,
            mangaId: metadata.mangaId,
            pages: pages
        })
    }

}