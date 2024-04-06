const moduleName = "New Member Handler";

const {Events} = require('discord.js');
const config = require("../config.json");
const sql = require("../bot").sql;

var debug = function(data) {console.log(`[${moduleName}][Debug]`, data);};
var log = function(data) {console.log(`[${moduleName}]`, data);};

module.exports = {
    info: {name: moduleName},
    startModule: (bot) => {
        bot.on(Events.GuildMemberAdd, member => {
            member.roles.add(config.discord.roles.member);
        });
    }
} 