import { Chapter, ChapterDetails, HomeSection, LanguageCode, Manga, MangaStatus, MangaTile, MangaUpdates, PagedResults, SearchRequest, TagSection } from "paperback-extensions-common";
import { parseJsonText } from "typescript";

export const parseMangakakalotMangaDetails = ($: CheerioStatic, mangaId: string): Manga => {
  const panel = $('.manga-info-top')
  const title = $('h1', panel).first().text() ?? ''
  const image = $('.manga-info-pic', panel).children().first().attr('src') ?? ''
  const table = $('.manga-info-text', panel)
  let author = ''
  let artist = ''
  let autart = $('.manga-info-text li:nth-child(2)').text().replace('Author(s) :', '').replace(/\r?\n|\r/g, '').split(', ')
  autart[autart.length-1] = autart[autart.length-1]?.replace(', ', '')
  author = autart[0]
  if (autart.length > 1 && $(autart[1]).text() != ' ') {
    artist = autart[1]
  }

  const rating = Number($('#rate_row_cmd', table).text().replace('Mangakakalot.com rate : ', '').slice($('#rate_row_cmd', table).text().indexOf('Mangakakalot.com rate : '), $('#rate_row_cmd', table).text().indexOf(' / 5')) )
  const status = $('.manga-info-text li:nth-child(3)').text().split(' ').pop() == 'Ongoing' ? MangaStatus.ONGOING : MangaStatus.COMPLETED
  let titles = [title]
  const follows = Number($('#rate_row_cmd', table).text().replace(' votes', '').split(' ').pop() )
  const views = Number($('.manga-info-text li:nth-child(6)').text().replace(/,/g, '').replace('View : ', '') )
  let hentai = false

  const tagSections: TagSection[] = [createTagSection({ id: '0', label: 'genres', tags: [] })]

  // Genres
  let elems = $('.manga-info-text li:nth-child(7)').find('a').toArray()
  let genres: string[] = []
  genres = Array.from(elems, x=>$(x).text() )
  tagSections[0].tags = genres.map((elem: string) => createTag({ id: elem, label: elem }))
  hentai = (genres.includes('Adult') || genres.includes('Smut') ) ? true : false;

  // Alt Titles
  for (let row of $('li', table).toArray()) {
    if ($(row).find('.story-alternative').length > 0) {
      let alts = $('h2', table).text().replace('Alternative : ','').split(/,|;/)
      for (let alt of alts) {
          titles.push(alt.trim())
      }
    }
  }

  // Date
  const time = new Date($('.manga-info-text li:nth-child(4)').text().replace(/((AM)*(PM)*)/g, '').replace('Last updated : ', ''))
  const lastUpdate = time.toDateString()

  // Exclude child text: https://www.viralpatel.net/jquery-get-text-element-without-child-element/
  // Remove line breaks from start and end: https://stackoverflow.com/questions/14572413/remove-line-breaks-from-start-and-end-of-string
  const summary = $('#noidungm', $('.leftCol'))
                  .clone()    //clone the element
                  .children() //select all the children
                  .remove()   //remove all the children
                  .end()  //again go back to selected element
                  .text().replace(/^\s+|\s+$/g, '')

  return createManga({
    id: mangaId,
    titles,
    image,
    rating: Number(rating),
    status,
    artist,
    author,
    tags: tagSections,
    views,
    follows,
    lastUpdate,
    desc: summary,
    hentai
  })
}

export const parseMangakakalotChapters = ($: CheerioStatic, mangaId: string): Chapter[] => {
  const allChapters = $('.chapter-list', '.leftCol')
  const chapters: Chapter[] = []
  
  for (let chapter of $('.row', allChapters).toArray()) {
    const id: string = $('a', chapter).attr('href') ?? ''
    const name: string = $('a', chapter).text() ?? ''
    const chapNum: number = Number( id.split('_').pop() )
    const time: Date = new Date($('span:nth-child(3)', chapter).attr('title') ?? '')
    chapters.push(createChapter({
      id,
      mangaId,
      name,
      langCode: LanguageCode.ENGLISH,
      chapNum,
      time
    }))
  }
  return chapters
}

export const parseMangakakalotChapterDetails = ($: CheerioStatic, mangaId: string, chapterId: string): ChapterDetails => {
  const pages: string[] = []
  const allItems = $('img', '.container-chapter-reader').toArray()
  for(let item of allItems)
  {
    let page = $(item).attr('src')
    // If page is undefined, dont push it
    if (typeof page === 'undefined')
      continue;

    pages.push(page);
  }

  return createChapterDetails({
    id: chapterId,
    mangaId: mangaId,
    pages,
    longStrip: false
  })
}

export interface UpdatedManga {
  ids: string[];
  loadMore: boolean;
}

// Removed: Mangakakalot does not show the updated date on their latest updates page
// export const parseUpdatedManga = ($: CheerioStatic, time: Date, ids: string[]): UpdatedManga => {

