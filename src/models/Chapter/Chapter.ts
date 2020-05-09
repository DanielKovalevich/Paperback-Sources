import { LanguageCode } from "../Constants/Constants";

export interface Chapter {
  id: string
  mangaId: string
  chapNum: number
  langCode: LanguageCode
  name?: string
  volume?: number
  group?: string
  time?: Date
}

declare global {
  function createChapter(chapter: Chapter): Chapter
}