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

import {
  chapId,
  chapNum,
  chapName,
  chapVol,
  chapGroup,
  unixToDate,
} from "./Functions";

const HACHIRUMI_DOMAIN = "https://hachirumi.com";
const HACHIRUMI_API = `${HACHIRUMI_DOMAIN}/api`;
const HACHIRUMI_IMAGES = (
  slug: string,
  folder: string,
  group: string,
  ext: string
) =>
  `https://hachirumi.com/media/manga/${slug}/chapters/${folder}/${group}/${ext}`;

/*
 * # Error Methods
 * {Message}. @{Method} on {traceback-able method/function/constants/variables}
 * eg: Failed to parse the response. @getResult on result.
 * ```
 * getResult(){
 * const fetch = //
 * }
 * ```
 */

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

    if (!result || result === undefined)
      throw new Error(
        "Failed to parse the response. @getMangaDetails() on result."
      );

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
    const request = createRequestObject({
      url: HACHIRUMI_API + "/series/" + mangaId,
      method: "GET",
      headers: {
        "accept-encoding": "application/json",
      },
    });

    const response = await this.requestManager.schedule(request, 1);
    const result =
      typeof response.data === "string" || typeof response.data !== "object"
        ? JSON.parse(response.data)
        : response.data;

    if (!result || result === undefined)
      throw new Error(
        "Failed to parse the response. @getChapters() on result."
      );

    const chapterObject = result["chapters"];
    const groupObject = result["groups"];

    if (!chapterObject || !groupObject)
      throw new Error(
        "Failed to read chapter/group data. @getChapters() on chapterObject."
      );

    let chapters = [];
    for (const key in chapterObject) {
      let metadata = chapterObject[key];

      if (!metadata || metadata === undefined)
        throw new Error("Failed to read metadata. @getChapters() on metadata.");

      for (const groupKey in metadata["groups"]) {
        // Id taken seperately because it's used for error codes.
        const id = chapId(key, groupKey, metadata.folder, result.slug);
        chapters.push(
          createChapter({
            id: id,
            mangaId: result.slug,
            chapNum: chapNum(key, result.slug, id),
            langCode: LanguageCode.ENGLISH,
            name: chapName(metadata.title),
            volume: chapVol(metadata.volume, result.slug, id),
            group: chapGroup(groupObject[groupKey]),
            time: unixToDate(metadata.release_date[groupKey]),
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
    const request = createRequestObject({
      url: HACHIRUMI_API + "/series/" + mangaId,
      method: "GET",
      headers: {
        "accept-encoding": "application/json",
      },
    });

    const response = await this.requestManager.schedule(request, 1);
    const result =
      typeof response.data === "string" || typeof response.data !== "object"
        ? JSON.parse(response.data)
        : response.data;

    if (!result || result === undefined)
      throw new Error(
        "Failed to parse the response. @getChapterDetails() on result."
      );

    const [chapterKey, groupKey, folder] = chapterId.split("|"); // Splits the given generic chapter id to chapterkey and such.
    if (!chapterKey || !groupKey || !folder)
      throw new Error(
        `ChapterId is malformed. @getChapterDetails() on chapterId.split().`
      );

    const chapterObject = result["chapters"];
    if (!chapterObject)
      throw new Error(
        "Failed to read chapter data. @getChapterDetails() on chapterObject."
      );

    const groupObject = chapterObject[chapterKey].groups[groupKey];
    if (!groupObject || groupObject === undefined)
      throw new Error(
        `Failed to read chapter metadata. @getChapterDetails() on groupObject.`
      );

    return createChapterDetails({
      id: chapterId,
      longStrip: false, // Not implemented.
      mangaId: mangaId,
      pages: groupObject.map((ext: string) =>
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
    if (metadata?.limitReached)
      return createPagedResults({
        results: [],
        metadata: { limitReached: true },
      }); // Prevents title duplication.

    const request = createRequestObject({
      url: HACHIRUMI_API + "/get_all_series",
      method: "GET",
      headers: {
        "accept-encoding": "application/json",
      },
    });
    const response = await this.requestManager.schedule(request, 1);
    const result =
      typeof response.data === "string" || typeof response.data !== "object"
        ? JSON.parse(response.data)
        : response.data;

    if (!result || result === undefined)
      throw new Error(
        "Failed to parse the response. @searchRequest() on result."
      );

    // Checks for the query title and pushes it to lowercase.
    const queryTitle: string = query.title ? query.title.toLowerCase() : "";

    // Takes the response array and checks for titles that matches the query string.
    const filterer = (titles: object[]) =>
      Object.keys(titles).filter((title) =>
        title.replace("-", " ").toLowerCase().includes(queryTitle)
      );

    const filteredRequest = filterer(result).map((title) => {
      const metadata = result[title];

      if (!metadata || metadata === undefined)
        throw new Error(
          "Failed to read chapter metadata. @searchRequest() on metadata."
        );

      return createMangaTile({
        id: metadata.slug,
        image: HACHIRUMI_DOMAIN + metadata.cover,
        title: createIconText({ text: title }),
      });
    });

    return createPagedResults({
      results: filteredRequest,
      metadata: {
        limitReached: true,
      },
    });
  }
}
