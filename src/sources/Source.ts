/**
 * Request objects hold information for a particular source (see sources for example)
 * This allows us to to use a generic api to make the calls against any source
 */

import { SearchRequest } from "../models/SearchRequest/SearchRequest"
import { Manga } from "../models/Manga/Manga"
import { Request } from "../models/RequestObject/RequestObject"
import { Chapter } from "../models/Chapter/Chapter"
import { ChapterDetails } from "../models/ChapterDetails/ChapterDetails"
import { MangaTile } from "../models/MangaTile/MangaTile"
import { HomeSectionRequest, HomeSection } from "../models/HomeSection/HomeSection"
import { TagSection } from "../models/TagSection/TagSection"

export abstract class Source {
  protected cheerio: CheerioAPI
  constructor(cheerio: CheerioAPI) {
    this.cheerio = cheerio
  }

  // <-----------        REQUIRED METHODS        -----------> //
  // Returns the version of the source
  // Ensures that the app is using the most up to date version
  /**
   * Required class variable which denotes the current version of the application. 
   * This is what the application uses to determine whether it needs to update it's local
   * version of the source, to a new version on the repository
   */
  abstract get version(): string

  /**
   * The title of this source, this is what will show up in the application
   * to identify what Manga location is being targeted
   */
  abstract get name(): string

  /**
   * An INTERNAL reference to an icon which is associated with this source.
   * This Icon should ideally be a matching aspect ratio (a cube)
   * The location of this should be in an includes directory next to your source.
   * For example, the MangaPark link sits at: sources/MangaPark/includes/icon.png
   * This {@link Source.icon} field would then be simply referenced as 'icon.png' and
   * the path will then resolve correctly internally
   */
  abstract get icon(): string

  /**
   * The author of this source. The string here will be shown off to the public on the application
   * interface, so only write what you're comfortable with showing
   */
  abstract get author(): string

  /**
   * A brief description of what this source targets. This is additional content displayed to the user when 
   * browsing sources. 
   * What website does it target? What features are working? Etc.
   */
  abstract get description(): string

  /**
   * Whether the source is a hentai source. This allows us to make sure that hentai sources do not appear
   * if the user doesn't have hentai enabled
   */
  abstract get hentaiSource(): boolean

  /**
   * An optional field where the author may put a link to their website
   */
  get authorWebsite(): string | null { return null }

  /**
   * An optional field that defines the language of the extension's source
   */
  get language(): string { return 'all' }

  /**
   * A function returning a request for manga information on a list of multiple mangas.
   * The end-goal of this function set is to populate a list of {@link Manga} objects
   * so be sure you are targeting a URL which can be parsed to pull the required information
   * @param ids An array of Manga-IDs (title, internal ids, whatever your source uses) which are to be searched for 
   * @returns An array of {@link Request} where each Request is able to give information on one of the input ids
   */
  abstract getMangaDetailsRequest(ids: string[]): Request[]

  /**
   * A function which should handle parsing apart HTML returned from {@link Source.getMangaDetailsRequest}
   * and generate {@link Manga} objects from it. If the input is an array of data, an array of Manga
   * should be returned if possible, handling multiple requests.
   * @param data Your raw HTML which is retrieved from {@link Source.getMangaDetailsRequest}
   * @param metadata Anything that is passed to {@link Source.getMangaDetailsRequest}'s Request object as
   * metadata, will be available populating this field as well. 
   */
  abstract getMangaDetails(data: any, metadata: any): Manga[]

  /**
   * The end-goal of this function set is using a generated {@link Request} to populate a list of {@link Chapter} objects
   * so be sure you are targeting a URL which can be parsed to pull the required information
   * @param mangaId 
   */
  abstract getChaptersRequest(mangaId: string): Request

