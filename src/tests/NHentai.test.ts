import { Source } from "../sources/Source"
import cheerio from 'cheerio'
import { APIWrapper } from "../API"
import { NHentai } from "../sources/NHentai/NHentai";

describe('N-Hentai Tests', function () {

    var wrapper: APIWrapper = new APIWrapper();
    var source: Source = new NHentai(cheerio);
    var chai = require('chai'), expect = chai.expect, should = chai.should();
    var chaiAsPromised = require('chai-as-promised');
    chai.use(chaiAsPromised);

    /**
     * The Manga ID which this unit test uses to base it's details off of.
     * Try to choose a manga which is updated frequently, so that the historical checking test can 
     * return proper results, as it is limited to searching 30 days back due to extremely long processing times otherwise.
     */
    var hentaiId = "312468";  // Lol, it's actually called this in the href? Apparently.

    it("Retrieve Manga Details", async () => {
        let details = await wrapper.getMangaDetails(source, [hentaiId]);
        expect(details, "No results found with test-defined ID [" + hentaiId + "]").to.be.an('array');
        expect(details).to.not.have.lengthOf(0, "Empty response from server");

        // Validate that the fields are filled - Note that there are no artists on Manganelo that I can tell
        let data = details[0];
        expect(data.id, "Missing ID").to.be.not.empty;
        expect(data.image, "Missing Image").to.be.not.empty;
        expect(data.artist, "Missing Artist").to.be.not.empty;
        expect(data.hentai, "Missing Hentai").to.exist
    });

    it("Get Chapters", async () => {
        let data = await wrapper.getChapters(source, hentaiId);
        expect(data, "No chapters present for: [" + hentaiId + "]").to.not.be.empty;
    });

    it("Get Chapter Details", async () => {

        let chapters = await wrapper.getChapters(source, hentaiId);
        let data = await wrapper.getChapterDetails(source, hentaiId, chapters[0].id);

        expect(data, "No server response").to.exist;
        expect(data, "Empty server response").to.not.be.empty;

        expect(data.id, "Missing ID").to.be.not.empty;
        expect(data.mangaId, "Missing hentaiId").to.be.not.empty;
        expect(data.pages, "No pages present").to.be.not.empty;
    });

    it("Searching for Manga With Valid Tags", async () => {
        let testSearch = createSearchRequest({
            title: 'female',
            includeContent: ['bikini'],
            excludeContent: ['sole female']
        });

        let search = await wrapper.search(source, testSearch, 1);
        let result = search[0];

        expect(result, "No response from server").to.exist;

        expect(result.id, "No ID found for search query").to.be.not.empty;
        expect(result.image, "No image found for search").to.be.not.empty;
        expect(result.title, "No title").to.be.not.null;
        expect(result.subtitleText, "No subtitle text").to.be.not.null;
        expect(result.primaryText, "No primary text").to.be.not.null;
        expect(result.secondaryText, "No secondary text").to.be.not.null;

    });

    it("Searching for Manga With A Valid six-digit query", async () => {
        let testSearch = createSearchRequest({
            title: '312483',
        });

        let search = await wrapper.search(source, testSearch, 1);
        let result = search[0];
        expect(result).to.exist

        expect(result.id).to.exist
        expect(result.image).to.exist
        expect(result.title).to.exist
    });

    it("Searching for Manga With an invalid six-digit query", async () => {
        let testSearch = createSearchRequest({
            title: '999999',
        });

        let search = await wrapper.search(source, testSearch, 1);
        let result = search[0];
        expect(result).to.not.exist;    // There should be no entries with this tag!
    });

    it("Searching for Manga With Invalid Tags", async () => {
        let testSearch = createSearchRequest({
            title: 'Ratiaion House',
            excludeDemographic: ['Seinen']
        });

        let search = await wrapper.search(source, testSearch, 1);
        let result = search[0];
        expect(result).to.not.exist;    // There should be no entries with this tag!
    });


    it("Searching for Manga by artist", async() => {
        let testSearch = createSearchRequest({
            artist: 'shiraichigo'
        })

        let search = await wrapper.search(source, testSearch, 1)
        let result = search[0]
        expect(result).to.exist
    })

    it("Searching for Manga by invalid artist", async() => {
        let testSearch = createSearchRequest({
            artist: 'Daniel Kovalevich'
        })

        let search = await wrapper.search(source, testSearch, 1)
        let result = search[0]

        expect(result).to.not.exist
    })


    it("Retrieve Home Page Sections", async () => {

        let data = await wrapper.getHomePageSections(source);
        expect(data, "No response from server").to.exist;
        expect(data, "No response from server").to.be.not.empty;

        let newHentai = data[0];
        expect(newHentai.id, "Popular Titles ID does not exist").to.not.be.empty;
        expect(newHentai.title, "Popular manga section does not exist").to.not.be.empty;
        expect(newHentai.items, "No items available for popular titles").to.not.be.empty;
    });

    it("Retrieve Tags", async() => {
        let data = await wrapper.getTags(source)
        expect(data, "No response from server").to.exist
        expect(data[0].tags).to.not.be.empty
        
    })
});