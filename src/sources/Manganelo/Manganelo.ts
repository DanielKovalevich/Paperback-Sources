
import { Source } from '../Source'
import { Manga } from '../../models/Manga/Manga'
import { Chapter } from '../../models/Chapter/Chapter'
import { MangaTile } from '../../models/MangaTile/MangaTile'
import { SearchRequest } from '../../models/SearchRequest/SearchRequest'
import { Request } from '../../models/RequestObject/RequestObject'
import { ChapterDetails } from '../../models/ChapterDetails/ChapterDetails'
import { TagSection } from '../../models/TagSection/TagSection'
import { HomeSectionRequest, HomeSection } from '../../models/HomeSection/HomeSection'

const MN_DOMAIN = 'https://manganelo.com'

export class Manganelo extends Source {
  constructor(cheerio: CheerioAPI) {
    super(cheerio)
  }

  get version(): string { return '1.0.2' }
  get name(): string { return 'Manganelo' }
  get icon(): string { return 'icon.png' }
  get author(): string { return 'Daniel Kovalevich' }
  get authorWebsite(): string { return 'https://github.com/DanielKovalevich' }
  get description(): string { return 'Extension that pulls manga from Manganelo, includes Advanced Search and Updated manga fetching' }

  getMangaDetailsRequest(ids: string[]): Request[] {
    let requests: Request[] = []
    for (let id of ids) {
      let metadata = { 'id': id }
      requests.push(createRequestObject({
        url: `${MN_DOMAIN}/manga/`,
        metadata: metadata,
        method: 'GET',
        param: id
      }))
    }
    return requests
  }

  getMangaDetails(data: any[], metadata: any[]): Manga[] {
    let manga: Manga[] = []
    for (let [i, response] of data.entries()) {
      let $ = this.cheerio.load(response)
      let panel = $('.panel-story-info')
      let title = $('.img-loading', panel).attr('title') ?? ''
      let image = $('.img-loading', panel).attr('src') ?? ''
      let table = $('.variations-tableInfo', panel)
      let author = ''
      let artist = ''
      let rating = 0
      let status = 0
      let titles = [title]
      let follows = 0
      let views = 0
      let lastUpdate = ''
      let hentai = false

      let tagSections: TagSection[] = [createTagSection({ id: '0', label: 'genres', tags: [] })]

      for (let row of $('tr', table).toArray()) {
        if ($(row).find('.info-alternative').length > 0) {
          let alts = $('h2', table).text().split(/,|;/)
          for (let alt of alts) {
            titles.push(alt.trim())
          }
        }
        else if ($(row).find('.info-author').length > 0) {
          let autart = $('.table-value', row).find('a').toArray()
          author = $(autart[0]).text()
          if (autart.length > 1) {
            artist = $(autart[1]).text()
          }
        }
        else if ($(row).find('.info-status').length > 0) {
          status = $('.table-value', row).text() == 'Ongoing' ? 1 : 0
        }
        else if ($(row).find('.info-genres').length > 0) {
          let elems = $('.table-value', row).find('a').toArray()
          for (let elem of elems) {
            let text = $(elem).text()
            let id = $(elem).attr('href')?.split('/').pop()?.split('-').pop() ?? ''
            if (text.toLowerCase().includes('smut')) {
              hentai = true
            }
            tagSections[0].tags.push(createTag({ id: id, label: text }))
          }
        }
      }

      table = $('.story-info-right-extent', panel)
      for (let row of $('p', table).toArray()) {
        if ($(row).find('.info-time').length > 0) {
          let time = new Date($('.stre-value', row).text().replace(/(-*(AM)*(PM)*)/g, ''))
          lastUpdate = time.toDateString()
        }
        else if ($(row).find('.info-view').length > 0) {
          views = Number($('.stre-value', row).text().replace(/,/g, ''))
        }
      }

      rating = Number($('[property=v\\:average]', table).text())
      follows = Number($('[property=v\\:votes]', table).text())
      let summary = $('.panel-story-info-description', panel).text()

      manga.push({
        id: metadata[i].id,
        titles: titles,
        image: image,
        rating: Number(rating),
        status: status,
        artist: artist,
        author: author,
        tags: tagSections,
        views: views,
        follows: follows,
        lastUpdate: lastUpdate,
        description: summary,
        hentai: hentai
      })
    }

    return manga
  }

  getChaptersRequest(mangaId: string): Request {
    let metadata = { 'id': mangaId }
    return createRequestObject({
      url: `${MN_DOMAIN}/manga/`,
      metadata: metadata,
      method: 'GET',
      param: mangaId
    })
  }

