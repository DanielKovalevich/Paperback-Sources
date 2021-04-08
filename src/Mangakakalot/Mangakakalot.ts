import {
  Source,
  Manga,
  Chapter,
  ChapterDetails,
  HomeSection,
  SearchRequest,
  TagSection,
  PagedResults,
  SourceInfo,
  MangaUpdates,
  RequestHeaders,
  TagType
} from "paperback-extensions-common"

import {
  generateSearch,
  isLastPage,
  parseMangakakalotChapterDetails,
  parseMangakakalotChapters,
  parseHomeSections,
  parseMangaSectionTiles,
  parseMangakakalotMangaDetails,
  parseSearch,
  parseTags,
  /*parseUpdatedManga,*/
  parseViewMore,
  /*UpdatedManga*/
} from "./MangakakalotParser"

import {
  parseManganeloMangaDetails,
  parseManganeloChapters,
  parseManganeloChapterDetails,
} from "./ManganeloParser"

const MK_DOMAIN = 'https://mangakakalot.com'
const MN_DOMAIN = 'https://manganelo.com'
const method = 'GET'
const headers = {
  "Referer": MN_DOMAIN,
  "content-type": "application/x-www-form-urlencoded"
}

export const MangakakalotInfo: SourceInfo = {
  version: '2.0.4',
  name: 'Mangakakalot',
  icon: 'mangakakalot.com.png',
  author: 'getBoolean',
  authorWebsite: 'https://github.com/getBoolean',
  description: 'Extension that pulls manga from Mangakakalot',
  hentaiSource: false,
  websiteBaseURL: MK_DOMAIN,
  sourceTags: [
    {
      text: "Notifications",
      type: TagType.GREEN
    }
  ]
}

export class Mangakakalot extends Source {
  getMangaShareUrl(mangaId: string): string | null { return `${mangaId}/` }

  async getMangaDetails(mangaId: string): Promise<Manga> {
    let idTemp = mangaId.slice(mangaId.indexOf('/', mangaId.indexOf('/') + 2), mangaId.length)
    let urlDomain = mangaId.replace(idTemp, '')


    const request = createRequestObject({
      url: `${urlDomain}/`,
      method,
      param: idTemp
    })

    const response = await this.requestManager.schedule(request, 1)
    const $ = this.cheerio.load(response.data)

    if (mangaId.toLowerCase().includes('mangakakalot')) {
      return parseMangakakalotMangaDetails($, mangaId)
    }
    else { // mangaId.toLowerCase().includes('manganelo')
      return parseManganeloMangaDetails($, mangaId)
    }
  }

  async getChapters(mangaId: string): Promise<Chapter[]> {
    let idTemp = mangaId.slice(mangaId.indexOf('/', mangaId.indexOf('/') + 2), mangaId.length)
    let urlDomain = mangaId.replace(idTemp, '')
    const request = createRequestObject({
      url: `${urlDomain}/`,
      method,
      param: idTemp
    })

    const response = await this.requestManager.schedule(request, 1)
    const $ = this.cheerio.load(response.data)

    if (mangaId.toLowerCase().includes('mangakakalot')) {
      return parseMangakakalotChapters($, mangaId)
    }
    else { // metadata.id.toLowerCase().includes('manganelo')
      return parseManganeloChapters($, mangaId)
    }
  }
  
