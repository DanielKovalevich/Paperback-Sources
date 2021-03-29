import {Chapter, LanguageCode, Manga, MangaStatus, MangaTile, Tag, TagSection} from 'paperback-extensions-common'


const MANGAOWL_DOMAIN = 'https://mangaowl.net/'



export class Parser {

    parseMangaDetails($: CheerioSelector, mangaId: string): Manga {
    
      let mangaInfo = $(".single_detail")
      let mangaProps = $('div:nth-child(2) p', mangaInfo).toArray()
      let mangaIdRegex = /(?:single\/)(\w+)/gi
      let manga = {
          id: mangaId,
          titles: [$('h2', mangaProps).text()],
          image: $('img', mangaInfo).attr('data-src')!.replace(/^(\/\/)/gi, 'https://'),
          rating: 0,
          status: MangaStatus.ONGOING,
          artist: "",
          author: "",
          desc: $('.single_detail .description').text().replace(/^\./gi, ''),
      }
      for (let prop of mangaProps) {
          let propertyValue = $(prop).text().toLowerCase()

          if (propertyValue.includes('rating')) {
              manga.rating = Number($('font', prop).text())
          } else if (propertyValue.includes('status')) {
              let status = $(prop).contents().filter((_, x) => {
                  return x.type === 'text';
              }).text();
              manga.status = status.toLowerCase().includes('ongoing') ? MangaStatus.ONGOING : MangaStatus.COMPLETED
          } else if (propertyValue.includes('author')) {
              let author = $(prop).contents().filter((_, x) => {
                  return x.type === 'text';
              }).text();
              manga.author = author.trim()
          } else if (propertyValue.includes('artist')) {
              let artist = $(prop).contents().filter((_, x) => {
                  return x.type === 'text'
              }).text();
              manga.artist = artist.trim()
          }
      }
      return createManga(manga)
    }
   

    parseChapterList($: CheerioSelector, mangaId: string) : Chapter[] { 
    
      let chapters = $('.table-chapter-list .list-group-item.chapter_list').toArray()
      let chapterList = []
      let chapterStrRegex = /(chapter)\s?(\d+\.?\d+)/gim
      let chapterNumberRegex = /(\d+?)\.?(\d+$)/gim
              for (let chapter of chapters) {
          let chapNum = $('label.chapter-title', chapter).text().match(chapterStrRegex)![0].match(chapterNumberRegex)!
          // paste stuff here from now on
          chapterList.push(createChapter({
              id: $('.chapter-url', chapter).attr('chapter-id')!,
              chapNum: Number(chapNum[0]),
              langCode: LanguageCode.ENGLISH,
              volume: 0,
              mangaId: mangaId,
              name: "",
              time: new Date($('.chapter-url small', chapter).text()),
          }))
      }
      return chapterList
}





    parseChapterDetails(data: string, cheerio: any) : string[] {
        
      let $ = cheerio.load(data, { xmlMode: false })

      let allPages = $('#reader img[data-src]').toArray()
      let pages = []
      for (let page of allPages) {
          pages.push($(page).attr('data-src')!)
      }

      return pages;


    }


    parseSearchResults($: CheerioSelector): MangaTile[] { 
      let searchResults = $('.flexslider .comicView').toArray()
      let mangaIdRegex = /(?:single\/)(\w+)/gi 
      let mangas = []
      for (let result of searchResults) {
          mangas.push(createMangaTile({
              id: $('a', result).attr('href')!.match(mangaIdRegex)![0].split('/')[1],
              image: $('.comic_thumbnail', result).attr('data-background-image')!,
              title: createIconText({ text: $('.comic_title', result).text().trim() }),
          
          }))
      }

      return mangas
    }
  //   parseTags($: CheerioSelector): TagSection[] {
        
  //       let tagSections: TagSection[] = [createTagSection({ id: '0', label: 'genres', tags: [] }),
  //       createTagSection({ id: '1', label: 'format', tags: [] })]
    
  //       for(let obj of $('a', $('.home-list')).toArray()) {
  //         let id = $(obj).attr('href')?.replace(`${READCOMICTO_DOMAIN}/`, '').trim() ?? $(obj).text().trim()
  //         let genre = $(obj).text().trim()
  //         tagSections[0].tags.push(createTag({id: id, label: genre}))
  //       }
  //       tagSections[1].tags.push(createTag({id: 'comic/', label: 'Comic'}))
  //       return tagSections
  //   }

  //   parseHomePageSection($ : CheerioSelector, cheerio:any): MangaTile[]{
        
  //     let tiles: MangaTile[] = []
  //     let collectedIds: string[] = []
  //     for(let obj of $('tr', $('.listing')).toArray()) {
          
  //         let titleText = this.decodeHTMLEntity($('a',$(obj)).text().replace('\n','').trim())
  //         let id = $('a',$(obj)).attr('href')?.replace('/Comic/', '')
  //         if(!titleText || !id) { 
  //           continue
          
  //         }
  //         //Tooltip Selecting 
  //         let imageCheerio = cheerio.load($('td', $(obj)).first().attr('title') ?? '')
  //         let url = this.decodeHTMLEntity(imageCheerio('img').attr('src'))
  //         let image = url.includes('http') ? url : `${READCOMICTO_DOMAIN}${url}`

  //         if (typeof id === 'undefined' || typeof image === 'undefined' ) continue
  //         if(!collectedIds.includes(id)) {
  //         tiles.push(createMangaTile({
  //             id: id,
  //             title: createIconText({text: titleText}),
  //             image: image
  //         }))
  //         collectedIds.push(id)
  //       }
  // }
  // return tiles
  //   }
    isLastPage($: CheerioSelector): boolean {
      return !$('.pager').text().includes('Next')
    }

    
    decodeHTMLEntity(str: string): string {
        return str.replace(/&#(\d+);/g, function (match, dec) {
            return String.fromCharCode(dec);
        })
    }
}