  /**
   * A function which should handle parsing apart HTML returned from {@link Source.getChaptersRequest}
   * and generate a list of available {@link Chapter} objects
   * @param data HTML which can be parsed to get information on all of the chapters to a specific manga
   * @param metadata Anything that is passed to {@link Source.getMangaDetailsRequest}'s Request object as
   * metadata, will be available populating this field as well. 
   */
  abstract getChapters(data: any, metadata: any): Chapter[]

  // Get all pages for a particular chapter
  /**
   * The end-goal of this function set is using a generated {@link Request} to populate a
   * {@link ChapterDetails} object for a targeted chapter. Specifically this is the method
   * which will provide access to all of the pages in a chapter
   * @param chapId The chapter number which should be polled for a given mangaId
   * @param mangaId The Manga ID which is targeted
   */
  abstract getChapterDetailsRequest(mangaId: string, chapId: string): Request

  /**
   * A function which should handle parsing apart HTML returned from {@link Source.getChapterDetailsRequest} 
   * and generate a {@link ChapterDetails} object
   * @param data HTML which can be parsed to get information on a chapter
   * @param metadata Anything that is passed to {@link Source.getChapterDetailsRequest}'s Request object as
   * metadata, will be available populating this field as well. 
   * NextPage will tell us whether or not the source is paged. Some sources will only allow one page at a time
   * so this allows us to get around that. 
   * The param will only utilized if nextPage is true. The param is what is attached to the base url. This allows
   * us to change the page in url in the http request
   */
  abstract getChapterDetails(data: any, metadata: any): ChapterDetails

  /**
   * Using a {@link SearchRequest}, this method should generate a HTML request which will yield in a page 
   * displaying manga which matches all of the possible search information. 
   * Note that your {@link SearchRequest} object does not need to be filled out completely,
   * as not all manga supports all of the interface fields. Simply try to make your search
   * as functional as possible. Nullable fields are allowed to be ignored
   * @param query a filled out {@link SearchRequest} which should be made to a source
   * @param page It is likely that your search will have more than one page. This paramter determines which page
   * of the search results is being requested
   */
  abstract searchRequest(query: SearchRequest, page: number): Request | null

  /**
   * A function which should handle parsing apart HTML returned from {@link Source.getChapterDetailsRequest}
   * and generate a list of {@link MangaTile} objects, one for each result on this page
   * @param data HTML which can be parsed to get a list of all manga matching your search query
   */
  abstract search(data: any, metadata: any): MangaTile[] | null

  // <-----------        OPTIONAL METHODS        -----------> //

  /**
   * (OPTIONAL METHOD) Different sources have different tags available for searching. This method
   * should target a URL which allows you to parse apart all of the available tags which a website has.
   * This will populate tags in the iOS application where the user can use
   * @returns A request object which can provide HTML for determining tags that a source uses
   */
  getTagsRequest(): Request | null { return null }

  /**
   * (OPTIONAL METHOD) A function which should handle parsing apart HTML returned from {@link Source.getTags}
   * and generate a list of {@link TagSection} objects, determining what sections of tags an app has, as well as
   * what tags are associated with each section
   * @param data HTML which can be parsed to get tag information
   */
  getTags(data: any): TagSection[] | null { return null }

  /**
   * (OPTIONAL METHOD) A function which should handle generating a request for determining whether or 
   * not a manga has been updated since a specific reference time.
   * This method is different depending on the source. A current implementation for a source, as example,
   * is going through multiple pages of the 'latest' section, and determining whether or not there
   * are entries available before your supplied date.
   * @param ids The manga IDs which you are searching for updates on
   * @param time A {@link Date} marking the point in time you'd like to search up from.
   * Eg, A date of November 2020, when it is currently December 2020, should return all instances
   * of the image you are searching for, which has been updated in the last month
   * @param page A page number parameter may be used if your update scanning requires you to 
   * traverse multiple pages.
   */
  filterUpdatedMangaRequest(ids: any, time: Date, page: number): Request | null { return null }

