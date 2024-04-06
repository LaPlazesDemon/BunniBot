const moduleName = "";

const {SlashCommandBuilder, EmbedBuilder} = require('discord.js');
const config = require("../config.json");
const sql = require("../bot").sql;

Object.prototype.prepare = function() {return sql.escape(JSON.stringify(this) || "{}");};
String.prototype.prepare = function() {return sql.escape(this || "");};
var debug = function(data) {console.debug(`[${moduleName}][Debug]`, data);};
var log = function(data) {console.log(`[${moduleName}]`, data);};

module.exports = {
    info: {name: moduleName},
    data: new SlashCommandBuilder()
    .setName("nicknames")
    .setDescription("Get the nickname history for a user")
    .addUserOption(option =>
        option.setName("user")
        .setDescription("Target User")
        .setRequired(true)
    ),
    async execute(interaction) {

        var targetuser = interaction.options.getUser("user");
        var targetmember = interaction.guild.members.cache.get(targetuser.id);

        sql.query(`SELECT DISTINCT nickname, uid FROM nicknameHistorian WHERE uid = ${targetuser.id};`, (err, results) => {
            if (err) {
                interaction.reply({content: "There was an error fetching the results", ephemeral: true});
            } else {

                var nicknames = [...results].map(result => result.nickname);
                var nicknamesText = `**Nickname History of ${targetuser.username}**\n- ${nicknames.join("\n- ")}\n\n**Total Number of Nicknames:** ${nicknames.length}`;

                var embed = new EmbedBuilder()
                .setColor(targetmember.roles.highest.color)
                .setDescription(nicknamesText)
                .setThumbnail(targetuser.avatarURL())
                .setTimestamp()
                .setFooter({text: `${targetuser.username} | Nickname History`, iconURL: targetuser.avatarURL()});

                interaction.reply({embeds: [embed]});
            }
        })
    }
} 