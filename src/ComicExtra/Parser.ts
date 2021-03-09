import {Chapter, LanguageCode, Manga, MangaStatus, MangaTile, Tag, TagSection} from 'paperback-extensions-common'

const COMICEXTRA_DOMAIN = 'https://www.comicextra.com'

export class Parser {

    
    parseMangaDetails($: CheerioSelector, mangaId: string): Manga {
    

    let titles = [$('.title-1', $('.mobile-hide')).text().trimLeft()]
    let image = $('img', $('.movie-l-img')).attr('src')

    let summary = $('#film-content', $('#film-content-wrapper')).text().trim()
    let relatedIds: string[] = []
    for(let obj of $('.list-top-item').toArray()) {
        relatedIds.push($('a', $(obj)).attr('href')?.replace(`${COMICEXTRA_DOMAIN}/comic/`, '').trim() || '')
    }

    let status = MangaStatus.ONGOING, author, released, rating: number = 0
    let tagArray0 : Tag[] = []
    let i = 0
    for (let item of $('.movie-dd', $('.movie-dl')).toArray()) {
      switch (i) {
        case 0: {
          // Comic Status
          if ($('a', $(item)).text().toLowerCase().includes("ongoing")) {
            status = MangaStatus.ONGOING
          }
          else {
            status = MangaStatus.COMPLETED
          }
          i++
          continue
        }
        case 1: {
          // Alt Titles
           if($(item).text().toLowerCase().trim() == "-") {
            i++
            continue
           }
           titles.push($(item).text().trim())
          i++
          continue
        }
        case 2: {
          // Date of release
          released = ($(item).text().trim()) ?? undefined
          i++
          continue
        }
        case 3: {
          // Author
          author = ($(item).text().trim()) ?? undefined
          i++
          continue
          }
        case 4: {
          // Genres
          for(let obj of $('a',$(item)).toArray()){
            let id = $(obj).attr('href')?.replace(`${COMICEXTRA_DOMAIN}/`, '').trim()
            let label = $(obj).text().trim()
            if (typeof id === 'undefined' || typeof label === 'undefined') continue
            tagArray0 = [...tagArray0, createTag({id: id, label: label})]
          }    
          i++
          continue
        }
      }
      i = 0
    }
    let tagSections: TagSection[] = [createTagSection({ id: '0', label: 'genres', tags: tagArray0 })]
      return createManga({
        id: mangaId,
        rating: rating,
        titles: titles,
        image: image ?? '',
        status: status,
        author: this.decodeHTMLEntity(author ?? ''),
        tags: tagSections,
        desc: this.decodeHTMLEntity(summary ?? ''),
        lastUpdate: released,
        relatedIds: relatedIds
      })
    }


    parseChapterList($: CheerioSelector, mangaId: string) : Chapter[] { 
    
    let chapters: Chapter[] = []

      for(let obj of $('tr', $('#list')).toArray()) {
        let chapterId = $('a', $(obj)).attr('href')?.replace(`${COMICEXTRA_DOMAIN}/${mangaId}/`, '')
        let chapNum = chapterId?.replace(`chapter-`, '').trim()
        if(isNaN(Number(chapNum))){
          chapNum = `0.${chapNum?.replace( /^\D+/g, '')}`
            if(isNaN(Number(chapNum))){
                chapNum = '0'
            }
        }
        let chapName = $('a', $(obj)).text()
        let time = $($('td', $(obj)).toArray()[1]).text()
        if (typeof chapterId === 'undefined') continue
        chapters.push(createChapter({
            id: chapterId,
            mangaId: mangaId,
            chapNum: Number(chapNum),
            langCode: LanguageCode.ENGLISH,
            name: this.decodeHTMLEntity(chapName),
            time: new Date(time)
        }))
    }
    return chapters
}


    sortChapters(chapters: Chapter[]) : Chapter[] {
        let sortedChapters: Chapter[] = []
        chapters.forEach((c) => {
            if (sortedChapters[sortedChapters.indexOf(c)]?.id !== c?.id) {
              sortedChapters.push(c)
            }
          })
          sortedChapters.sort((a, b) => (a.id > b.id) ? 1 : -1)
          return sortedChapters
    }


