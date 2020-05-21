import { Source } from '../Source'
import { Manga, MangaStatus } from '../../models/Manga/Manga'
import { Chapter } from '../../models/Chapter/Chapter'
import { MangaTile } from '../../models/MangaTile/MangaTile'
import { SearchRequest } from '../../models/SearchRequest/SearchRequest'
import { Request } from '../../models/RequestObject/RequestObject'
import { ChapterDetails } from '../../models/ChapterDetails/ChapterDetails'
import { Tag, TagSection } from '../../models/TagSection/TagSection'
import { HomeSection, HomeSectionRequest } from '../../models/HomeSection/HomeSection'
import { APIWrapper } from '../../API'
import { LanguageCode } from '../../models/Languages/Languages'

const WEBTOONS_DOMAIN = 'https://www.webtoons.com/en'
const WEBTOONS_SEARCH_DOMAIN = 'https://www.webtoons.com/'

export class WebToons extends Source {
  constructor(cheerio: CheerioAPI) {
    super(cheerio)
  }

  get version(): string { return '0.1.2' }

  get name(): string { return 'WebToons (BETA)' }
  get description(): string { return 'Extension that pulls comics from WebToons' }
  get author(): string { return 'Conrad Weiser' }
  get authorWebsite(): string { return 'http://github.com/conradweiser'}
  get icon(): string { return "logo.jpg" } 
  get hentaiSource(): boolean { return false }


  getMangaDetailsRequest(ids: string[]): Request[] {
    let requests: Request[] = []
    for (let id of ids) {

      // Is this a challange ID?
      if(id.includes('c_')) {
        let metadata = {'id' : id.replace('c_', '')}
        requests.push(createRequestObject({
          url: `${WEBTOONS_DOMAIN}/challenge/towertown/list?title_no=${metadata.id}`,
          headers: {"REFERER": `${WEBTOONS_SEARCH_DOMAIN}`},
          metadata: metadata,
          method: 'GET'
        }))
      }
      else {
        let metadata = { 'id': id }
        requests.push(createRequestObject({
          url: `${WEBTOONS_DOMAIN}/thriller/bastard/list?title_no=${id}`,
          headers: {"REFERER": `${WEBTOONS_SEARCH_DOMAIN}`},
          metadata: metadata,
          method: 'GET'
        }))
      }
    }

    return requests
  }

  getMangaDetails(data: any, metadata: any): Manga[] {
    let manga: Manga[] = []
    let $ = this.cheerio.load(data)

    // Is this a challange type?
    let image
    let title
    let completedStatus
    let rating
    let desc
    if($('.challenge').length > 0) {
      let context = $('.cont_box')
      image = $('img', context).attr('src')
      title = $('._challengeTitle', context).text()
      completedStatus = MangaStatus.ONGOING   // Challange pages don't have this 
      rating = $('#_starScoreAverage').text()
      desc = $('.summary', context).text()
    }
    else {
      image = $('.detail_body').attr('style')
      title = $('h1.subj', $('.info')).text()
      completedStatus = $('.txt_ico_completed2').length > 0 ? MangaStatus.COMPLETED : MangaStatus.ONGOING
      rating = $('#_starScoreAverage').text()
      let regex = new RegExp(`url(\(.*\)) `)
      let match = regex.exec(image!)
      image = match![1].replace('url(\"', '').replace(')', '')
      image = image.substr(1, image.indexOf(" ") - 1)
      desc = $('.summary').text()
    }
    

    return [createManga({
        id: metadata.id,
        titles: [title],
        image: image!,
        desc: desc,
        rating: Number(rating),
        status: completedStatus
    })]
  }

