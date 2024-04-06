const moduleName = "VC Time Tracker";

const {Channel} = require('discord.js');
const config = require("../config.json");
const sql = require("../bot").sql;

var debug = function(data) {console.log(`[${moduleName}][Debug]`, data);};
var log = function(data) {console.log(`[${moduleName}]`, data);};

module.exports = {
    info: {name: moduleName},
    startModule: (bot) => {

        setInterval(async () => {

            var vcMembers = [];
            var guild = await bot.guilds.fetch(config.discord.guildID);
            var channels = await guild.channels.fetch();
   
            channels.each(channel => {if (channel.type == 2) channel.members.forEach(member => {sql.query(`UPDATE geUserStats SET vcTime = vcTime + 1 WHERE uid = ${member.id};`)})});

        }, 60000) // Check every minute
        
    }
} 