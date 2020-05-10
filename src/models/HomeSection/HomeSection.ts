import { Request } from '../RequestObject/RequestObject'
import { MangaTile } from '../MangaTile/MangaTile'

export interface HomeSectionRequest {
  /**
   * A request object which targets a URL which different sections on the source home page
   * can be parsed from.
   */
  request: Request

  /**
   * A list of {@link HomeSections}. You may have more than one of these.
   * Common examples of HomeSections would be 'Latest Manga', 'Updated Manga',
   * 'Hot Manga', etc.
   */
  sections: HomeSection[]
}

export interface HomeSection {
  /**
   * An internal identifier of this HomeSection
   */
  id: string

  /**
   * The title of this section. 
   * Common examples of HomeSection titles would be 'Latest Manga', 'Updated Manga',
   * 'Hot Manga', etc.
   */
  title: string

  /**
   * A list of {@link MangaTile} objects which should be shown under this section
   */
  items?: MangaTile[]

  //TODO: Do I have this right? 
  /**
   * Should you be able to scroll, and view more manga on this section? 
   * This method, when true, triggers the {@link Source.getViewMoreRequest} method
   * when the user tries to scroll furthur on the HomePage section. This usually means 
   * that it will traverse to another page, and render more information
   */
  view_more?: boolean
}

declare global {
  function createHomeSection(section: HomeSection): HomeSection
  function createHomeSectionRequest(homeRequestObject: HomeSectionRequest): HomeSectionRequest
}
