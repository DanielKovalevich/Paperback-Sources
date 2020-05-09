var tsify = require('tsify')
var browserify = require('browserify')

var source = require('vinyl-source-stream')
var streamify = require('gulp-streamify')
var uglify = require('gulp-uglify')
var rename = require('gulp-rename')
var gulp = require('gulp')

//requiring path and fs modules
const path = require('path')
const fs = require('fs')

const bundleSources = async function () {
    //joining path of directory
    const directoryPath = path.join(__dirname, 'src/sources')
    const destDir = './bundles'

    // If the bundles directory does not exist, create it here
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir)
    }

    var promises = []

    var bundleThis = function (srcArray) {
        for (let file of srcArray) {
            let filePath = file

            // If its a directory
            if (
                !fs.statSync(path.join(directoryPath, filePath)).isDirectory()
            ) {
                console.log('Not a directory, skipping ' + filePath)
                continue
            }

            let finalPath = path.join(directoryPath, filePath, `/${file}.ts`)

            if (!fs.existsSync(finalPath)) {
                console.log("The file doesn't exist, skipping. " + filePath)
                continue
            }

            promises.push(
                new Promise((res, rej) => {
                    browserify([finalPath], { standalone: 'Sources' })
                        .plugin(tsify, { noImplicitAny: true })
                        .bundle()
                        .pipe(source('source.js'))
                        .pipe(gulp.dest(path.join(destDir, file)))
                        .on('end', () => {
                            copyFolderRecursive(
                                path.join(directoryPath, filePath, 'includes'),
                                path.join(destDir, file)
                            )

                            res()
                        })
                })
            )
        }
    }

    const bundlesPath = path.join(__dirname, 'bundles')

    deleteFolderRecursive(bundlesPath)
    bundleThis(fs.readdirSync(directoryPath))

    await Promise.all(promises) //.then(function () { done() })
}

const generateVersioningFile = async function () {
    let jsonObject = {
        buildTime: new Date(),
        sources: []
    }

    //joining path of directory
    const directoryPath = path.join(__dirname, 'bundles')
    var promises = []

    var generateSourceList = function (srcArray) {
        for (let sourceId of srcArray) {
            // If its a directory
            if (!fs.statSync(path.join(directoryPath, sourceId)).isDirectory()) {
                console.log('not a Directory, skipping ' + sourceId)
                return
            }

            let finalPath = `./bundles/${sourceId}/source.js`

            promises.push(
                new Promise((res, rej) => {
                    let req = require(finalPath)
                    let extension = req[sourceId]

                    let classInstance = new extension(null)

                    // make sure the icon is present in the includes folder.
                    if (!fs.existsSync(path.join(directoryPath, sourceId, 'includes', classInstance.icon))) {
                        console.log('[ERROR] [' + sourceId + '] Icon must be inside the includes folder')
                        rej()
                        return
                    }

                    jsonObject.sources.push({
                        id: sourceId,
                        name: classInstance.name,
                        author: classInstance.author,
                        desc: classInstance.description,
                        website: classInstance.authorWebsite,
                        version: classInstance.version,
                        icon: classInstance.icon
                    })

                    res()
                })
            )
        }
    }

    generateSourceList(fs.readdirSync(directoryPath))
    await Promise.all(promises)

    // Write the JSON payload to file
    fs.writeFileSync(
        path.join(directoryPath, 'versioning.json'),
        JSON.stringify(jsonObject)
    )
}

const deleteFolderRecursive = function (folderPath) {
    folderPath = folderPath.trim()
    if (folderPath.length == 0 || folderPath === '/') return

    if (fs.existsSync(folderPath)) {
        fs.readdirSync(folderPath).forEach((file, index) => {
            const curPath = path.join(folderPath, file);
            if (fs.lstatSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(folderPath);
    }
};

const copyFolderRecursive = function (source, target) {
    source = source.trim()
    if (source.length == 0 || source === '/') return

    target = target.trim()
    if (target.length == 0 || target === '/') return

    if (!fs.existsSync(source)) return

    var files = [];
    //check if folder needs to be created or integrated
    var targetFolder = path.join(target, path.basename(source));
    if (!fs.existsSync(targetFolder)) {
        fs.mkdirSync(targetFolder);
    }

    //copy
    if (fs.lstatSync(source).isDirectory()) {
        files = fs.readdirSync(source);
        files.forEach(function (file) {
            var curSource = path.join(source, file);
            if (fs.lstatSync(curSource).isDirectory()) {
                copyFolderRecursive(curSource, targetFolder);
            } else {
                fs.copyFileSync(curSource, path.join(targetFolder, file));
            }
        });
    }
}

// exports.bundle = bundleSources
exports.bundle = gulp.series(bundleSources, generateVersioningFile)
