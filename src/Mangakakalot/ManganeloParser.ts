import {
  Chapter, 
  ChapterDetails, 
  LanguageCode, 
  Manga, 
  MangaStatus, 
  TagSection
} from "paperback-extensions-common";

export const parseManganeloMangaDetails = ($: CheerioStatic, mangaId: string): Manga => {
  const panel = $('.panel-story-info')
  const title = $('.img-loading', panel).attr('title') ?? ''
  const image = $('.img-loading', panel).attr('src') ?? ''
  let table = $('.variations-tableInfo', panel)
  let author = ''
  let artist = ''
  let rating = 0
  let status = MangaStatus.ONGOING
  let titles = [title]
  let follows = 0
  let views = 0
  let lastUpdate = ''
  let hentai = false

  const tagSections: TagSection[] = [createTagSection({ id: '0', label: 'genres', tags: [] })]

  for (const row of $('tr', table).toArray()) {
    if ($(row).find('.info-alternative').length > 0) {
      const alts = $('h2', table).text().split(/,|;/)
      for (const alt of alts) {
        titles.push(alt.trim())
      }
    }
    else if ($(row).find('.info-author').length > 0) {
      const autart = $('.table-value', row).find('a').toArray()
      author = $(autart[0]).text()
      if (autart.length > 1) {
        artist = $(autart[1]).text()
      }
    }
    else if ($(row).find('.info-status').length > 0) {
      status = $('.table-value', row).text() == 'Ongoing' ? MangaStatus.ONGOING : MangaStatus.COMPLETED
    }
    else if ($(row).find('.info-genres').length > 0) {
      let elems = $('.table-value', row).find('a').toArray()
      let genres: string[] = []
      for (let elem of elems) {
        let text = $(elem).text()
        if (text.toLowerCase().includes('smut')) {
          hentai = true
        }
        genres.push(text)
      }
      tagSections[0].tags = genres.map((elem: string) => createTag({ id: elem, label: elem }))
    }
  }

  table = $('.story-info-right-extent', panel)
  for (const row of $('p', table).toArray()) {
    if ($(row).find('.info-time').length > 0) {
      const time = new Date($('.stre-value', row).text().replace(/(-*(AM)*(PM)*)/g, ''))
      lastUpdate = time.toDateString()
    }
    else if ($(row).find('.info-view').length > 0) {
      views = Number($('.stre-value', row).text().replace(/,/g, ''))
    }
  }

  rating = Number($('[property=v\\:average]', table).text())
  follows = Number($('[property=v\\:votes]', table).text())
  const summary = $('.panel-story-info-description', panel).text()

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
    //hentai
    hentai: false
  })
}

export const parseManganeloChapters = ($: CheerioStatic, mangaId: string): Chapter[] => {
  const allChapters = $('.row-content-chapter', '.body-site')
  const chapters: Chapter[] = []
  for (let chapter of $('li', allChapters).toArray()) {
    const id: string = $('a', chapter).attr('href') ?? ''
    const name: string = $('a', chapter).text() ?? ''
    const chapNum: number = Number((/Chapter (\d*)/g.exec(name) ?? [])[1] ?? '')
    const time: Date = new Date($('.chapter-time', chapter).attr('title') ?? '')
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

export const parseManganeloChapterDetails = ($: CheerioStatic, mangaId: string, chapterId: string): ChapterDetails => {
  const pages : string[] = Array.from($('img', '.container-chapter-reader').toArray(), x=>$(x).attr('src') ?? '' )
  
  return createChapterDetails({
    id: chapterId,
    mangaId: mangaId,
    pages,
    longStrip: false
  })
}