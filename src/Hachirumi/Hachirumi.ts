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
  async getMangaDetails(mangaId: string): Promise<any> {
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
      titles: result.title,
      image: HACHIRUMI_DOMAIN + result.cover,
      rating: 5,
      status: MangaStatus.ONGOING,
      artist: result.artist,
      author: result.author,
      desc: result.description,
    });
  }

  getChapters(mangaId: string): Promise<Chapter[]> {
    throw new Error("Method not implemented.");
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
