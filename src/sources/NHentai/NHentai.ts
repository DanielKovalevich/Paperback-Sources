import { Source } from '../Source'
import { Manga } from '../../models/Manga/Manga'
import { Chapter } from '../../models/Chapter/Chapter'
import { MangaTile } from '../../models/MangaTile/MangaTile'
import { SearchRequest } from '../../models/SearchRequest/SearchRequest'
import { Request } from '../../models/RequestObject/RequestObject'
import { ChapterDetails } from '../../models/ChapterDetails/ChapterDetails'
import { Tag, TagSection } from '../../models/TagSection/TagSection'
import { HomeSection, HomeSectionRequest } from '../../models/HomeSection/HomeSection'
import { APIWrapper } from '../../API'
import { LanguageCode } from '../../models/Languages/Languages'

const NHENTAI_DOMAIN = 'https://nhentai.net'

export class NHentai extends Source {
  constructor(cheerio: CheerioAPI) {
    super(cheerio)
  }

  get version(): string { return '0.5.7' }
  get name(): string { return 'nHentai' }
  get description(): string { return 'Extension that pulls manga from nHentai' }
  get author(): string { return 'Conrad Weiser' }
  get icon(): string { return "logo.png" } // The website has SVG versions, I had to find one off of a different source
  get hentaiSource(): boolean { return true }


  convertLanguageToCode(language: string) {
    switch (language.toLowerCase()) {
      case "english": return LanguageCode.ENGLISH
      case "japanese": return LanguageCode.JAPANESE
      case "chinese": return LanguageCode.CHINEESE
      default: return LanguageCode.UNKNOWN
    }
  }

  getMangaDetailsRequest(ids: string[]): Request[] {
    let requests: Request[] = []
    for (let id of ids) {
      let metadata = { 'id': id }
      requests.push(createRequestObject({
        url: `${NHENTAI_DOMAIN}/g/${id}`,
        metadata: metadata,
        method: 'GET'
      }))
    }
    return requests
  }

  getMangaDetails(data: any, metadata: any): Manga[] {
    let manga: Manga[] = []
    let $ = this.cheerio.load(data)
    let info = $('[itemprop=name]')
    let image = $('[itemprop=image]').attr('content') ?? ''
    let title = $('[itemprop=name]').attr('content') ?? ''

    // Comma seperate all of the tags and store them in our tag section 
    let tagSections: TagSection[] = [createTagSection({ id: '0', label: 'tag', tags: [] })]
    let tags = $('meta[name="twitter:description"]').attr('content')?.split(",") ?? []
    for (let i = 0; i < tags.length; i++) {
      tagSections[0].tags.push(createTag({
        id: i.toString().trim(),
        label: tags[i]
      }))
    }

    // Grab the alternative titles
    let titles = [title]
    let altTitleBlock = $('#info')
    let altNameTop = $('h1', altTitleBlock).text() ?? ''
    let altNameBottom = $('h2', altTitleBlock).text() ?? ''
    if (altNameTop) {
      titles.push(altNameTop)
    }
    if (altNameBottom) {
      titles.push(altNameBottom)
    }

    // Get the artist and language information
    let context = $("#info-block")
    let artist = ''
    let language = ''
    for (let item of $('.tag-container', context).toArray()) {
      if ($(item).text().indexOf("Artists") > -1) {
        let temp = $("a", item).text()
        artist = temp.substring(0, temp.indexOf(" ("))
      }
      else if ($(item).text().indexOf("Languages") > -1) {
        let temp = $("a", item)
        if (temp.toArray().length > 1) {
          let temptext = $(temp.toArray()[1]).text()
          language = temptext.substring(0, temptext.indexOf(" ("))
        }
        else {
          let temptext = temp.text()
          language = temptext.substring(0, temptext.indexOf(" ("))
        }
      }
    }

    let status = 1
    let summary = ''
    let hentai = true                 // I'm assuming that's why you're here!

    manga.push(createManga({
      id: metadata.id,
      titles: titles,
      image: image,
      rating: 0,
      status: status,
      artist: artist,
      tags: tagSections,
      desc: summary,
      hentai: hentai
    }))
    return manga
  }

  getChaptersRequest(mangaId: string): Request {
    let metadata = { 'id': mangaId }
    return createRequestObject({
      url: `${NHENTAI_DOMAIN}/g/${mangaId}`,
      method: "GET",
      metadata: metadata
    })
  }

  getChapters(data: any, metadata: any): Chapter[] {
    let $ = this.cheerio.load(data)
    let chapters: Chapter[] = []

    // NHentai is unique, where there is only ever one chapter.
    let title = $('[itemprop=name]').attr('content') ?? ''
    let time = new Date($('time').attr('datetime') ?? '')

    // Get the correct language code
    let language = ''
    for (let item of $('.tag-container').toArray()) {
      if ($(item).text().indexOf("Languages") > -1) {
        let temp = $("a", item)
        if (temp.toArray().length > 1) {
          let temptext = $(temp.toArray()[1]).text()
          language = temptext.substring(0, temptext.indexOf(" ("))
        }
        else {
          let temptext = temp.text()
          language = temptext.substring(0, temptext.indexOf(" ("))
        }
      }
    }

    chapters.push(createChapter({
      id: "1",                                    // Only ever one chapter on this source
      mangaId: metadata.id,
      name: title,
      chapNum: 1,
      time: time,
      langCode: this.convertLanguageToCode(language),
    }))
    return chapters
  }

