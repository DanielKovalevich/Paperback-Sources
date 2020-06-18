import { Source } from '../Source'
import { Manga, MangaStatus } from '../../models/Manga/Manga'
import { Chapter } from '../../models/Chapter/Chapter'
import { MangaTile } from '../../models/MangaTile/MangaTile'
import { SearchRequest } from '../../models/SearchRequest/SearchRequest'
import { Request } from '../../models/RequestObject/RequestObject'
import { ChapterDetails } from '../../models/ChapterDetails/ChapterDetails'
import { Tag, TagSection } from '../../models/TagSection/TagSection'
import { HomeSection, HomeSectionRequest } from '../../models/HomeSection/HomeSection'
import { APIWrapper } from '../../API'
import { LanguageCode } from '../../models/Languages/Languages'

const ME_DOMAIN = 'http://paperback-redirector.herokuapp.com/me'

export class ManhwaEighteenRedirected extends Source {
  constructor(cheerio: CheerioAPI) {
    super(cheerio)
  }

  get version(): string { return '0.6.1' }
  get name(): string { return 'Manhwa18 (Country-Proof) (18+)' }
  get description(): string { return 'Manhwa18 source which is guarinteed to work in countries the website is normally blocked. May be a tad slower than the original source' }
  get author(): string { return 'Conrad Weiser' }
  get authorWebsite(): string { return 'http://github.com/conradweiser'}
  get icon(): string { return "logo.png" } 
  get hentaiSource(): boolean { return true }
  getMangaShareUrl(mangaId: string): string | null { return `${ME_DOMAIN}/manga/${mangaId}.html`}



  getMangaDetailsRequest(ids: string[]): Request[] {
    let requests: Request[] = []
    for (let id of ids) {
      let metadata = { 'id': id }
      requests.push(createRequestObject({
        url: `${ME_DOMAIN}/manga/${id}.html`,
        metadata: metadata,
        method: 'GET'
      }))
    }
    return requests
  }

  getMangaDetails(data: any, metadata: any): Manga[] {
    let $ = this.cheerio.load(data)

    let titles: string[] = []
    let author

    let tags: TagSection[] = [createTagSection({ id: '0', label: 'genre', tags: [] })]
    let status: MangaStatus = MangaStatus.ONGOING   // Default to ongoing
    let views
    let lang
    let image = `${ME_DOMAIN}${$('.thumbnail').attr('src')}`

    let objContext = $('li', $('.manga-info')).toArray()
    for(let i = 0; i < objContext.length; i++) {
        switch(i) {
            case 0: {
                titles.push($(objContext[i]).text().replace("Manga name:" , "").trim()) ?? ''
                break;
            }
            case 1: {
                titles.push($(objContext[i]).text().replace("Other names: ", "").trim()) ?? ''
                break;
            }
            case 2: {
                author = $('a', $(objContext[i])).text() ?? ''
                break;
            }
            case 3: {
                for(let obj of $('a', $(objContext[i]).toArray()).toArray()) {
                    let text = $(obj).text()
                    tags[0].tags.push(createTag({label: text, id: text}))

                    if(text.toLowerCase().includes("raw")) {
                        lang = LanguageCode.KOREAN
                    }
                    else {
                        lang = LanguageCode.ENGLISH
                    }
                }
                break;
            }
            case 4: {
                let text = $('a', $(objContext[i])).text()
                status = text.includes("On going") ? MangaStatus.ONGOING : MangaStatus.COMPLETED
                break;
            }
            case 6: {
                views = $(objContext[i]).text().replace(" Views: " , "") ?? ''
                break;
            }
        }
    }

    let rowContext = $('.row', $('.well-sm')).toArray()
    let description = $('p', $(rowContext[1])).text()

    let rating = $('.h0_ratings_active', $('.h0rating')).toArray().length

    return [createManga({
        id: metadata.id,
        titles: titles,
        image: image!,
        status: status,
        desc: description,
        tags: tags,
        author: author,
        rating: rating ,
        langFlag: lang,
        langName: lang,
        hentai: true            // This is an 18+ source
    })]

  }

  getChaptersRequest(mangaId: string): Request {
    let metadata = { 'id': mangaId }
    mangaId = mangaId.replace(".html", "")
    return createRequestObject({
        url: `${ME_DOMAIN}/manga/${mangaId}.html`,
        metadata: metadata,
        method: 'GET'
    })
  }

