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

const COMICEXTRA_DOMAIN = 'https://www.comicextra.com'

export class ComicExtra extends Source {
  constructor(cheerio: CheerioAPI) {
    super(cheerio)
  }

  get version(): string { return '0.6.5' }
  get name(): string { return 'ComicExtra' }
  get description(): string { return 'Extension that pulls western comics from ComicExtra' }
  get author(): string { return 'Conrad Weiser' }
  get authorWebsite(): string { return 'http://github.com/conradweiser'}
  get icon(): string { return "logo.png" } // The website has SVG versions, I had to find one off of a different source
  get hentaiSource(): boolean { return false }
  getMangaShareUrl(mangaId: string): string | null { return `${COMICEXTRA_DOMAIN}/comic/${mangaId}`}


  getMangaDetailsRequest(ids: string[]): Request[] {
    let requests: Request[] = []
    for (let id of ids) {
      let metadata = { 'id': id }
      requests.push(createRequestObject({
        url: `${COMICEXTRA_DOMAIN}/comic/${id}`,
        metadata: metadata,
        method: 'GET'
      }))
    }
    return requests
  }

  getMangaDetails(data: any, metadata: any): Manga[] {
    let manga: Manga[] = []
    let $ = this.cheerio.load(data)
    
    let titles = [$('.title-1').text()]
    let image = $('img', $('.movie-l-img')).attr('src')
    
    let status, author, released
    let tags: TagSection[] = [createTagSection({id: 'genres', label: 'genres', tags: []})]
    let i = 0
    for(let item of $('.movie-dd', $('.movie-dl')).toArray()) {
        switch(i) {
            case 0: {
                i++
                continue
            }
            case 1: {
                // Comic Status
                if($(item).text().toLowerCase().includes("ongoing")) {
                    status = MangaStatus.ONGOING
                }
                else {
                    status = MangaStatus.COMPLETED
                }
                i++
                continue
            }
            case 2: {
                // Alt Titles
                if($(item).text().toLowerCase().trim() == "-") {
                    i++
                    continue
                }
                titles.push($(item).text().trim())
                i++
                continue
            }
            case 3: {
                // Released Year
                released = $(item).text().trim()
                i++
                continue
            }
            case 4: {
                // Author
                author = $(item).text().trim()
                i++
                continue
            }
            case 5: {
                // Genres
                let genres = $(item).text().split(",")
                for(let genre in genres) {
                    tags[0].tags.push(createTag({id: genre.trim(), label: genre.trim()}))
                }
                i++
                continue
            }
        }
        i = 0
    }

    let summary = $('#film-content', $('#film-content-wrapper')).text().trim()
    let relatedIds: string[] = []
    for(let obj of $('.list-top-item').toArray()) {
        relatedIds.push($('a', $(obj)).attr('href')?.replace(`${COMICEXTRA_DOMAIN}/comic/`, '')!.trim())
    }

    return [createManga({
        id: metadata.id,
        rating: 0,
        titles: titles,
        image: image!,
        status: Number(status),
        author: author,
        lastUpdate: released,
        tags: tags,
        desc: summary,
        relatedIds: relatedIds
    })]
  }

  getChaptersRequest(mangaId: string): Request {
    let metadata = { 'id': mangaId }
    return createRequestObject({
      url: `${COMICEXTRA_DOMAIN}/comic/${mangaId}`,
      method: "GET",
      metadata: metadata
    })
  }

  getChapters(data: any, metadata: any): Chapter[] {
    let $ = this.cheerio.load(data)
    let chapters: Chapter[] = []
    let i = $('tr', $('#list')).toArray().length
    for(let obj of $('tr', $('#list')).toArray()) {
        let chapterId = $('a', $(obj)).attr('href')?.replace(`${COMICEXTRA_DOMAIN}/${metadata.id}/`, '')
        let chapNum = i
        let chapName = $('a', $(obj)).text()
        let time = $($('td', $(obj)).toArray()[1]).text()

        i--
        chapters.push(createChapter({
            id: chapterId!,
            mangaId: metadata.id,
            chapNum: chapNum,
            langCode: LanguageCode.ENGLISH, // This is a comic website, it's probably english? May need to check this
            name: chapName,
            time: new Date(time)
        }))
    }
    return chapters
  }

  getChapterDetailsRequest(mangaId: string, chapId: string): Request {
    let metadata = { 'mangaId': mangaId, 'chapterId': chapId }
    return createRequestObject({
      url: `${COMICEXTRA_DOMAIN}/${mangaId}/${chapId}/full`,
      metadata: metadata,
      method: 'GET',
    })
  }

  getChapterDetails(data: any, metadata: any): ChapterDetails {
    let $ = this.cheerio.load(data)
    let pages: string[] = []

    // Get all of the pages
    for(let obj of $('.chapter_img').toArray()) {
        pages.push($(obj).attr('src')!)
    }

    return createChapterDetails({
        id: metadata.chapterId,
        mangaId: metadata.mangaId,
        pages: pages,
        longStrip: false
    })
  }


  searchRequest(query: SearchRequest, page: number): Request | null {

    query.title = query.title?.replace(" ", "+")

    return createRequestObject({
      url: `${COMICEXTRA_DOMAIN}/comic-search?key=${query.title}`,
      timeout: 4000,
      method: "GET"
    })
  }

  search(data: any, metadata: any): MangaTile[] {

    let $ = this.cheerio.load(data)
    let mangaTiles: MangaTile[] = []

    for(let obj of $('.cartoon-box').toArray()) {
        let id = $('a', $(obj)).attr('href')?.replace(`${COMICEXTRA_DOMAIN}/comic/`, '')
        let titleText = $('h3', $(obj)).text()
        let image = $('img', $(obj)).attr('src')

        if(titleText == "Not found") continue // If a search result has no data, the only cartoon-box object has "Not Found" as title. Ignore.

        mangaTiles.push(createMangaTile({
            id: id!,
            title: createIconText({text: titleText}),
            image: image!
        }))
    }

    return mangaTiles

  }

  getHomePageSectionRequest(): HomeSectionRequest[] | null {

    let request = createRequestObject({ url: `${COMICEXTRA_DOMAIN}/popular-comic`, method: 'GET', })
    let homeSection = createHomeSection({ id: 'popular_comics', title: 'POPULAR COMICS', view_more: false })
    return [createHomeSectionRequest({ request: request, sections: [homeSection] })]

  }

  getHomePageSections(data: any, section: HomeSection[]): HomeSection[] | null {
    let popularComics: MangaTile[] = []
    let $ = this.cheerio.load(data)

    for(let obj of $('.cartoon-box').toArray()) {
        let id = $('a', $(obj)).attr('href')?.replace(`${COMICEXTRA_DOMAIN}/comic/`, '')
        let title = $('h3', $(obj)).text().trim()
        let image = $('img', $(obj)).attr('src')

        popularComics.push(createMangaTile({
            id: id!,
            title: createIconText({text: title}),
            image: image!
        }))
    }

    section[0].items = popularComics
    return section
  }

}
