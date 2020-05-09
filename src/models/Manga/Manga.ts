import { TagSection } from "../TagSection/TagSection";

export interface Manga {
	id: string
	titles: string[]
	image: string

	rating: number
	status: MangaStatus

	langFlag?: string
	langName?: string

	artist?: string
	author?: string
	avgRating?: number

	covers?: string[]

	description?: string
	follows?: number

	tags?: TagSection[]

	users?: number
	views?: number

	hentai?: boolean
	relatedIds?: string[]
	lastUpdate?: string
}

export enum MangaStatus {
	UNKNOWN = 0,
	ONGOING = 1,
	COMPLETED = 2
}

declare global {
	function createManga(manga: Manga): Manga
}