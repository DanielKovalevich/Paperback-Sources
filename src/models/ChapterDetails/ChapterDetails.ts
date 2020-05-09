export interface ChapterDetails {
  /**
   * The chapter identifier which this source uses. This may be unique to the source.
   * For example, one source may use 'Chapter-1' in it's URLs to identify this chapter,
   * whereas other sources may use some numeric identifier
   */
  id: string

  /**
   * The given identifier of the Manga that owns this chapter. This may be unique to the source
   * which uses it. For example, one source may use the value '1234' to 
   * identify a manga, whereas another one may use the value 'One-Piece' to identify
   */
  mangaId: string

  /**
   * A list of page URLs which directly reference the image on the page.
   * Example: http://yoursource.com/manga/mangaPage.jpg
   * These are what the application renders when the chapter is pulled up
   */
  pages: string[]

  /**
   * A mode flag. Should this manga be rendered in longStrip mode?
   */
  longStrip: boolean
}

declare global {

  function createChapterDetails(chapterDetails: ChapterDetails): ChapterDetails
}