  getChapters(data: any, metadata: any): Chapter[] {
    let $ = this.cheerio.load(data)
    let chapters: Chapter[] = []

    let lang

    let objContext = $('li', $('.manga-info')).toArray()
    for(let i = 0; i < objContext.length; i++) {
        switch(i) {
            case 3: {
                for(let obj of $('a', $(objContext[i]).toArray()).toArray()) {
                    let text = $(obj).text()

                    if(text.toLowerCase().includes("raw")) {
                        lang = LanguageCode.KOREAN
                    }
                    else {
                        lang = LanguageCode.ENGLISH
                    }
                }
                break;
            }
        }
    }

    let i = 1
    for(let obj of $('tr', $('.table')).toArray().reverse()) {
        let id = $('.chapter', $(obj)).attr('href')
        let name = $('b', $(obj)).text().trim()

        //TODO Add the date calculation into here
        let timeStr = /(\d+) ([hours|weeks|months]+) ago/.exec($('time', $(obj)).text().trim())
        let date = new Date()
        if(timeStr) {

          switch(timeStr[2]) {
            case 'hours': {
              // Do nothing, we'll just call it today
              break;
            }
            case 'weeks': {
              date.setDate(date.getDate() - (Number(timeStr[1])) * 7)
              break;
            }
            case 'months': {
              date.setDate(date.getDate() - (Number(timeStr[1])) * 31)  // We're just going to assume 31 days each month I guess. Can't be too specific 
              break;
            }
          }
      }


        chapters.push(createChapter({
            id: id!,
            mangaId: metadata.id,
            chapNum: i,
            langCode: lang ?? LanguageCode.UNKNOWN,
            name: name,
            time: date
        }))

        i++
    }

    return chapters
  }

  getChapterDetailsRequest(mangaId: string, chapId: string): Request {

    let metadata = { 'mangaId': mangaId, 'chapterId': chapId }
    return createRequestObject({
      url: `${ME_DOMAIN}/manga/${chapId}.html`,
      metadata: metadata,
      method: 'GET',
    })
  }

  getChapterDetails(data: any, metadata: any): ChapterDetails {
    let $ = this.cheerio.load(data)
    let pages: string[] = []

    for(let obj of $('img', $('.chapter-content')).toArray()) {
        pages.push($(obj).attr('src')!.trim())
    } 

    metadata.chapterId = metadata.chapterId.replace(".html" , "")
    metadata.chapterId = metadata.chapterId.replace(/-chapter-\d/g, "")
    metadata.chapterId = metadata.chapterId.replace("read", "manga")

    return createChapterDetails({
        id: metadata.chapterId,
        mangaId: metadata.mangaId,
        pages: pages,
        longStrip: true
    })
  }


  searchRequest(query: SearchRequest, page: number): Request | null {

    // If h-sources are disabled for the search request, always return null
    if(query.hStatus === false) {
      return null
    }

    let title = query.title?.replace(" ", "+")

    return createRequestObject({
      url: `${ME_DOMAIN}/search/danh-sach-truyen.html?m_status=&author=&group=&name=${title}&genre=&ungenre=`,
      timeout: 4000,
      method: "GET"
    })
  }

  search(data: any, metadata: any): MangaTile[] {

    let $ = this.cheerio.load(data)
    let mangaTiles: MangaTile[] = []

    for(let obj of $('.row-list').toArray()) {
        let title = $('a', $('.media-heading', $(obj))).text() ?? ''
        let id = $('a', $('.media-heading', $(obj))).attr('href') ?? ''
        let img = `${ME_DOMAIN}${$('img', $(obj)).attr('src')}` ?? ''
        let textContext = $('.media-body', $(obj))
        let primaryText = createIconText({text: $('span', textContext).text()})

        // The redirector does something weird with the image link, make it right here
        img = img.replace("/me/me", "/me")

        id = id.replace(".html" , "")
        
        mangaTiles.push(createMangaTile({
            title: createIconText({text: title}),
            id: id,
            image: img,
            primaryText: primaryText
        }))
    }

    return mangaTiles
  }

  getHomePageSectionRequest(): HomeSectionRequest[] {
    let request = createRequestObject({url: `${ME_DOMAIN}/site/`, method: 'GET'})
    let section1 = createHomeSection({id: 'latest_release', title: 'Latest Manhwa Releases'})

    return [createHomeSectionRequest({request: request, sections: [section1]})]
}

getHomePageSections(data: any, sections: HomeSection[]): HomeSection[] {
    let $ = this.cheerio.load(data)
    let latestManga: MangaTile[] = []

    let context = $('#contentstory').toArray()[0]
    for(let item of $('.itemupdate', $(context)).toArray()) {
        let id = $('a', $(item)).attr('href')?.replace(".html", "")
        let title = createIconText({text: $('.title-h3', $(item)).text()})
        let image = `${ME_DOMAIN}${$('.lazy', $(item)).attr('src')}`
        let views = $('.view', $(item)).text()

        // The redirector does something weird with the image link, make it right here
        image = image.replace("/me/me", "/me")

        if(!id) {
            continue
        }
        
        latestManga.push(createMangaTile({
            id: id,
            title: title,
            image: image,
            primaryText: createIconText({text: views})
        }))
    }

    sections[0].items = latestManga

    return sections
}
}