  getChapterDetailsRequest(mangaId: string, chapId: string): Request {
    let metadata = { 'mangaId': mangaId, 'chapterId': chapId }
    return createRequestObject({
      url: `${NHENTAI_DOMAIN}/g/${mangaId}`,
      metadata: metadata,
      method: 'GET',
    })
  }

  getChapterDetails(data: any, metadata: any): ChapterDetails {
    let $ = this.cheerio.load(data)

    // Get the number of chapters, we can generate URLs using that as a basis
    let pages: string[] = []
    let thumbContainer = $("#thumbnail-container")
    let numChapters = $('.thumb-container', thumbContainer).length

    // Get the gallery number that it is assigned to
    let gallerySrc = $('img', thumbContainer).attr('data-src')

    // We can regular expression match out the gallery ID from this string
    let galleryId = parseInt(gallerySrc?.match(/.*\/(\d*)\//)![1])

    // Grab the image thumbnail, so we can determine whether this gallery uses PNG or JPG images
    let imageType = $('[itemprop=image]').attr('content')?.match(/cover.([png|jpg]*)/)![1]


    /**
     * N-Hentai always follows the following formats for their pages:
     * https://i.nhentai.net/galleries/43181/10.png
     * The first digit is the gallery ID we retrieved above, whereas the second is the page number.
     * We have the image types from the thumbnail
     */

    for (let i = 1; i <= numChapters; i++) {
      pages.push(`https://i.nhentai.net/galleries/${galleryId}/${i}.${imageType}`)
    }

    let chapterDetails = createChapterDetails({
      id: metadata.chapterId,
      mangaId: metadata.mangaId,
      pages, longStrip: false
    })

    // Unused, idk if you'll need this later so keeping it
    let returnObject = {
      'details': chapterDetails,
      'nextPage': metadata.nextPage,
      'param': null
    }

    return chapterDetails
  }


  searchRequest(query: SearchRequest, page: number): Request | null {

    // If the search query is a six digit direct link to a manga, create a request to just that URL and alert the handler via metadata
    if (query.title?.match(/\d{6}/)) {
      return createRequestObject({
        url: `${NHENTAI_DOMAIN}/g/${query.title}`,
        metadata: { sixDigit: true },
        timeout: 4000,
        method: "GET"
      })
    }

    // Concat all of the available options together into a search keyword which can be supplied as a GET request param
    let param = ''
    if (query.title) {
      param += query.title + ' '
    }
    if (query.includeContent) {
      for (let content in query.includeContent) {
        param += ('tag:"' + query.includeContent[content] + '" ')
      }
    }
    if (query.excludeContent) {
      for (let content in query.excludeContent) {
        param += ('-tag:"' + query.excludeContent[content] + '" ')
      }
    }

    if (query.artist) {
      param += ("Artist:" + query.artist + " ")
    }

    return createRequestObject({
      url: `${NHENTAI_DOMAIN}/search/?q=${param}`,
      metadata: query,
      timeout: 4000,
      method: "GET"
    })
  }

  search(data: any): MangaTile[] {

    let $ = this.cheerio.load(data)
    let mangaTiles: MangaTile[] = []

    // Was this a six digit request? We can check by seeing if we're on a manga page rather than a standard search page -- Metadata for hentai only exists on specific results, not searches, use that
    let title = $('[itemprop=name]').attr('content') ?? ''
    if (title) {
      // Retrieve the ID from the body
      let contextNode = $('#bigcontainer')
      let href = $('a', contextNode).attr('href')

      let mangaId = parseInt(href?.match(/g\/(\d*)\/\d/)![1])

      mangaTiles.push(createMangaTile({
        id: mangaId.toString(),
        title: createIconText({ text: $('[itemprop=name]').attr('content') ?? '' }),
        image: $('[itemprop=image]').attr('content') ?? ''
      }))
      return mangaTiles
    }

    let containerNode = $('.index-container')
    for (let item of $('.gallery', containerNode).toArray()) {
      let currNode = $(item)
      let image = $('img', currNode).attr('data-src')!

      // If image is undefined, we've hit a lazyload part of the website. Adjust the scraping to target the other features
      if (image == undefined) {
        image = 'http:' + $('img', currNode).attr('src')!
      }


      let title = $('.caption', currNode).text()
      let idHref = $('a', currNode).attr('href')?.match(/\/(\d*)\//)!

      mangaTiles.push(createMangaTile({
        id: idHref[1],
        title: createIconText({ text: title }),
        image: image
      }))
    }

    return mangaTiles
  }

  getHomePageSectionRequest(): HomeSectionRequest[] | null {

    let request = createRequestObject({ url: `${NHENTAI_DOMAIN}`, method: 'GET', })
    let homeSection = createHomeSection({ id: 'latest_hentai', title: 'LATEST HENTAI' })
    return [createHomeSectionRequest({ request: request, sections: [homeSection] })]

  }

  getHomePageSections(data: any, section: HomeSection[]): HomeSection[] | null {
    let updatedHentai: MangaTile[] = []
    let $ = this.cheerio.load(data)

    let containerNode = $('.index-container')
    for (let item of $('.gallery', containerNode).toArray()) {
      let currNode = $(item)
      let image = $('img', currNode).attr('data-src')!

      // If image is undefined, we've hit a lazyload part of the website. Adjust the scraping to target the other features
      if (image == undefined) {
        image = 'http:' + $('img', currNode).attr('src')!
      }

      let title = $('.caption', currNode).text()
      let idHref = $('a', currNode).attr('href')?.match(/\/(\d*)\//)!

      updatedHentai.push(createMangaTile({
        id: idHref[1],
        title: createIconText({text: title}),
        image: image
      }))
    }

    section[0].items = updatedHentai
    return section
  }


}