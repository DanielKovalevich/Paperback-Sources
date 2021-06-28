import {
  Source,
  Manga,
  Chapter,
  ChapterDetails,
  SearchRequest,
  LanguageCode,
  MangaStatus,
  PagedResults,
  SourceInfo,
} from "paperback-extensions-common";

const HACHIRUMI_DOMAIN = "https://hachirumi.com";
const HACHIRUMI_API = `${HACHIRUMI_DOMAIN}/api`;
const HACHIRUMI_IMAGES = (
  slug: string,
  folder: string,
  group: string,
  ext: string
) =>
  `https://hachirumi.com/media/manga/${slug}/chapters/${folder}/${group}/${ext}`;

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
            id: `${key}|${groupKey}|${metadata["folder"]}`, // Moved to this format as it is easier to find the `key, groupkey, folder`.
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

  /*
   * Follows the chapterId format used  in `getChapter` method.
   * `chapterKey|groupKey|folderId`
   */
  async getChapterDetails(
    mangaId: string,
    chapterId: string
  ): Promise<ChapterDetails> {
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
    let [chapterKey, groupKey, folder] = chapterId.split("|"); // Splits the given generic chapter id to chapterkey and such.

    return createChapterDetails({
      id: chapterId,
      longStrip: false, // Not implemented.
      mangaId: mangaId,
      pages: chapterObject[chapterKey]["groups"][groupKey].map((ext: string) =>
        HACHIRUMI_IMAGES(mangaId, folder, groupKey, ext)
      ),
    });
  }

  /*
  This method doesn't query anything, instead finds a specific title from `get_all_series` endpoint
   */
  async searchRequest(
    query: SearchRequest,
    metadata: any
  ): Promise<PagedResults> {
    let request = createRequestObject({
      url: HACHIRUMI_API + "/get_all_series",
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

    // Checks for the query title and pushes it to lowercase.
    let queryTitle: string = query.title ? query.title.toLowerCase() : "";
    // Takes the response array and checks for titles that matches the query string.
    let filterer = (titles: object[]) =>
      Object.keys(titles).filter((title) =>
        title.replace("-", "").toLowerCase().includes(queryTitle)
      );

    let filteredRequest = filterer(result).map((title) => {
      let metadata = result[title];
      return createMangaTile({
        id: metadata.slug,
        image: HACHIRUMI_DOMAIN + metadata.cover,
        title: createIconText({ text: title }),
      });
    });

    return createPagedResults({
      results: filteredRequest,
    });
  }
}
