/* eslint-disable camelcase, @typescript-eslint/explicit-module-boundary-types, radix, unicorn/filename-case */

import {Manga, Chapter, ChapterDetails, MangaTile} from 'paperback-extensions-common'
const MANGAPLUS_GROUP_ID = 9097

export class Parser {
  parseMangaDetails(json: any): Manga[] {
    const mangas = []
    for (const mangaDetails of json.result) {
      mangas.push(
        createManga({
          id: mangaDetails.id.toString(),
          titles: mangaDetails.titles,
          image: mangaDetails.image ?? 'https://mangadex.org/images/avatars/default1.jpg',
          rating: mangaDetails.rating,
          status: mangaDetails.status,
          langFlag: mangaDetails.langFlag,
          langName: mangaDetails.langName,
          artist: mangaDetails.artist,
          author: mangaDetails.author,
          avgRating: mangaDetails.avgRating,
          covers: mangaDetails.covers,
          desc: mangaDetails.description,
          follows: mangaDetails.follows,
          tags: [
            createTagSection({
              id: 'content',
              label: 'Content',
              tags: mangaDetails.content.map((x: any) =>
                createTag({id: x.id.toString(), label: x.value}),
              ),
            }),
            createTagSection({
              id: 'demographic',
              label: 'Demographic',
              tags: mangaDetails.demographic.map((x: any) =>
                createTag({id: x.id.toString(), label: x.value}),
              ),
            }),
            createTagSection({
              id: 'format',
              label: 'Format',
              tags: mangaDetails.format.map((x: any) =>
                createTag({id: x.id.toString(), label: x.value}),
              ),
            }),
            createTagSection({
              id: 'genre',
              label: 'Genre',
              tags: mangaDetails.genre.map((x: any) =>
                createTag({id: x.id.toString(), label: x.value}),
              ),
            }),
            createTagSection({
              id: 'theme',
              label: 'Theme',
              tags: mangaDetails.theme.map((x: any) =>
                createTag({id: x.id.toString(), label: x.value}),
              ),
            }),
          ],
          users: mangaDetails.users,
          views: mangaDetails.views,
          hentai: mangaDetails.hentai,
          relatedIds: mangaDetails.relatedIds,
          lastUpdate: mangaDetails.lastUpdate,
        }),
      )
    }

    return mangas
  }

  parseChapterList(mangaId: string, json: any): Chapter[] {
    let chapters = []
    const groups = Object.assign({}, ...json.data.groups.map((x: any) => ({[x.id]: x.name})))

    for (const chapter of json.data.chapters) {
      if (!chapter.groups.includes(MANGAPLUS_GROUP_ID))
        {chapters.push(
          createChapter({
            id: chapter.id.toString(),
            mangaId: mangaId,
            chapNum: Number(chapter.chapter),
            langCode: chapter.language,
            volume: Number.isNaN(chapter.volume) ? 0 : Number(chapter.volume),
            group: chapter.groups.map((x: any) => groups[x]).join(', '),
            name: chapter.title,
            time: new Date(Number(chapter.timestamp) * 1000)
          })
        )}
    }
    return chapters
  }

  parseChapterDetails(chapterDetails: any): ChapterDetails {
    return createChapterDetails({
      id: chapterDetails.id.toString(),
      longStrip: false,
      mangaId: chapterDetails.mangaId.toString(),
      pages: chapterDetails.pages.map(
        (x: string) => `${chapterDetails.server}${chapterDetails.hash}/${x}`,
      ),
    })
  }

  filterUpdatedManga($: CheerioSelector, referenceTime: Date, allManga: Set<string>): {updates: string[], hasMore: boolean} {
    console.log(`REFERENCE TIME: ${referenceTime}`)

    const ids: string[] = []
    const entries = $('.manga-entry').toArray()
    for (const elem of entries) {
      const id = elem.attribs['data-id']
      const mangaDate = new Date(
        ($(elem).find('time').attr('datetime') ?? '').replace(/-/g, '/'),
      )

      console.log(`${id} updated at ${mangaDate}}`)
      if (mangaDate >= referenceTime) {
        if (allManga.has(id)) {
          console.log(`${id} marked as an update`)
          ids.push(id)
        }
      } else {
        return {updates: ids, hasMore: false}
      }
    }

    console.log(`Found ${ids.length} updates`)
    return {updates: ids, hasMore: entries.length > 0}
  }

  parseMangaTiles(json: any): MangaTile[] {
    const updates: MangaTile[] = []
    const result = json.result

    for (const manga of result) {
      console.log(manga.lastUpdate)
      updates.push(
        createMangaTile({
          id: manga.id.toString(),
          image: manga.image,
          title: createIconText({
            text: manga.titles[0] ?? 'UNKNOWN',
          }),
          subtitleText: createIconText({
            icon: 'clock.fill',
            text: this.timeDifference(
              new Date().getTime(),
              new Date(manga.lastUpdate).getTime(),
            ),
          }),
        }),
      )
    }
    return updates
  }

  parseSearchResults(json: any): MangaTile[] {
    const mangas = []
    for (const mangaDetails of json.result) {
      mangas.push(
        createMangaTile({
          id: mangaDetails.id.toString(),
          image: mangaDetails.image,
          title: createIconText({
            text: mangaDetails.titles[0] ?? 'UNKNOWN',
          }),
        }),
      )
    }

    return mangas
  }

  timeDifference(current: number, previous: number) {
    const msPerMinute = 60 * 1000
    const msPerHour = msPerMinute * 60
    const msPerDay = msPerHour * 24
    const msPerMonth = msPerDay * 30
    const msPerYear = msPerDay * 365

    const elapsed = current - previous

    if (elapsed < msPerMinute) {
      return Math.round(elapsed / 1000) + ' sec ago'
    }
    if (elapsed < msPerHour) {
      return Math.round(elapsed / msPerMinute) + ' min ago'
    }
    if (elapsed < msPerDay) {
      return Math.round(elapsed / msPerHour) + ' hrs ago'
    }
    if (elapsed < msPerMonth) {
      return Math.round(elapsed / msPerDay) + ' days ago'
    }
    if (elapsed < msPerYear) {
      return Math.round(elapsed / msPerMonth) + ' months ago'
    }
    return Math.round(elapsed / msPerYear) + ' years ago'
  }
}
