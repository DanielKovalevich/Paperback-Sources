import { Source } from '../Source'
import { Manga } from '../../models/Manga/Manga'
import { Chapter } from '../../models/Chapter/Chapter'
import { MangaTile } from '../../models/MangaTile/MangaTile'
import { SearchRequest } from '../../models/SearchRequest/SearchRequest'
import { Request } from '../../models/RequestObject/RequestObject'
import { ChapterDetails } from '../../models/ChapterDetails/ChapterDetails'

import { CACHE_MANGA_DETAILS } from '../../models/Constants/Constants'
import { HomeSectionRequest, HomeSection } from '../../models/HomeSection/HomeSection'

const MD_DOMAIN = 'https://mangadex.org'
const MD_CHAPTERS_API = `${MD_DOMAIN}/api/manga`                // /:mangaId
const MD_CHAPTER_DETAILS_API = `${MD_DOMAIN}/api/chapter`       // /:chapterId

export class MangaDex extends Source {
  private hMode: number

  constructor(cheerio: CheerioAPI) {
    super(cheerio)
    this.hMode = 0
  }

  get version(): string { return '1.0' }
  get name(): string { return 'MangaDex' }
  get icon(): string { return 'https://mangadex.org/images/misc/navbar.svg?3' }
  get author(): string { return 'Faizan Durrani' }
  get authorWebsite(): string { return 'https://github.com/FaizanDurrani' }
  get description(): string { return 'Extension that pulls manga from MangaDex, includes Advanced Search and Updated manga fetching' }

  getMangaDetailsRequest(ids: string[]): Request[] {
    return [createRequestObject({
      metadata: { ids },
      url: `${CACHE_MANGA_DETAILS}`,
      method: 'POST',
      headers: {
        "content-type": "application/json"
      },
      data: JSON.stringify({
        ids: ids
      })
    })]
  }

  getMangaDetails(data: any, metadata: any): Manga[] {
    throw new Error("Method not implemented.");
  }

  getChaptersRequest(mangaId: string): Request {
    let metadata = { mangaId }
    return createRequestObject({
      metadata,
      url: MD_CHAPTERS_API,
      param: mangaId,
      method: "GET"
    })
  }

  getChapters(data: any, metadata: any): Chapter[] {
    data = data.chapter as any

    return Object.keys(data).map(id => {
      const chapter = data[id]

      return createChapter({
        id: id,
        chapNum: parseFloat(chapter.chapter),
        langCode: chapter.lang_code,
        volume: parseFloat(chapter.volume),
        mangaId: metadata.mangaId,
        group: chapter.group_name,
        name: chapter.title,
        time: new Date(chapter.timestamp)
      })
    })
  }

  getChapterDetailsRequest(mangaId: string, chapId: string): Request {
    throw new Error("Method not implemented.")
  }

  getChapterDetails(data: any, metadata: any): { 'details': ChapterDetails, 'nextPage': boolean, 'param': string } {
    throw new Error("Method not implemented.")
  }

  filterUpdatedMangaRequest(ids: string[], time: Date, page: number): Request | null {
    return null

    // let metadata = { 'ids': ids, 'referenceTime': time }
    // let cookies = [
    //   createCookie({
    //     name: 'mangadex_title_mode',
    //     value: '2'
    //   })
    // ]
    // return createRequestObject(metadata, 'https://mangadex.org/titles/0/', cookies, page.toString(), undefined, undefined, undefined, undefined, true)
  }

  filterUpdatedManga(data: any, metadata: any): { 'updatedMangaIds': string[], 'nextPage': boolean } {
    let $ = this.cheerio.load(data)

    let returnObject: { 'updatedMangaIds': string[], 'nextPage': boolean } = {
      'updatedMangaIds': [],
      'nextPage': true
    }

    for (let elem of $('.manga-entry').toArray()) {
      let id = elem.attribs['data-id']
      if (new Date($(elem).find('time').attr('datetime')?.toString() ?? "") > metadata.referenceTime) {
        if (metadata.ids.includes(id)) {
          returnObject.updatedMangaIds.push(id)
        }
      }
      else {
        returnObject.nextPage = false
        return returnObject
      }
    }

    return returnObject
  }

  getHomePageSectionRequest(): HomeSectionRequest[] {
    let request1 = createRequestObject({
      url: 'https://mangadex.org',
      method: "GET"
    })
    let request2 = createRequestObject({
      url: 'https://mangadex.org/updates',
      method: 'GET'
    })

    let section1 = createHomeSection({ id: 'featured_titles', title: 'FEATURED TITLES' })
    let section2 = createHomeSection({ id: 'new_titles', title: 'NEW TITLES' })
    let section3 = createHomeSection({ id: 'recently_updated', title: 'RECENTLY UPDATED TITLES' })

    return [
      createHomeSectionRequest({
        request: request1,
        sections: [section1, section2]
      }),
      createHomeSectionRequest({
        request: request2,
        sections: [section3]
      })
    ]
  }