  getChapters(data: any, metadata: any): Chapter[] {
    let $ = this.cheerio.load(data)
    let allChapters = $('.row-content-chapter', '.body-site')
    let chapters: Chapter[] = []
    for (let chapter of $('li', allChapters).toArray()) {
      let id: string = $('a', chapter).attr('href')?.split('/').pop() ?? ''
      let name: string = $('a', chapter).text() ?? ''
      let chNum: number = Number((/Chapter (\d*)/g.exec(name) ?? [])[1] ?? '')
      let time: Date = new Date($('.chapter-time', chapter).attr('title') ?? '')
      chapters.push(createChapter({
        id: id,
        mangaId: metadata.id,
        name: name,
        langCode: 'en',
        chapNum: chNum,
        time: time
      }))
    }
    return chapters
  }

  getChapterDetailsRequest(mangaId: string, chId: string): Request {
    let metadata = { 'mangaId': mangaId, 'chapterId': chId, 'nextPage': false, 'page': 1 }
    return createRequestObject({
      url: `${MN_DOMAIN}/chapter/`,
      method: "GET",
      metadata: metadata,
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        Cookie: 'content_lazyload=off'
      },
      param: `${mangaId}/${chId}`
    })
  }

  getChapterDetails(data: any, metadata: any): { 'details': ChapterDetails, 'nextPage': boolean, 'param': string | null } {
    let $ = this.cheerio.load(data)
    let pages: string[] = []
    for (let item of $('img', '.container-chapter-reader').toArray()) {
      pages.push($(item).attr('src') ?? '')
    }

    let chapterDetails = createChapterDetails({
      id: metadata.chapterId,
      mangaId: metadata.mangaId,
      pages: pages,
      longStrip: false
    })
    let returnObject = {
      'details': chapterDetails,
      'nextPage': metadata.nextPage,
      'param': null
    }
    return returnObject
  }

  filterUpdatedMangaRequest(ids: any, time: Date, page: number): Request {
    let metadata = { 'ids': ids, 'referenceTime': time }
    return createRequestObject({
      url: `${MN_DOMAIN}/genre-all/`,
      method: 'GET',
      metadata: metadata,
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      param: `${page}`
    })
  }

  filterUpdatedManga(data: any, metadata: any): { 'updatedMangaIds': string[], 'nextPage': boolean } | null {
    let $ = this.cheerio.load(data)

    let returnObject: { 'updatedMangaIds': string[], 'nextPage': boolean } = {
      'updatedMangaIds': [],
      'nextPage': true
    }

    let panel = $('.panel-content-genres')
    for (let item of $('.content-genres-item', panel).toArray()) {
      let id = ($('a', item).first().attr('href') ?? '').split('/').pop() ?? ''
      let time = new Date($('.genres-item-time').first().text())
      // site has a quirk where if the manga what updated in the last hour
      // it will put the update time as tomorrow
      if (time > new Date(Date.now())) {
        time = new Date(Date.now() - 60000)
      }

      if (time > metadata.referenceTime) {
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

  getHomePageSectionRequest(): HomeSectionRequest[] | null {
    let request = createRequestObject({ url: `${MN_DOMAIN}`, method: 'GET', })
    let section1 = createHomeSection({ id: 'top_week', title: 'TOP OF THE WEEK' })
    let section2 = createHomeSection({ id: 'latest_updates', title: 'LATEST UPDATES' })
    let section3 = createHomeSection({ id: 'new_manga', title: 'NEW MANGA' })
    return [createHomeSectionRequest({ request: request, sections: [section1, section2, section3] })]
  }

  getHomePageSections(data: any, sections: HomeSection[]): HomeSection[] | null {
    let $ = cheerio.load(data)
    let topManga: MangaTile[] = []
    let updateManga: MangaTile[] = []
    let newManga: MangaTile[] = []

    for (let item of $('.item', '.owl-carousel').toArray()) {
      let id = $('a', item).first().attr('href')?.split('/').pop() ?? ''
      let image = $('img', item).attr('src') ?? ''
      topManga.push(createMangaTile({
        id: id,
        image: image,
        title: createIconText({ text: $('a', item).first().text() }),
        subtitleText: createIconText({ text: $('[rel=nofollow]', item).text() })
      }))
    }

    for (let item of $('.content-homepage-item', '.panel-content-homepage').toArray()) {
      let id = $('a', item).first().attr('href')?.split('/').pop() ?? ''
      let image = $('img', item).attr('src') ?? ''
      let itemRight = $('.content-homepage-item-right', item)
      let latestUpdate = $('.item-chapter', itemRight).first()
      updateManga.push(createMangaTile({
        id: id,
        image: image,
        title: createIconText({ text: $('a', itemRight).first().text() }),
        subtitleText: createIconText({ text: $('.item-author', itemRight).text() }),
        primaryText: createIconText({ text: $('.genres-item-rate', item).text(), icon: 'star.fill' }),
        secondaryText: createIconText({ text: $('i', latestUpdate).text(), icon: 'clock.fill' })
      }))
    }

    for (let item of $('a', '.panel-newest-content').toArray()) {
      let id = $(item).attr('href')?.split('/').pop() ?? ''
      let image = $('img', item).attr('src') ?? ''
      let title = $('img', item).attr('alt') ?? ''
      newManga.push(createMangaTile({
        id: id,
        image: image,
        title: createIconText({ text: title })
      }))
    }

    sections[0].items = topManga
    sections[1].items = updateManga
    sections[2].items = newManga
    return sections
  }

  searchRequest(query: SearchRequest, page: number): Request {
    let genres = (query.includeGenre ?? []).concat(query.includeDemographic ?? []).join('_')
    let excluded = (query.excludeGenre ?? []).concat(query.excludeDemographic ?? []).join('_')
    let status = ""
    switch (query.status) {
      case 0: status = 'completed'; break
      case 1: status = 'ongoing'; break
      default: status = ''
    }

    let keyword = (query.title ?? '').replace(' ', '_')
    if (query.author)
      keyword += (query.author ?? '').replace(' ', '_')
    let search: string = `s=all&keyw=${keyword}`
    search += `&g_i=${genres}&g_e=${excluded}&page=${page}`
    if (status) {
      search += `&sts=${status}`
    }

    let metadata = { 'search': search }
    return createRequestObject({
      url: `${MN_DOMAIN}/advanced_search?`,
      method: 'GET',
      metadata: metadata,
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      param: `${search}`
    })
  }

  search(data: any): MangaTile[] | null {
    let $ = this.cheerio.load(data)
    let panel = $('.panel-content-genres')
    let manga: MangaTile[] = []
    for (let item of $('.content-genres-item', panel).toArray()) {
      let id = $('.genres-item-name', item).attr('href')?.split('/').pop() ?? ''
      let title = $('.genres-item-name', item).text()
      let subTitle = $('.genres-item-chap', item).text()
      let image = $('.img-loading', item).attr('src') ?? ''
      let rating = $('.genres-item-rate', item).text()
      let updated = $('.genres-item-time', item).text()

      manga.push(createMangaTile({
        id: id,
        image: image,
        title: createIconText({ text: title }),
        subtitleText: createIconText({ text: subTitle }),
        primaryText: createIconText({ text: rating, icon: 'star.fill' }),
        secondaryText: createIconText({ text: updated, icon: 'clock.fill' })
      }))
    }

    return manga
  }

  getTagsRequest(): Request | null {
    return createRequestObject({
      url: `${MN_DOMAIN}/advanced_search?`,
      method: 'GET',
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      }
    })
  }

  getTags(data: any): TagSection[] | null {
    let $ = this.cheerio.load(data)
    let panel = $('.advanced-search-tool-genres-list')
    let genres = createTagSection({
      id: 'genre',
      label: 'Genre',
      tags: []
    })
    for (let item of $('span', panel).toArray()) {
      let id = $(item).attr('data-i') ?? ''
      let label = $(item).text()
      genres.tags.push(createTag({ id: id, label: label }))
    }
    return [genres]
  }

  getViewMoreRequest(key: string, page: number): Request | null {
    let param = ''
    switch (key) {
      case 'latest_updates': {
        param = `/genre-all/${page}`
        break
      }
      case 'new_manga': {
        param = `/genre-all/${page}?type=newest`
        break
      }
      default: return null
    }

    return createRequestObject({
      url: `${MN_DOMAIN}`,
      method: 'GET',
      param: param
    })
  }

  getViewMoreItems(data: any, key: string): MangaTile[] | null {
    let $ = this.cheerio.load(data)
    let manga: MangaTile[] = []
    if (key == 'latest_updates' || key == 'new_manga') {
      let panel = $('.panel-content-genres')
      for (let item of $('.content-genres-item', panel).toArray()) {
        let id = ($('a', item).first().attr('href') ?? '').split('/').pop() ?? ''
        let image = $('img', item).attr('src') ?? ''
        let title = $('.genres-item-name', item).text()
        let subtitle = $('.genres-item-chap', item).text()
        let time = new Date($('.genres-item-time').first().text())
        if (time > new Date(Date.now())) {
          time = new Date(Date.now() - 60000)
        }
        let rating = $('.genres-item-rate', item).text()
        manga.push(createMangaTile({
          id: id,
          image: image,
          title: createIconText({ text: title }),
          subtitleText: createIconText({ text: subtitle }),
          primaryText: createIconText({ text: rating, icon: 'star.fill' }),
          secondaryText: createIconText({ text: time.toDateString(), icon: 'clock.fill' })
        }))
      }
    }
    else return null
    return manga
  }
}