  getChaptersRequest(mangaId: string): Request {

    // Is this a challange ID?
    if(mangaId.includes('c_')) {
      let metadata = {'id' : mangaId.replace('c_', '')}
      return createRequestObject({
        url: `${WEBTOONS_DOMAIN}/challenge/towertown/list?title_no=${metadata.id}`,
        metadata: metadata,
        method: 'GET'
      })
    }

    let metadata = { 'id': mangaId }
    return createRequestObject({
      url: `${WEBTOONS_DOMAIN}/thriller/bastard/list?title_no=${mangaId}`,
      headers: {"REFERER": `${WEBTOONS_SEARCH_DOMAIN}`},
      metadata: metadata,
      method: 'GET'
    })
  }

  getChapters(data: any, metadata: any): Chapter[] {
    let $ = this.cheerio.load(data)
    let chapters: Chapter[] = []

    //WebToons doesn't show all of the chapters on one page. But with the top entry, we can generate the URLs for every other page
    let topChapter = $('#_listUl').toArray()
    let maxChapterNum = Number($('li', topChapter).attr('id')?.replace("episode_", ""))
    
    for(let i = 1; i <= maxChapterNum; i++) {
      chapters.push(createChapter({
        id: i.toString(),
        mangaId: metadata.id,
        chapNum: i,
        langCode: LanguageCode.ENGLISH
      }))
    }

    return chapters
  }
//https://www.webtoons.com/en/sf/rebirth/s2-episode-78/viewer?title_no=1412&episode_no=80
  getChapterDetailsRequest(mangaId: string, chapId: string): Request {
    let metadata = { 'mangaId': mangaId, 'chapterId': chapId }
    return createRequestObject({
      url: `${WEBTOONS_DOMAIN}/sf/rebirth/s2-episode-78/viewer?title_no=${mangaId}&episode_no=${chapId}`,
      headers: {"REFERER": `${WEBTOONS_SEARCH_DOMAIN}`},
      metadata: metadata,
      method: 'GET',
    })
  }

  getChapterDetails(data: any, metadata: any): ChapterDetails {
    let $ = this.cheerio.load(data)

    // Get all of the pages associated to this chapter
    let pages: string[] = []
    let pageContainer = $('#_imageList', $('#_viewerBox'))
    for(let img of $('img', pageContainer).toArray()) {
      pages.push($(img).attr('data-url')!)
    }

    let chapterDetails = createChapterDetails({
      id: metadata.chapterId,
      mangaId: metadata.mangaId,
      pages: pages,
      longStrip: true
    })

    return chapterDetails
  }


  searchRequest(query: SearchRequest, page: number): Request {
    //https://www.webtoons.com/search?keyword=Rebirth
    return createRequestObject({
      url: `${WEBTOONS_SEARCH_DOMAIN}search?keyword=${query.title}`,
      headers: {"REFERER": `${WEBTOONS_SEARCH_DOMAIN}`},
      timeout: 4000,
      method: "GET"
    })
  }

  search(data: any, metadata: any): MangaTile[] {

    let $ = this.cheerio.load(data)
    let mangaTiles: MangaTile[] = []


    // Get all orig titles to WebToons
    let context = $('.card_lst')
    for(let item of $('li', context).toArray()) {
      let infoObj = $('.info', $(item))
      let id = $('a', $(item)).attr('href')?.replace('/episodeList?titleNo=', '')
      let title = $('.subj', infoObj).text()
      let image = $('img', $(item)).attr('src')
      let primaryText = $('.genre', $(item)).text()

      mangaTiles.push(createMangaTile({
        id: id!,
        title: createIconText({text: title}),
        image: image!,
        subtitleText: createIconText({text: primaryText!})
      }))
    }

    // Push all canvas titles to WebToons
    context = $('.challenge_lst')
    for(let item of $('li', context).toArray()) {
      let id = $('a', $(item)).attr('href')?.replace('/challenge/episodeList?titleNo=', '')
      let title = $('.subj', item).text()
      let image = $('img', $(item)).attr('src')
      let primaryText = $('.genre', $(item)).text()

      mangaTiles.push(createMangaTile({
        id: 'c_' + id!,
        title: createIconText({text: title}),
        image: image!,
        subtitleText: createIconText({text: primaryText!})
      }))
    }

    return mangaTiles
  }
}