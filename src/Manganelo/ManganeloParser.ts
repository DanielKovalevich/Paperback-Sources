import { Chapter, ChapterDetails, HomeSection, LanguageCode, Manga, MangaStatus, MangaTile, MangaUpdates, PagedResults, SearchRequest, TagSection } from "paperback-extensions-common";

export const parseMangaDetails = ($: CheerioStatic, mangaId: string): Manga => {
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
        const elems = $('.table-value', row).find('a').toArray()
        for (const elem of elems) {
          const text = $(elem).text()
          const id = $(elem).attr('href')?.split('/').pop()?.split('-').pop() ?? ''
          if (text.toLowerCase().includes('smut')) {
            hentai = true
          }
          tagSections[0].tags.push(createTag({ id: id, label: text }))
        }
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
      hentai
    })
}

export const parseChapters = ($: CheerioStatic, mangaId: string): Chapter[] => {
    const allChapters = $('.row-content-chapter', '.body-site')
    const chapters: Chapter[] = []
    for (let chapter of $('li', allChapters).toArray()) {
        const id: string = $('a', chapter).attr('href')?.split('/').pop() ?? ''
        const name: string = $('a', chapter).text() ?? ''
        const chapNum: number = Number(/Chapter ([0-9]\d*(\.\d+)?)/g.exec(name)?.[1] ?? '')
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

export const parseChapterDetails = ($: CheerioStatic, mangaId: string, chapterId: string): ChapterDetails => {
    const pages: string[] = []
    for (let item of $('img', '.container-chapter-reader').toArray()) {
      pages.push($(item).attr('src') ?? '')
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

export const parseUpdatedManga = ($: CheerioStatic, time: Date, ids: string[]): UpdatedManga => {
    const foundIds: string[] = []
    let passedReferenceTime = false
    const panel = $('.panel-content-genres')
    for (const item of $('.content-genres-item', panel).toArray()) {
        const id = ($('a', item).first().attr('href') ?? '').split('/').pop() ?? ''
        let mangaTime = new Date($('.genres-item-time').first().text())
        // site has a quirk where if the manga what updated in the last hour
        // it will put the update time as tomorrow
        if (mangaTime > new Date(Date.now())) {
            mangaTime = new Date(Date.now() - 60000)
        }

        passedReferenceTime = mangaTime <= time
        if (!passedReferenceTime) {
            if (ids.includes(id)) {
                foundIds.push(id)
            }
        }
        else break
    }

    return {
        ids: foundIds,
        loadMore: !passedReferenceTime
    }
}

export const parseHomeSections = ($: CheerioStatic, sections: HomeSection[], sectionCallback: (section: HomeSection) => void): void => {
    for (const section of sections) sectionCallback(section)
    const topManga: MangaTile[] = []
    const updateManga: MangaTile[] = []
    const newManga: MangaTile[] = []

    for (const item of $('.item', '.owl-carousel').toArray()) {
      const id = $('a', item).first().attr('href')?.split('/').pop() ?? ''
      const image = $('img', item).attr('src') ?? ''
      topManga.push(createMangaTile({
        id,
        image,
        title: createIconText({ text: $('a', item).first().text() }),
        subtitleText: createIconText({ text: $('[rel=nofollow]', item).text() })
      }))
    }

    for (const item of $('.content-homepage-item', '.panel-content-homepage').toArray()) {
      const id = $('a', item).first().attr('href')?.split('/').pop() ?? ''
      const image = $('img', item).attr('src') ?? ''
      const itemRight = $('.content-homepage-item-right', item)
      const latestUpdate = $('.item-chapter', itemRight).first()
      updateManga.push(createMangaTile({
        id,
        image,
        title: createIconText({ text: $('a', itemRight).first().text() }),
        subtitleText: createIconText({ text: $('.item-author', itemRight).text() }),
        primaryText: createIconText({ text: $('.genres-item-rate', item).text(), icon: 'star.fill' }),
        secondaryText: createIconText({ text: $('i', latestUpdate).text(), icon: 'clock.fill' })
      }))
    }

    for (const item of $('a', '.panel-newest-content').toArray()) {
      const id = $(item).attr('href')?.split('/').pop() ?? ''
      const image = $('img', item).attr('src') ?? ''
      const title = $('img', item).attr('alt') ?? ''
      newManga.push(createMangaTile({
        id,
        image,
        title: createIconText({ text: title })
      }))
    }

    sections[0].items = topManga
    sections[1].items = updateManga
    sections[2].items = newManga

    // Perform the callbacks again now that the home page sections are filled with data
    for (const section of sections) sectionCallback(section)
}

export const generateSearch = (query: SearchRequest): string => {
    // Format the search query into a proper request
    const genres = (query.includeGenre ?? []).concat(query.includeDemographic ?? []).join('_')
    const excluded = (query.excludeGenre ?? []).concat(query.excludeDemographic ?? []).join('_')
    let status = ""
    switch (query.status) {
      case 0: status = 'completed'; break
      case 1: status = 'ongoing'; break
      default: status = ''
    }

    let keyword = (query.title ?? '').replace(/ /g, '_')
    if (query.author)
      keyword += (query.author ?? '').replace(/ /g, '_')
    let search: string = `s=all&keyw=${keyword}`
    search += `&g_i=${genres}&g_e=${excluded}`
    if (status) {
      search += `&sts=${status}`
    }

    return search
}

export const parseSearch = ($: CheerioStatic): MangaTile[] => {
    const panel = $('.panel-content-genres')
    const items = $('.content-genres-item', panel).toArray();
    const manga: MangaTile[] = []
    for (const item of items) {
      const id = $('.genres-item-name', item).attr('href')?.split('/').pop() ?? ''
      const title = $('.genres-item-name', item).text()
      const subTitle = $('.genres-item-chap', item).text()
      const image = $('.img-loading', item).attr('src') ?? ''
      const rating = $('.genres-item-rate', item).text()
      const updated = $('.genres-item-time', item).text()

      manga.push(createMangaTile({
        id,
        image,
        title: createIconText({ text: title }),
        subtitleText: createIconText({ text: subTitle }),
        primaryText: createIconText({ text: rating, icon: 'star.fill' }),
        secondaryText: createIconText({ text: updated, icon: 'clock.fill' })
      }))
    }
    return manga
}

export const parseTags = ($: CheerioStatic): TagSection[] | null => {
    const panel = $('.advanced-search-tool-genres-list')
    const genres = createTagSection({
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

export const parseViewMore = ($: CheerioStatic): MangaTile[] => {
    const manga: MangaTile[] = []
    const panel = $('.panel-content-genres')
    for (const item of $('.content-genres-item', panel).toArray()) {
        const id = ($('a', item).first().attr('href') ?? '').split('/').pop() ?? ''
        const image = $('img', item).attr('src') ?? ''
        const title = $('.genres-item-name', item).text()
        const subtitle = $('.genres-item-chap', item).text()
        let time = new Date($('.genres-item-time').first().text())
        if (time > new Date(Date.now())) {
            time = new Date(Date.now() - 60000)
        }
        const rating = $('.genres-item-rate', item).text()
        manga.push(createMangaTile({
            id,
            image,
            title: createIconText({ text: title }),
            subtitleText: createIconText({ text: subtitle }),
            primaryText: createIconText({ text: rating, icon: 'star.fill' }),
            secondaryText: createIconText({ text: time.toDateString(), icon: 'clock.fill' })
        }))
    }
    return manga
}

export const isLastPage = ($: CheerioStatic): boolean => {
    let current = $('.page-select').text()
    let total = $('.page-last').text()

    if (current) {
        total = (/(\d+)/g.exec(total) ?? [''])[0]
        return (+total) === (+current)
    }

    return true
}