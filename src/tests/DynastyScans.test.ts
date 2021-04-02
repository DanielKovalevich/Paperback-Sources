import cheerio from "cheerio";
import {DynastyScans} from "../DynastyScans/DynastyScans";
import {APIWrapper, Source} from "paperback-extensions-common";

describe("DynastyScans Tests", function () {
    let wrapper: APIWrapper = new APIWrapper();
    let source: Source = new DynastyScans(cheerio);
    let chai = require("chai"),
        expect = chai.expect;
    let chaiAsPromised = require("chai-as-promised");
    chai.use(chaiAsPromised);

    let mangaId = "series/1_x";

    it("Retrieve Manga Details", async () => {
        let details = await wrapper.getMangaDetails(source, mangaId);
        expect(
            details,
            "No results found with test-defined ID [" + mangaId + "]"
        ).to.exist;

        // Validate that the fields are filled
        let data = details;
        expect(data.id, "Missing ID").to.be.not.empty;
        expect(data.image, "Missing Image").to.exist;
        expect(data.status, "Missing Status").to.exist;
        expect(data.titles, "Missing Titles").to.be.not.empty;
        expect(data.rating, "Missing Rating").to.exist;
        expect(data.author, "Missing Author").to.be.not.empty;
        expect(data.desc, "Missing Description").to.exist;
        expect(data.lastUpdate, "Missing Last Update").to.be.not.empty;
    });

    it("Get Chapters", async () => {
        let data = await wrapper.getChapters(source, mangaId);

        expect(data, "No chapters present for: [" + mangaId + "]").to.not.be.empty;

        let entry = data[0];
        expect(entry.id, "No ID present").to.not.be.empty;
        expect(entry.chapNum, "No chapter number present").to.exist;
        expect(entry.time, "No time present").to.be.a("date");
    });

    it("Get Chapter Details", async () => {
        let chapters = await wrapper.getChapters(source, mangaId);
        let data = await wrapper.getChapterDetails(source, mangaId, chapters[0].id);

        expect(data, "Empty server response").to.not.be.empty;

        expect(data.id, "Missing ID").to.be.not.empty;
        expect(data.mangaId, "Missing MangaID").to.be.not.empty;
        expect(data.pages, "No pages present").to.be.not.empty;
    });

    it("Testing search", async () => {
        let testSearch = createSearchRequest({
            title: "twin",
        });

        let search = await wrapper.searchRequest(source, testSearch);
        let result = search.results[0];

        expect(result, "No response from server").to.exist;

        expect(result.id, "No ID found for search query").to.be.not.empty;
        expect(result.title, "No title").to.be.not.empty;
    });

    it("Testing Home Page", async () => {
        let result = await wrapper.getHomePageSections(source);
        expect(result, "No response from server").to.exist;
        let item = result[0];
        expect(item, "Empty response from server").to.exist;
        if (item.items) {
            let subitem = item.items[0];

            expect(subitem.id, "No ID found for homepage item").to.not.be.empty;
            expect(subitem.title, "No Title found for homepage item").to.not.be.empty;
            expect(subitem.image, "No Image found for homepage item").to.not.be.empty;
        }
    })

    it("Testing Manga Directory", async () => {
        let result = await wrapper.getWebsiteMangaDirectory(source, null);
        expect(result, "No response from server").to.exist;
        if (result){
        let item = result.results[0];
        expect(item, "Empty response from server").to.exist;
        if (item) {
            expect(item.id, "No ID found for directory item").to.not.be.empty;
            expect(item.title, "No Title found for directory item").to.not.be.empty;
            expect(item.image, "No Image found for directory item").to.not.be.empty;
        }
    }})
});