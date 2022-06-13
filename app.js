// Static constants
const API_KEY = "6so21vQXnV7kqdWx8g1mI7VAbKEoP8CN5GCYZzfW";
const BASE_URL = "https://prod-rawstats.riotesports.com/val/v2";
const TEST_GAME_ID = "val_279e47e0-5a3d-4823-9387-b9870aff5975";

// Imports
const axios = require('axios');
const Mutex = require('async-mutex').Mutex;
const http = require('http');

// Global constants
const mutex = new Mutex();
const instance = axios.create({
    baseURL: BASE_URL,
    timeout: 7500,
    headers: {
        'x-api-key': API_KEY
    }
});

// Global variables
let pageToken = "";
let pageInterval = undefined;
let gameid = "";
let data = undefined;

// Client REST API Section
const server = http.createServer((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/json'});
    res.write(JSON.stringify(data, null, null));
    res.end();
});
server.listen(8080);

// Valorant API Section
async function findMyGame(playerName) {
    // TODO: Iterate thru pages of games to check all pages like getLatestPage() -- currently only checks the first page!
    let result = undefined;

    let res = await instance.get('/listPlatformGames/in_progress');
    let games = res.data.platformGames;
    games.forEach((game) => {
        game.participants.forEach((participant) => {
            if(participant.displayName.toLowerCase().trim() === playerName.toLowerCase().trim()) {
                result = game.platformGameId;
            }
        });
    });

    return result;
}

async function getLatestPage(firstTime) {
    if(firstTime) {
        let first = await instance.get(`/platformGames/${TEST_GAME_ID}/events`);
        let currPageToken = first.data.nextPageToken;
        let prevPageToken = "";
        
        while((currPageToken != undefined) && (currPageToken != prevPageToken)) {
            let res = await instance.get(`/platformGames/${TEST_GAME_ID}/events?paginationToken=${currPageToken}`);
            prevPageToken = currPageToken;
            currPageToken = res.data.nextPageToken;
            if(currPageToken == undefined) {
                console.log("Last page found: " + prevPageToken);
            } else {
                console.log("Detected Next Page: ");
                console.log("  Curr: ", currPageToken);
                console.log("  Prev: ", prevPageToken, "\n");
            }
        }
        
        if(currPageToken == undefined) {
            pageToken = prevPageToken;
        }

        pageInterval = setInterval(getLatestPage, 2000, false);
    } else {
        const release = await mutex.acquire();
        console.log("Polling for updated page...");
        let currPageToken = pageToken;
        let prevPageToken = "";
        while(currPageToken != undefined) {
            let res = await instance.get(`/platformGames/${TEST_GAME_ID}/events?paginationToken=${currPageToken}`);
            prevPageToken = currPageToken;
            currPageToken = res.data.nextPageToken;

            if(currPageToken == undefined && prevPageToken == pageToken) {
                console.log("No new page detected, sending same page...\n");
            } else if (currPageToken == undefined) {
                console.log("New last page found: " + prevPageToken);
            } else {
                console.log("Detected Next Page: ");
                console.log("Curr: ", currPageToken);
                console.log("Prev: ", prevPageToken, "\n");
            }
        }

        if(currPageToken == undefined) {
            pageToken = prevPageToken;
        }

        release();
    }
    await getCurrData();
}

async function getCurrData() {
    if(pageToken) {
        let res = await instance.get(`platformGames/${TEST_GAME_ID}/events?pageinationToken=${pageToken}`);
        data = res.data.events;
    }
}

// Debug function, call to get events list output
function TESTevents() {
    instance.get(`/platformGames/${TEST_GAME_ID}/events`).then((response) => {
        console.log(response.data);

        let data = response.data.events;
        data.forEach((event) => {
            if(event.snapshot) {
                //console.log(event.metadata.sequenceNumber, event.snapshot);
            } else if (event.configuration) {
                console.log(event.metadata.sequenceNumber, event.configuration);
            }
        });
    });
}

// Debug function, call to get match list output
function TESTlist() {
    instance.get(`/platformGames/in_progress`).then((response) => {
        console.log(response.data.platformGames[0]);
    });
}

//TESTlist();
//TESTevents();
getLatestPage(true);