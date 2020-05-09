export interface Chapter {

  /**
   * A given identifier of this chapter. This may be unique to the source.
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
   * An identifier of which chapter number this is, in a given {@link Manga}
   */
  chapNum: number

  //TODO: The langCode should be enumerated
  /**
   * The language code which this chapter is associated with.
   * This allows the application to filter by language
   */
  langCode: string

  /**
   * The title of this chapter, if one exists
   */
  name?: string

  /**
   * The volume number that this chapter belongs in, if one exists
   */
  volume?: number

  /**
   * A grouping of chapters that this belongs to
   */
  group?: string

  /**
   * The {@link Date} in which this chapter was released
   */
  time?: Date
}

declare global {
  function createChapter(chapter: Chapter): Chapter
}