  getHomePageSections(data: any, sections: HomeSection[]): HomeSection[] {
    let $ = this.cheerio.load(data)
    return sections.map(section => {
      switch (section.id) {
        case 'featured_titles':
          section.items = this.parseFeaturedMangaTiles($)
          break;
        case 'new_titles':
          section.items = this.parseNewMangaSectionTiles($)
          break;
        case 'recently_updated':
          section.items = this.parseRecentlyUpdatedMangaSectionTiles($)
          break;
      }

      return section
    })
  }

  parseFeaturedMangaTiles($: CheerioSelector): MangaTile[] {
    let featuredManga: MangaTile[] = []

    $("#hled_titles_owl_carousel .large_logo").each(function (i: any, elem: any) {
      let title = $(elem)

      let img = title.find("img").first()
      let links = title.find("a")

      let idStr: any = links.first().attr("href")
      let id = idStr!!.match(/(\d+)(?=\/)/) ?? "-1"

      let caption = title.find(".car-caption p:nth-child(2)")
      let bookmarks = caption.find("span[title=Follows]").text()
      let rating = caption.find("span[title=Rating]").text()

      featuredManga.push(createMangaTile({
        id: id[0],
        image: img.attr("data-src") ?? " ",
        title: createIconText({ text: img.attr("title") ?? " " }),
        primaryText: createIconText({ text: bookmarks, icon: 'bookmark.fill' }),
        secondaryText: createIconText({ text: rating, icon: 'star.fill' })
      }))
    })

    return featuredManga
  }

  parseNewMangaSectionTiles($: CheerioSelector): MangaTile[] {
    let newManga: MangaTile[] = []

    $("#new_titles_owl_carousel .large_logo").each(function (i: any, elem: any) {
      let title = $(elem)

      let img = title.find("img").first()
      let links = title.find("a")

      let idStr: any = links.first().attr("href")
      let id = idStr.match(/(\d+)(?=\/)/)

      let caption = title.find(".car-caption p:nth-child(2)")
      let obj: any = { name: caption.find("a").text(), group: "", time: Date.parse(caption.find("span").attr("title") ?? " "), langCode: "" }
      let updateTime: string = (Date.parse(caption.find("span").attr("title") ?? " ")).toString()
      newManga.push(createMangaTile({
        id: id[0],
        image: img.attr("data-src") ?? " ",
        title: createIconText({ text: img.attr("title") ?? " " }),
        subtitleText: createIconText({ text: caption.find("a").text() }),
        secondaryText: createIconText({ text: updateTime, icon: 'clock.fill' })
      }))
    })

    return newManga
  }

  parseRecentlyUpdatedMangaSectionTiles($: CheerioSelector): MangaTile[] {
    let updates: MangaTile[] = []
    let elem = $('tr', 'tbody').toArray()
    let i = 0

    while (i < elem.length) {
      let hasImg: boolean = false
      let idStr: string = $('a.manga_title', elem[i]).attr('href') ?? ''
      let id: string = (idStr.match(/(\d+)(?=\/)/) ?? '')[0] ?? ''
      let title: string = $('a.manga_title', elem[i]).text() ?? ''
      let image: string = $('img', elem[i]).attr('src') ?? ''

      // in this case: badge will be number of updates
      // that the manga has received within last week
      let badge = 0
      let pIcon = 'eye.fill'
      let sIcon = 'clock.fill'
      let subTitle = ''
      let pText = ''
      let sText = ''

      let first = true
      i++
      while (!hasImg && i < elem.length) {
        // for the manga tile, we only care about the first/latest entry
        if (first && !hasImg) {
          subTitle = $('a', elem[i]).first().text()
          pText = $('.text-center.text-info', elem[i]).text()
          sText = $('time', elem[i]).text().replace('ago', '').trim()
          first = false
        }
        badge++
        i++

        hasImg = $(elem[i]).find('img').length > 0
      }

      updates.push(createMangaTile({
        id,
        image,
        title: createIconText({ text: title }),
        subtitleText: createIconText({ text: subTitle }),
        primaryText: createIconText({ text: pText, icon: pIcon }),
        secondaryText: createIconText({ text: sText, icon: sIcon }),
        badge
      }))
    }

    return updates
  }

  searchRequest(query: SearchRequest, page: number): Request | null {
    return null
  }

  search(data: any): MangaTile[] | null {
    return null
  }
}