const https = require('https');
const fs = require('fs');
const xml2js = require('xml2js');

const MAVEN_URL = "https://dl.google.com/android/maven2";
const MASTER_XML = "master-index.xml";
const GROUP_XML = "group-index.xml";
const ROOT_DIR = "google_maven";
const INSPECTOR = "/";
const FILENAME_INSPECTOR = "-";

let xmlParser = new xml2js.Parser();

function makeDirectory(directory) {
    if (fs.existsSync(directory))
        fs.rmSync(directory, {recursive: true, force: true});
    fs.mkdirSync(directory);    
}

async function getRemoteFile(file, url) {
    return new Promise((resolve, reject) => {
        const request = https.get(url, function(response) {
            if (response.statusCode == 200) {
                let localFile = fs.createWriteStream(file);
                response.pipe(localFile);
                response.on('error', function(err) {
                    console.log("file download error");
                    resolve({
                        status: false,
                        result: false,
                    });
                })
                localFile.on('finish', function() {
                    localFile.close();
                    resolve({
                        status: true,
                        result: true,
                    });
                })
            }
            else {
                response.resume();
                resolve({
                    status: true,
                    result: false,
                });
            }
        })
        .on('error', function(e) {
            console.log(e);
            resolve({
                status: false,
                result: false,
            });
        });
        request.end();
    });    
}

async function getRemoteFileReliable(file, url) {
    let ret = {};
    do {
        ret = await getRemoteFile(file, url);        
    } while (ret.status == false);    
    return ret.result;
}

async function getMasterIndex() {
    makeDirectory(ROOT_DIR);

    let fileName = ROOT_DIR + INSPECTOR + MASTER_XML;
    let indexURL = MAVEN_URL + INSPECTOR + MASTER_XML;
    let result = await getRemoteFileReliable(fileName, indexURL);
    if (result == true)
        await parseMasterIndex(fileName);
    console.log("--------DOWNLOAD END------------");
}

async function parseMasterIndex(fileName) {
    try {
        let dump = fs.readFileSync(fileName, 'utf8');
        let xmls = await xmlParser.parseStringPromise(dump);
        let keys = Object.keys(xmls.metadata);
        // keys = [keys[0]];
        // keys = ["androidx.appsearch"];
        for (let i = 0 ; i < keys.length; i ++) {
            let key = keys[i];
            let groupDirectory = ROOT_DIR + INSPECTOR + key;
            makeDirectory(groupDirectory);
            await getGroupIndex(groupDirectory, key);
        }
        fs.rmSync(fileName);
    } catch (error) {
        console.log(error);
    }
}

async function getGroupIndex(groupDirectory, package) {
    let fileName = groupDirectory + INSPECTOR + GROUP_XML;
    let groupURL = MAVEN_URL + INSPECTOR + package.replace(/\./g, '/');
    let groupIndexURL = groupURL + INSPECTOR + GROUP_XML;
    let result = await getRemoteFileReliable(fileName, groupIndexURL)
    if (result == true)
        await parseGroupIndex(groupDirectory, fileName, package, groupURL);
}

async function parseGroupIndex(groupDirectory, fileName, package, groupURL) {
    try {
        let dump = fs.readFileSync(fileName, 'utf8');
        let xmls = await xmlParser.parseStringPromise(dump)
        let keys = Object.keys(xmls[package]);
        // keys = [keys[0]];        
        // keys = ["appsearch"];
        for (let i = 0; i < keys.length; i ++ ){
            let key = keys[i];
            let artifactsDirectory = groupDirectory + INSPECTOR + key;
            let artifactsURL = groupURL + INSPECTOR + key;
            makeDirectory(artifactsDirectory);
            await getArtifacts(artifactsDirectory, xmls[package][key][0].$.versions, artifactsURL, key);

        }
        fs.rmSync(fileName);        
    } catch (error) {
        console.log(error);
    }
}

async function getArtifacts(artifactsDirectory, version, artifactsURL, groupName) {
    let versions = version.split(",");
    for (let i = 0; i < versions.length; i ++) {
        let v = versions[i];
        let versionDirectory = artifactsDirectory + INSPECTOR + v;
        makeDirectory(versionDirectory);
        
        let versionURL = artifactsURL + INSPECTOR + v;
        let metaData = await getMetaData(versionDirectory, versionURL, groupName, v);

        console.log("Donwload Artifacts ------", groupName, v);
        for (let j = 0; j < metaData.artifacts.length; j ++) {
            let artifact = metaData.artifacts[j];
            downloadArtifact(versionDirectory, versionURL, artifact.name)
        }
    }
}

async function getMetaData(versionDirectory, versionURL, groupName, version) {
    let jsonFileName = "artifact-metadata.json";
    let metaDirectory = versionDirectory + INSPECTOR + jsonFileName;
    let metaURL = versionURL + INSPECTOR + jsonFileName;
    let result = await getRemoteFileReliable(metaDirectory, metaURL)
    if (result == true) {
        let dump = fs.readFileSync(metaDirectory, 'utf8');
        fs.rmSync(metaDirectory);
        return JSON.parse(dump);
    }
    else {
        return {
            "artifacts":[
                {"name": groupName + "-" + version + ".pom", "tag": "pom"},
                {"name": groupName + "-" + version + ".aar", "tag": "aar"},
            ]};
    }
}

async function downloadArtifact(versionDirectory, versionURL, artifactName) {
    let artifaceDirectory = versionDirectory + INSPECTOR + artifactName;
    let metaDirectory = versionURL + INSPECTOR + artifactName;
    let result = await getRemoteFileReliable(artifaceDirectory, metaDirectory);
}



getMasterIndex();