  async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
    let request
    if (mangaId.toLowerCase().includes('manganelo')) {
      request = createRequestObject({
        url: `${chapterId}`,
        method,
        headers: {
          'Referer': MN_DOMAIN,
          "content-type": "application/x-www-form-urlencoded",
          Cookie: 'content_lazyload=off'
        },
      })
    }
    else {
      request = createRequestObject({
        url: `${chapterId}`,
        method,
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          Cookie: 'content_lazyload=off'
        },
      })
    }

    

    const response = await this.requestManager.schedule(request, 1)
    const $ = this.cheerio.load(response.data)

    if (mangaId.toLowerCase().includes('mangakakalot')) {
      return parseMangakakalotChapterDetails($, mangaId, chapterId)
    }
    else { // metadata.mangaId.toLowerCase().includes('manganelo')
      return parseManganeloChapterDetails($, mangaId, chapterId)
    }
  }

  // Mangakakalot does not show the updated date on their latest updates page, so return all ids
  async filterUpdatedManga(mangaUpdatesFoundCallback: (updates: MangaUpdates) => void, time: Date, ids: string[]): Promise<void> {
    mangaUpdatesFoundCallback(createMangaUpdates({
      ids: ids
    }))
  }

  async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
    // Give Paperback a skeleton of what these home sections should look like to pre-render them
    const section1 = createHomeSection({ id: 'popular_manga', title: 'POPULAR MANGA' })
    const section2 = createHomeSection({ id: 'latest_updates', title: 'LATEST MANGA RELEASES', view_more: true })
    const section3 = createHomeSection({ id: 'hot_manga', title: 'HOT MANGA', view_more: true })
    const section4 = createHomeSection({ id: 'new_manga', title: 'NEW MANGA', view_more: true })
    const section5 = createHomeSection({ id: 'zcompleted_manga', title: 'COMPLETED MANGA', view_more: true })

    // Fill the homsections with data
    const request1 = createRequestObject({
      url: `${MK_DOMAIN}`,
      method: 'GET'
    })
    const request3 = createRequestObject({
      url: `${MK_DOMAIN}/manga_list?type=topview&category=all&state=all&page=`,
      method: 'GET'
    })
    const request4 = createRequestObject({
      url: `${MK_DOMAIN}/manga_list?type=newest&category=all&state=all&page=`,
      method: 'GET'
    })
    const request5 = createRequestObject({
      url: `${MK_DOMAIN}/manga_list?type=newest&category=all&state=Completed&page=`,
      method: 'GET'
    })

    const response1 = await this.requestManager.schedule(request1, 1)
    const $1 = this.cheerio.load(response1.data)

    const response3 = await this.requestManager.schedule(request3, 1)
    const $3 = this.cheerio.load(response3.data)

    const response4 = await this.requestManager.schedule(request4, 1)
    const $4 = this.cheerio.load(response4.data)

    const response5 = await this.requestManager.schedule(request5, 1)
    const $5 = this.cheerio.load(response5.data)
    
    parseHomeSections($1, [section1, section2], sectionCallback)
    parseMangaSectionTiles($3, [section3], sectionCallback)
    parseMangaSectionTiles($4, [section4], sectionCallback)
    parseMangaSectionTiles($5, [section5], sectionCallback)
  }

  async searchRequest(query: SearchRequest, metadata: any): Promise<PagedResults> {
    let page: number = metadata?.page ?? 1
    const search = generateSearch(query)
    const request = createRequestObject({
      url: `${MK_DOMAIN}/search/story/`,
      method,
      headers,
      param: `${search}?page=${page}`
    })

    const response = await this.requestManager.schedule(request, 1)
    const $ = this.cheerio.load(response.data)
    const manga = parseSearch($)
    metadata = !isLastPage($) ? { page: page + 1 } : undefined

    return createPagedResults({
      results: manga,
      metadata
    })
  }

  async getTags(): Promise<TagSection[] | null> {
    const request = createRequestObject({
      url: MK_DOMAIN,
      method,
      headers,
    })

    const response = await this.requestManager.schedule(request, 1)
    const $ = this.cheerio.load(response.data)
    return parseTags($)
  }

  async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults | null> {
    let page: number = metadata?.page ?? 1
    let param = ''
    switch (homepageSectionId) {
      case 'latest_updates':
        param = `/manga_list?type=latest&category=all&state=all&page=${page}`
        //console.log('param: ' + param)
        break;
      case 'hot_manga':
        param = `/manga_list?type=topview&category=all&state=all&page=${page}`
        break;
      case 'new_manga':
        param = `/manga_list?type=newest&category=all&state=all&page=${page}`
        break;
      case 'zcompleted_manga':
        param = `/manga_list?type=newest&category=all&state=Completed&page=${page}`
        break;
      default:
        return Promise.resolve(null)
    }

    const request = createRequestObject({
      url: MK_DOMAIN,
      method,
      param,
    })

    const response = await this.requestManager.schedule(request, 1)
    const $ = this.cheerio.load(response.data)
    const manga = parseViewMore($)
    metadata = !isLastPage($) ? { page: page + 1 } : undefined

    return createPagedResults({
      results: manga,
      metadata
    })
  }

  globalRequestHeaders(): RequestHeaders {
    return {
      referer: MN_DOMAIN
    }
  }
}