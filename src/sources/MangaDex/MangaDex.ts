import { Source } from '../Source'
import { Manga } from '../../models/Manga/Manga'
import { Chapter } from '../../models/Chapter/Chapter'
import { MangaTile } from '../../models/MangaTile/MangaTile'
import { SearchRequest } from '../../models/SearchRequest/SearchRequest'
import { Request } from '../../models/RequestObject/RequestObject'
import { ChapterDetails } from '../../models/ChapterDetails/ChapterDetails'

import { HomeSectionRequest, HomeSection } from '../../models/HomeSection/HomeSection'
import { LanguageCode } from '../../models/Languages/Languages'

export class MangaDex extends Source {

  constructor(cheerio: CheerioAPI) {
    super(cheerio)
  }

  get version(): string { return '1.0.13' }
  get name(): string { return 'MangaDex' }
  get icon(): string { return 'icon.png' }
  get author(): string { return 'Faizan Durrani' }
  get authorWebsite(): string { return 'https://github.com/FaizanDurrani' }
  get description(): string { return 'Extension that pulls manga from MangaDex, includes Advanced Search and Updated manga fetching' }
  get hentaiSource(): boolean { return false }

  getMangaDetailsRequest(ids: string[]): Request[] {
    return [createRequestObject({
      metadata: { ids },
      url: CACHE_MANGA,
      method: 'POST',
      headers: {
        "content-type": "application/json"
      },
      data: JSON.stringify({
        id: ids.map(x => parseInt(x))
      })
    })]
  }
  getMangaDetails(data: any, metadata: any): Manga[] {
    let result = JSON.parse(data)

    let mangas = []
    for (let mangaDetails of result["result"]) {
      mangas.push(createManga({
        id: mangaDetails["id"].toString(),
        titles: mangaDetails["titles"],
        image: mangaDetails["image"],
        rating: mangaDetails["rating"],
        status: mangaDetails["status"],
        langFlag: mangaDetails["langFlag"],
        langName: mangaDetails["langName"],
        artist: mangaDetails["artist"],
        author: mangaDetails["author"],
        avgRating: mangaDetails["avgRating"],
        covers: mangaDetails["covers"],
        desc: mangaDetails["description"],
        follows: mangaDetails["follows"],
        tags: [
          createTagSection({
            id: "content",
            label: "Content",
            tags: mangaDetails["content"].map((x: any) => createTag({ id: x["id"].toString(), label: x["value"] }))
          }),
          createTagSection({
            id: "demographic",
            label: "Demographic",
            tags: mangaDetails["demographic"].map((x: any) => createTag({ id: x["id"].toString(), label: x["value"] }))
          }),
          createTagSection({
            id: "format",
            label: "Format",
            tags: mangaDetails["format"].map((x: any) => createTag({ id: x["id"].toString(), label: x["value"] }))
          }),
          createTagSection({
            id: "genre",
            label: "Genre",
            tags: mangaDetails["genre"].map((x: any) => createTag({ id: x["id"].toString(), label: x["value"] }))
          }),
          createTagSection({
            id: "theme",
            label: "Theme",
            tags: mangaDetails["theme"].map((x: any) => createTag({ id: x["id"].toString(), label: x["value"] }))
          })
        ],
        users: mangaDetails["users"],
        views: mangaDetails["views"],
        hentai: mangaDetails["hentai"],
        relatedIds: mangaDetails["relatedIds"],
        lastUpdate: mangaDetails["lastUpdate"]
      }))
    }

    return mangas
  }

  getChaptersRequest(mangaId: string): Request {
    let metadata = { mangaId }
    return createRequestObject({
      metadata,
      url: `${MD_MANGA_API}/${mangaId}`,
      method: "GET"
    })
  }

  getChapters(data: any, metadata: any): Chapter[] {
    let chapters = JSON.parse(data).chapter as any

    console.log(data)

    return Object.keys(chapters).map(id => {
      const chapter = chapters[id]
      const volume = Number(chapter.volume)
      return createChapter({
        id: id,
        chapNum: Number(chapter.chapter),
        langCode: chapter.lang_code,
        volume: Number.isNaN(volume) ? 0 : volume,
        mangaId: metadata.mangaId,
        group: chapter.group_name,
        name: chapter.title,
        time: new Date(Number(chapter.timestamp) * 1000)
      })
    })
  }

  getChapterDetailsRequest(mangaId: string, chapId: string): Request {
    return createRequestObject({
      url: `${MD_CHAPTER_API}/${chapId}`,
      method: 'GET',
      incognito: true
    })
  }

  getChapterDetails(data: any, metadata: any): ChapterDetails {
    let chapterDetails = JSON.parse(data) as any

    return createChapterDetails({
      id: chapterDetails['id'].toString(),
      longStrip: parseInt(chapterDetails['long_strip']) == 1,
      mangaId: chapterDetails['manga_id'].toString(),
      pages: chapterDetails['page_array'].map((x: string) => `${chapterDetails['server']}${chapterDetails['hash']}/${x}`)
    })
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
    console.log(JSON.stringify(this))
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
    console.log(JSON.stringify(this))

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
        image: img.attr("data-src") ?? "",
        title: createIconText({ text: img.attr("title") ?? "" }),
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
      let updateTime: string = caption.find("span").text()
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
      let image: string = (MD_DOMAIN + $('img', elem[i]).attr('src')) ?? ''

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
    return createRequestObject({
      url: CACHE_SEARCH,
      method: "POST",
      data: JSON.stringify({
        title: query.title
      }),
      headers: {
        "content-type": "application/json"
      }
    })
  }

  search(data: any, metadata: any): MangaTile[] | null {
    let mangas = this.getMangaDetails(data, {})
    return mangas.map(manga => createMangaTile({
      id: manga.id,
      image: manga.image,
      title: createIconText({
        text: manga.titles[0] ?? "UNKNOWN"
      })
    }))
  }

  getMangaShareUrl(mangaId: string) {
    return `${MD_DOMAIN}/manga/${mangaId}`
  }
}