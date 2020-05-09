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
	ONGOING = 0,
	COMPLETED = 1
}

declare global {
	function createManga(manga: Manga): Manga
}