  /**
   * (OPTIONAL METHOD) A function which should handle parsing apart HTML returned from {@link Source.filterUpdatedMangaRequest}
   * and generate a list manga which has been updated within the timeframe specified in the request.
   * @param data HTML which can be parsed to determine whether or not a Manga has been updated or not
   * @param metadata Anything passed to the {@link Request} object in {@link Source.filterUpdatedMangaRequest}
   * with the key of metadata will be available to this method here in this parameter
   * @returns A list of mangaID which has been updated. Also, a nextPage parameter is required. This is a flag
   * which should be set to true, if you need to traverse to the next page of your search, in order to fully
   * determine whether or not you've gotten all of the updated manga or not. This will increment
   * the page number in the {@link Source.filterUpdatedMangaRequest} method and run it again with the new
   * parameter
   */
  filterUpdatedManga(data: any, metadata: any): { 'updatedMangaIds': string[], 'nextPage': boolean } | null { return null }

  /**
   * (OPTIONAL METHOD) A function which should generate a {@link HomeSectionRequest} with the intention
   * of parsing apart a home page of a source, and grouping content into multiple categories.
   * This does not exist for all sources, but sections you would commonly see would be
   * 'Latest Manga', 'Hot Manga', 'Recommended Manga', etc.
   * @returns A list of {@link HomeSectionRequest} objects. A request for search section on the home page. 
   * It is likely that your request object will be the same in all of them.
   */
  getHomePageSectionRequest(): HomeSectionRequest[] | null { return null }

  /**
   * (OPTIONAL METHOD) A function which should handle parsing apart HTML returned from {@link Source.getHomePageSectionRequest}
   * and finish filling out the {@link HomeSection} objects. 
   * Generally this simply should update the parameter obejcts with all of the correct contents, and 
   * return the completed array
   * @param data The HTML which should be parsed into the {@link HomeSection} objects. There may only be one element in the array, that is okay
   * if only one section exists
   * @param section The list of HomeSection objects which are unfinished, and need filled out
   */
  getHomePageSections(data: any, section: HomeSection[]): HomeSection[] | null { return null }

  /**
   * (OPTIONAL METHOD) For many of the home page sections, there is an ability to view more of that selection
   * Calling this function should generate a {@link Request} targeting a new page of a given key
   * @param key The current page that is being viewed
   * @param page The page number which you are currently searching
   */
  getViewMoreRequest(key: string, page: number): Request | null { return null }

  /**
   * (OPTIONAL METHOD) A function which should handle parsing apart a page
   * and generate different {@link MangaTile} objects which can be found on it
   * @param data HTML which should be parsed into a {@link MangaTile} object
   * @param key 
   */
  getViewMoreItems(data: any, key: string): MangaTile[] | null { return null }

  /**
   * Returns the number of calls that can be done per second from the application
   * This is to avoid IP bans from many of the sources
   * Can be adjusted per source since different sites have different limits
   */
  getRateLimit(): Number { return 2 }


  // <-----------        PROTECTED METHODS        -----------> //
  // Many sites use '[x] time ago' - Figured it would be good to handle these cases in general
  protected convertTime(timeAgo: string): Date {
    let time: Date
    let trimmed: number = Number((/\d*/.exec(timeAgo) ?? [])[0])
    trimmed = (trimmed == 0 && timeAgo.includes('a')) ? 1 : trimmed
    if (timeAgo.includes('minutes')) {
      time = new Date(Date.now() - trimmed * 60000)
    }
    else if (timeAgo.includes('hours')) {
      time = new Date(Date.now() - trimmed * 3600000)
    }
    else if (timeAgo.includes('days')) {
      time = new Date(Date.now() - trimmed * 86400000)
    }
    else if (timeAgo.includes('year') || timeAgo.includes('years')) {
      time = new Date(Date.now() - trimmed * 31556952000)
    }
    else {
      time = new Date(Date.now())
    }

    return time
  }
}