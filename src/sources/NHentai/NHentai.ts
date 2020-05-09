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

const NHENTAI_DOMAIN = 'https://nhentai.net'

export class NHentai extends Source {
  constructor(cheerio: CheerioAPI) {
    super(cheerio)
  }

  get version(): string { return 'v0.5' }
  get name(): string { return 'nHentai' }
  get description(): string { return 'Extension that pulls manga from nHentai' }

  convertLanguageToCode(language: string) {
      switch(language.toLowerCase()) {
          case "english": return "en"
          case "japanese": return "jp"
          case "chinese": return "chi"
          default: return ""
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

  getMangaDetails(data: any[], metadata: any[]): Manga[] {
    let manga: Manga[] = []
    for (let [i, response] of data.entries()) {
      let $ = this.cheerio.load(response)
      let info = $('[itemprop=name]')
      let image = $('[itemprop=image]').attr('content') ?? ''
      let title = $('[itemprop=name]').attr('content') ?? ''

      // Comma seperate all of the tags and store them in our tag section 
      let tagSections: TagSection[] = [createTagSection({ id: '0', label: 'tag', tags: [] })]
      let tags = $('meta[name="twitter:description"]').attr('content')?.split(",") ?? []
      for(let i = 0; i < tags.length; i++) {
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
      if(altNameTop) {
        titles.push(altNameTop)
      }
      if(altNameBottom) {
          titles.push(altNameBottom)
      }

      // Get the artist and language information
      let context = $("#info-block")
      let artist = ''
      let language = ''
      for(let item of $('.tag-container', context).toArray()) {
        if($(item).text().indexOf("Artists") > -1) {
            let temp = $("a", item).text()
            artist = temp.substring(0, temp.indexOf(" ("))
        }
        else if($(item).text().indexOf("Languages") > -1) {
            let temp = $("a", item)
            if(temp.toArray().length > 1) {
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
        id: metadata[i].id,
        titles: titles,
        image: image,
        rating: 0,
        status: status,
        artist: artist,
        tags: tagSections,
        description: summary,
        hentai: hentai
      }))
    }
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
    for(let item of $('.tag-container').toArray()) {
        if($(item).text().indexOf("Languages") > -1) {
            let temp = $("a", item)
            if(temp.toArray().length > 1) {
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
    let metadata = { 'mangaId': mangaId, 'chapterId': chapId}
    return createRequestObject({
      url: `${NHENTAI_DOMAIN}/g/${mangaId}`,
      metadata: metadata,
      method: 'GET',
    })
  }

  getChapterDetails(data: any, metadata: any): { 'details': ChapterDetails, 'nextPage': boolean, 'param': string | null } {
    let $ = this.cheerio.load(data)

    // Get the number of chapters, we can generate URLs using that as a basis
    let pages: string[] = []
    let thumbContainer = $("#thumbnail-container")
    let numChapters = $('.thumb-container',thumbContainer).length

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

     for(let i = 1; i <= numChapters; i++) {
        pages.push(`https://i.nhentai.net/galleries/${galleryId}/${i}.${imageType}`)
     }

    let chapterDetails = createChapterDetails({
      id: metadata.chapterId,
      mangaId: metadata.mangaId,
      pages, longStrip: false
    })

    let returnObject = {
      'details': chapterDetails,
      'nextPage': metadata.nextPage,
      'param': null
    }

    return returnObject
  }


  filterUpdatedMangaRequest(ids: any, time: Date, page: number): Request {
    return createRequestObject({
      url: `http://niceme.me`,              // We do not use this method, but we need to implement it. Load a page which is tiny in size I guess
      method: "GET",
    })
  }

  filterUpdatedManga(data: any, metadata: any): { 'updatedMangaIds': string[], 'nextPage': boolean } {
    // There's no chapters, so we can just ignore empty stuff! Horray!
    return {updatedMangaIds : [], nextPage: false}
  }

  searchRequest(query: SearchRequest, page: number): Request | null {

    // If the search query is a six digit direct link to a manga, create a request to just that URL and alert the handler via metadata
    if(query.title?.match(/\d{6}/)) {
      return createRequestObject({
        url: `${NHENTAI_DOMAIN}/g/${query.title}`,
        metadata: {sixDigit: true},
        timeout: 4000,
        method: "GET"
      })
    }

    // Concat all of the available options together into a search keyword which can be supplied as a GET request param
    let param = ''
    if(query.title){
        param += query.title + ' '
    }
    if(query.includeContent) {
        for(let content in query.includeContent) {
            param += ('tag:"' + query.includeContent[content] + '" ')
        }
    }
    if(query.excludeContent) {
        for(let content in query.excludeContent) {
            param += ('-tag:"' + query.excludeContent[content] + '" ')
        }
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
    if(title) {
      // Retrieve the ID from the body
      let contextNode = $('#bigcontainer')
      let href = $('a', contextNode).attr('href')

      let mangaId = parseInt(href?.match(/g\/(\d*)\/\d/)![1])
      
      mangaTiles.push({
        id: mangaId.toString(),
        title: createIconText({text: $('[itemprop=name]').attr('content') ?? ''}),
        image: $('[itemprop=image]').attr('content') ?? ''
      })
      return mangaTiles
    }

    let containerNode = $('.index-container')
    for(let item of $('.gallery', containerNode).toArray()) {
        let currNode = $(item)
        let image = $('img', currNode).attr('data-src')!

        // If image is undefined, we've hit a lazyload part of the website. Adjust the scraping to target the other features
        if(image == undefined) {
            image = 'http:' + $('img', currNode).attr('src')!
        }


        let title = $('.caption', currNode).text()
        let idHref = $('a', currNode).attr('href')?.match(/\/(\d*)\//)!
        
        mangaTiles.push( {
            id: idHref[1],
            title: createIconText({text: title}),
            image: image
        })
    }
    
    return mangaTiles
  }
  
  getHomePageSectionRequest(): HomeSectionRequest[] | null { 

    let request = createRequestObject({ url: `${NHENTAI_DOMAIN}`, method: 'GET', })
    let homeSection = createHomeSection({ id: 'latest_hentai', title: 'LATEST HENTAI' })
    return [createHomeSectionRequest({request: request, sections: [homeSection]})]
    
  }

  getHomePageSections(data: any, section: HomeSection[]): HomeSection[] | null { 
    let updatedHentai: MangaTile[] = []
    let $ = this.cheerio.load(data)

    let containerNode = $('.index-container')
    for(let item of $('.gallery', containerNode).toArray()) {
        let currNode = $(item)
        let image = $('img', currNode).attr('data-src')!

        // If image is undefined, we've hit a lazyload part of the website. Adjust the scraping to target the other features
        if(image == undefined) {
            image = 'http:' + $('img', currNode).attr('src')!
        }

        let title = $('.caption', currNode).text()
        let idHref = $('a', currNode).attr('href')?.match(/\/(\d*)\//)!
        
        updatedHentai.push( {
            id: idHref[1],
            title: createIconText({text: title}),
            image: image
        })
    }

    section[0].items = updatedHentai
    return section
  }

  getViewMoreRequest(key: string, page: number): Request | null { return null }
  getViewMoreItems(data: any, key: string): MangaTile[] | null { return null }
  getTagsRequest(): Request | null { return null }
  getTags(data: any): TagSection[] | null { return null }           // Temporarily disabled, there are 26 pages of tags. I'd like to discuss with paper how to handle this
  
}

const cheerio = require('cheerio')
let application = new APIWrapper();
// application.getMangaDetails(new NHentai(cheerio), ['13780']).then((data) => {console.log(data)})
// application.getChapters(new NHentai(cheerio), "13780").then((data) => {console.log(data)})
// application.getChapterDetails(new NHentai(cheerio), "13780", "1").then((data) => {console.log(data)})
let test = createSearchRequest({
	title: '311943'
})
application.search(new NHentai(cheerio), test, 1).then((data) => { console.log("done") })