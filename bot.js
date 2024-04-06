const {Client, GatewayIntentBits, Events, Partials, ActivityType, Collection, REST} = require('discord.js');
var mysql = require('mysql');
var path = require("path");
var fs = require("fs");
var config = require("./config.json");
var axios = require('axios');

var prepareStr = function(string) {return sql.escape(string || "");};
var debug = function(data) {console.debug(`[Bot][Debug]`, data);};
var log = function(data) {console.log(`[Bot]`, data);};

// SQL Server Connections

var sql = mysql.createConnection({
    user: config.sql.user,
    password: config.sql.pass,
    database: config.sql.schema,
    host: config.sql.uri,
    charset: 'utf8mb4'
});

sql.connect(function(err) {
    console.log("[Bot] MySQL Server Connection Successful")
});

sql.on('error', function (err) {
    console.log("[Bot] MySQL server connection lost reconnecting")
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        sql.connect();
    } else {
        throw err;
    }
});

// Discord Bot Auth and Initiation

var bot = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.Reaction,
        Partials.User
    ]
});

bot.login(config.discord.token);

bot.on(Events.ClientReady, async function() {
    
    console.info(`[Bot] Logged in as ${bot.user.tag}!`);
    bot.user.setPresence({
        status: "Online"
    });

    // bot.guilds.cache.get(config.discord.guildID).emojis.cache.forEach((emote) => {
    //     console.log(`<${emote.name}:${emote.id}>`);
    // });

    await getTwitchAuthToken();
    await getSpotifyAuthToken();

    // MODULE LOADER

    var moduleCount = 0;
    var moduleErrors = 0;
    var modulesPath = path.join(__dirname, 'modules');
    var moduleFiles = fs.readdirSync(modulesPath, {recursive: true}).filter(file => file.endsWith('.js'));

    console.log("[Module Loader] Finding Modules");

    for (const file of moduleFiles) {
        var filePath = path.join(modulesPath, file);
        var botModule = require(filePath)
        console.log(`[Module Loader] Starting ${botModule.info.name} Module`);
        try {
            botModule.startModule(bot);
            moduleCount += 1;
        } catch (err) {
            debug(err);
            moduleErrors += 1;
        }
        
    }

    console.log(`[Module Loader] Successfully loaded ${moduleCount} module(s)`); 
    if (moduleErrors) {console.log(`[Module Loader] ${moduleErrors} module(s) failed to load`);}
    
});


module.exports.sql = sql;
module.exports.bot = bot;

function restPost(url, options) {
    return new Promise((resolve, reject) => {
        axios.post(url, options.data, { headers: options.headers })
        .then((response) => {
            resolve(response.data);
        })
        .catch((error) => {
            reject(error);
        });
    });
}


async function getTwitchAuthToken() {
    try {
        const data = await restPost("https://id.twitch.tv/oauth2/token", {
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            data: `client_id=${config.twitch.credentials.clientID}&client_secret=${config.twitch.credentials.clientKey}&grant_type=client_credentials`
        });
        
        log(`Twitch Token acquired, expires in ${Math.floor(data.expires_in / 60000)} minutes`);
        process.env.twitchToken = data.access_token;

        // Schedule the next token refresh every hour
        setTimeout(getTwitchAuthToken, 3600000);
        
    } catch (err) {
        log(`Error getting Twitch access token`);
    }
}


async function getSpotifyAuthToken() {

    try {
        const requestData = {
            grant_type: 'refresh_token',
            refresh_token: config.spotify.refreshToken,
            scope: config.spotify.scopes.join(" ")
        }

        const data = await restPost("https://accounts.spotify.com/api/token", {
            data: new URLSearchParams(requestData),
            headers: {
                'Authorization': `Basic ${Buffer.from(`${config.spotify.clientId}:${config.spotify.key}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        log (`Spotify token refreshed`)
        process.env.spotifyToken = data.access_token;

        // Schedule the next token refresh every 50 minutes
        setTimeout(getSpotifyAuthToken, 3000000);
    } catch (err) {
        log(`Error getting Spotify access token`);
    }
}