import {
  Source,
  Manga,
  Chapter,
  ChapterDetails,
  HomeSection,
  SearchRequest,
  LanguageCode,
  MangaStatus,
  MangaUpdates,
  PagedResults,
  SourceInfo,
} from "paperback-extensions-common";

const HACHIRUMI_DOMAIN = "https://hachirumi.com";
const HACHIRUMI_API = `${HACHIRUMI_DOMAIN}/api`;

export const HachirumiInfo: SourceInfo = {
  version: "1.0.0",
  name: "Hachirumi",
  icon: "icon.png",
  author: "Curstantine",
  authorWebsite: "https://github.com/Curstantine",
  description: "Extension that pulls manga from Hachirumi.",
  language: LanguageCode.ENGLISH,
  hentaiSource: false,
  websiteBaseURL: HACHIRUMI_DOMAIN,
};

export class Hachirumi extends Source {
  /* 
  Though "mangaId" is mentioned here Hachirumi uses slugs. 
  eg: the-story-about-living
  */
  async getMangaDetails(mangaId: string): Promise<Manga> {
    let request = createRequestObject({
      url: HACHIRUMI_API + "/series/" + mangaId,
      method: "GET",
      headers: {
        "accept-encoding": "application/json",
      },
    });

    let response = await this.requestManager.schedule(request, 1);
    let result =
      typeof response.data === "string" || typeof response.data !== "object"
        ? JSON.parse(response.data)
        : response.data;

    return createManga({
      id: result.slug,
      titles: [result.title],
      image: HACHIRUMI_DOMAIN + result.cover,
      rating: 0, // Rating is not supported by Hachirumi.
      status: MangaStatus.ONGOING,
      artist: result.artist,
      author: result.author,
      desc: result.description,
    });
  }

  /*
  Follows the same format as `getMangaDetails`.
  Hachirumi serves both chapters and manga in single request.
  */
  async getChapters(mangaId: string): Promise<Chapter[]> {
    let request = createRequestObject({
      url: HACHIRUMI_API + "/series/" + mangaId,
      method: "GET",
      headers: {
        "accept-encoding": "application/json",
      },
    });

    let response = await this.requestManager.schedule(request, 1);
    let result =
      typeof response.data === "string" || typeof response.data !== "object"
        ? JSON.parse(response.data)
        : response.data;

    let chapterObject = result["chapters"];
    let groupObject = result["groups"];
    let chapters = [];

    for (let key in chapterObject) {
      let metadata = chapterObject[key];

      for (let groupKey in metadata["groups"]) {
        chapters.push(
          createChapter({
            id: metadata["folder"],
            mangaId: result.slug,
            chapNum: parseInt(key),
            langCode: LanguageCode.ENGLISH,
            name: metadata["title"],
            volume: metadata["volume"],
            group: groupObject[groupKey],
            time: new Date(metadata["release_date"][groupKey] * 1000),
          })
        );
      }
    }
    return chapters;
  }
  getChapterDetails(
    mangaId: string,
    chapterId: string
  ): Promise<ChapterDetails> {
    throw new Error("Method not implemented.");
  }
  searchRequest(query: SearchRequest, metadata: any): Promise<PagedResults> {
    throw new Error("Method not implemented.");
  }
}
