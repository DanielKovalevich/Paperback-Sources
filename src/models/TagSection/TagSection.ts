export interface Tag {
    /**
     * An internal identifier of this tag
     */
    id: string

    /**
     * A user-prsesentable representation of how people read the tag. This 
     * may be the same as {@link Tag.id}
     */
    label: string
}

/**
 * A category of tags
 */
export interface TagSection {
    /**
     * The internal identifier of this tag category
     */
    id: string

    /**
     * How the tag category should be rendered to the user
     */
    label: string

    /**
     * A list of {@link Tag} objects which should be rendered under this category
     */
    tags: Tag[]
}

declare global {
    function createTag(tag: Tag): Tag
    function createTagSection(tagSection: TagSection): TagSection
}