// }

export const parseHomeSections = ($: CheerioStatic, sections: HomeSection[], sectionCallback: (section: HomeSection) => void): void => {
  for (const section of sections) sectionCallback(section)
  const popularManga: MangaTile[] = []
  const latestManga: MangaTile[] = []

  // Popular manga
  for (const item of $('.item', '.owl-carousel').toArray()) {
    let url = $('a', item).first().attr('href')
    let image = $('img', item).attr('src')
    let title = $('div.slide-caption', item).children().first().text()
    let subtitle = $('div.slide-caption', item).children().last().text()

    // Credit to @GameFuzzy
    // Checks for when no id or image found
    if (typeof url === 'undefined' || typeof image === 'undefined') 
      continue

    popularManga.push(createMangaTile({
      id: url,
      image: image,
      title: createIconText({ text: title }),
      subtitleText: createIconText({ text: subtitle })
    }))
  }

  // Latest updates
  for (const item of $('.first', '.doreamon').toArray()) {
    let url = $('a', item).first().attr('href')
    let image = $('img', item).attr('src')
    //console.log(image)

    // Credit to @GameFuzzy
    // Checks for when no id or image found
    if (typeof url === 'undefined' || typeof image === 'undefined') 
      continue

    latestManga.push(createMangaTile({
      id: url,
      image: image,
      title: createIconText({ text: $('h3', item).text() }),
      subtitleText: createIconText({ text: $('.sts_1', item).first().text() }),
    }))
  }

  sections[0].items = popularManga
  sections[1].items = latestManga

  // Perform the callbacks again now that the home page sections are filled with data
  for (const section of sections) sectionCallback(section)
}

export const parseMangaSectionTiles = ($: CheerioStatic, sections: HomeSection[], sectionCallback: (section: HomeSection) => void): void => {
  for (const section of sections) sectionCallback(section)

  sections[0].items = parseTiles($)

  // Perform the callbacks again now that the home page sections are filled with data
  for (const section of sections) sectionCallback(section)
}

const parseTiles = ($: CheerioStatic): MangaTile[] => {
  const manga: MangaTile[] = []

  let panel = $('.truyen-list')
  for (const item of $('.list-truyen-item-wrap', panel).toArray()) {
    let id = $('a', item).first().attr('href')
    let image = $('img', item).first().attr('src')
    //console.log(image)
    let title = $('a', item).first().attr('title') ?? ''
    let subtitle = $('.list-story-item-wrap-chapter', item).attr('title') ?? ''

    // Credit to @GameFuzzy
    // Checks for when no id or image found
    if (typeof id === 'undefined' || typeof image === 'undefined') 
      continue

    manga.push(createMangaTile({
      id: id,
      image: image,
      title: createIconText({ text: title }),
      subtitleText: createIconText({ text: subtitle })
    }))
  }

  return manga
}

export const generateSearch = (query: SearchRequest): string => {
  let keyword = (query.title ?? '').replace(/ /g, '_')
  if (query.author)
    keyword += (query.author ?? '').replace(/ /g, '_')
  let search: string = `${keyword}`

  return search
}

export const parseSearch = ($: CheerioStatic): MangaTile[] => {
  const manga: MangaTile[] = []

  const panel = $('.panel_story_list')
  const items = $('.story_item', panel).toArray();
  for (const item of items) {
    const id = $('a', item).first().attr('href') ?? ''
    const title = $('.story_name', item).children().first().text()
    const subTitle = $('.story_chapter', item).first().text().trim()
    const image = $('img',item).attr('src') ?? ''
    // let rating = '0'
    const time = new Date($('.story_item_right span:nth-child(5)', item).text().replace(/((AM)*(PM)*)/g, '').replace('Updated : ', ''))
    const updated = time.toDateString()

    manga.push(createMangaTile({
      id,
      image,
      title: createIconText({ text: title }),
      subtitleText: createIconText({ text: subTitle }),
      // primaryText: createIconText({ text: rating, icon: 'star.fill' }),
      secondaryText: createIconText({ text: updated, icon: 'clock.fill' })
    }))
  }

  return manga
}

export const parseTags = ($: CheerioStatic): TagSection[] | null => {
  const panel = $('.panel-category')
  const items = panel.find('a').clone().remove('.ctg-select').toArray()
  const genres = createTagSection({
    id: 'genre',
    label: 'Genre',
    tags: []
  })
  for (let item of items) {
    let label = $(item).text()
    genres.tags.push(createTag({ id: label, label: label }))
  }
  return [genres]
}

export const parseViewMore = ($: CheerioStatic): MangaTile[] => {
  return parseTiles($)
}

export const isLastPage = ($: CheerioStatic): boolean => {
  let current = $('.page_select').text();
  let total = $('.page_last').text();

  if (current) {
    total = (/(\d+)/g.exec(total) ?? [''])[0]
    return (+total) === (+current)
  }

  return true
}