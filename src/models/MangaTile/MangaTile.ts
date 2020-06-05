export interface MangaTile {
	/**
   * The given identifier of this Manga. This may be unique to the source
   * which uses it. For example, one source may use the value '1234' to 
   * identify a manga, whereas another one may use the value 'One-Piece' to identify
   */
  id: string

  /**
   * What is this manga called? How should it be rendered on the MangaTile?
   */
  title: IconText

  /**
   * A URL pointing to the image thumbnail which should be displayed on the tile
   */
  image: string

  /**
   * Any available text which can be displayed as a subtitle to the tile
   * This is what is displayed directly below the title
   */
  subtitleText?: IconText

  //TODO: The next few documentations are weak, needs refining
  /**
   * IconText which can be shown as primary text to the thumbnail
   * This is rendered in the bottom left of the manga object on the view.
   */
  primaryText?: IconText

  /**
   * IconText which can be shown as secondary text to the thumbnail
   * This is rendered on the bottom right of the manga object on the view
   */
  secondaryText?: IconText

  /**
   * The badge value which should be shown on this tile
   */
  badge?: number
}

export interface IconText {
  text: string
  icon?: string
}

declare global {
  function createMangaTile(mangaTile: MangaTile): MangaTile
  function createIconText(iconText: IconText): IconText
}
