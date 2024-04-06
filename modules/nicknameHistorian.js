const moduleName = "Nickname Historian";

const { Events } = require('discord.js');
const config = require("../config.json");
const sql = require("../bot").sql;
;
var debug = function(data) {console.log(`[${moduleName}][Debug]`, data);};
var log = function(data) {console.log(`[${moduleName}]`, data);};

module.exports = {
    info: {name: moduleName},
    startModule: (bot) => {
        bot.on(Events.GuildMemberUpdate, (oldMember, newMember) => {
            if (oldMember.nickname !== newMember.nickname) {
                sql.query(`INSERT INTO nicknameHistorian (uid, nickname) VALUES
                (?, ?);`,
                [newMember.id, newMember.nickname]);
            }
        })
    }
} 