    parseChapterDetails($: CheerioSelector) : string[] {
        let pages: string[] = []
        // Get all of the pages
        for(let obj of $('img',$('.chapter-container')).toArray()) {
          let page = $(obj).attr('src')
          if(typeof page === 'undefined') continue  
          pages.push(page)
        }
        return pages
    }

    filterUpdatedManga($: CheerioSelector, time: Date, ids: string[] ) : {updates: string[], loadNextPage : boolean} {
    
    let foundIds: string[] = []
    let passedReferenceTime = false
    for (let item of $('.hlb-t').toArray()) {
      let id = ($('a', item).first().attr('href') ?? '')?.replace(`${COMICEXTRA_DOMAIN}/comic/`, '')!.trim() ?? ''
      let mangaTime = new Date(time)
      if($('.date', item).first().text().trim().toLowerCase() === "yesterday") {
        mangaTime = new Date(Date.now())
        mangaTime.setDate(new Date(Date.now()).getDate() - 1)
      }
      else {
        mangaTime = new Date($('.date', item).first().text()) 
      }
      passedReferenceTime = mangaTime <= time
      if (!passedReferenceTime) {
        if (ids.includes(id)) {
          foundIds.push(id)
        }
      }
      else break
    }
    if(!passedReferenceTime) {
        return {updates: foundIds, loadNextPage: true}
    }
    else {
        return {updates: foundIds, loadNextPage: false}
    }

    
}

    parseSearchResults($: CheerioSelector): MangaTile[] { 
        let mangaTiles: MangaTile[] = []
        let collectedIds: string[] = []
        for(let obj of $('.cartoon-box').toArray()) {
            let id = $('a', $(obj)).attr('href')?.replace(`${COMICEXTRA_DOMAIN}/comic/`, '')
            let titleText = this.decodeHTMLEntity($('h3', $(obj)).text())
            let image = $('img', $(obj)).attr('src')
      
            if(titleText == "Not found") continue // If a search result has no data, the only cartoon-box object has "Not Found" as title. Ignore.
            if (typeof id === 'undefined' || typeof image === 'undefined') continue
            if(!collectedIds.includes(id)) {
            mangaTiles.push(createMangaTile({
                id: id,
                title: createIconText({text: titleText}),
                image: image
            }))
            collectedIds.push(id)
          }
    }
    return mangaTiles
    }

    parseTags($: CheerioSelector): TagSection[] {
        
        let tagSections: TagSection[] = [createTagSection({ id: '0', label: 'genres', tags: [] }),
        createTagSection({ id: '1', label: 'format', tags: [] })]
    
        for(let obj of $('a', $('.home-list')).toArray()) {
          let id = $(obj).attr('href')?.replace(`${COMICEXTRA_DOMAIN}/`, '').trim() ?? $(obj).text().trim()
          let genre = $(obj).text().trim()
          tagSections[0].tags.push(createTag({id: id, label: genre}))
        }
        tagSections[1].tags.push(createTag({id: 'comic/', label: 'Comic'}))
        return tagSections
    }

    parseHomePageSection($ : CheerioSelector): MangaTile[]{
        
        let tiles: MangaTile[] = []
        let collectedIds: string[] = []
        for(let obj of $('.cartoon-box').toArray()) {
            let id = $('a', $(obj)).attr('href')?.replace(`${COMICEXTRA_DOMAIN}/comic/`, '')
            let titleText = this.decodeHTMLEntity($('h3', $(obj)).text().trim())
            let image = $('img', $(obj)).attr('src')

            if (typeof id === 'undefined' || typeof image === 'undefined') continue
            if(!collectedIds.includes(id)) {
            tiles.push(createMangaTile({
                id: id,
                title: createIconText({text: titleText}),
                image: image
            }))
            collectedIds.push(id)
        }
      }
        return tiles
    }
    isLastPage($: CheerioSelector): boolean {
      for(let obj of $('a', $('.general-nav')).toArray()) {
        if($(obj).text().trim().toLowerCase() == 'next') {
          return false
        }
      }
      return true
    }
    
    decodeHTMLEntity(str: string): string {
        return str.replace(/&#(\d+);/g, function (match, dec) {
            return String.fromCharCode(dec);
        })
    }
}
