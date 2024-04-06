const moduleName = "Matchmaker";

const {SlashCommandBuilder, SlashCommandSubcommandGroupBuilder} = require('discord.js');
const config = require("../config.json");
const sql = require("../bot").sql;

Object.prototype.prepare = function() {return sql.escape(JSON.stringify(this) || "{}");};
String.prototype.prepare = function() {return sql.escape(this || "");};
var debug = function(data) {console.debug(`[${moduleName}][Debug]`, data);};
var log = function(data) {console.log(`[${moduleName}]`, data);};

module.exports = {
    info: {name: moduleName},
    data: new SlashCommandBuilder()
    .setDefaultMemberPermissions(0)
    .setName("matchmaker")
    .setDescription("Get a group together to play!")
    .addSubcommandGroup(subcommandgroup => 
        subcommandgroup.setName("setup")
        .setDescription("Setup your profile so others can find you!")
        .addSubcommand(subcommand => 
            subcommand.setName("overwatch")
            .setDescription("Setup your overwatch profile")
            .addStringOption(option => 
                option.setName("tank_player")
                .setDescription("Do you play tank?")
                .addChoices(
                    { name: "Yes", value: "1" },
                    { name: "No", value: "0" }
                )
                .setRequired(true)
            ).addStringOption(option => 
                option.setName("dps_player")
                .setDescription("Do you play DPS?")
                .addChoices(
                    { name: "Yes", value: "1" },
                    { name: "No", value: "0" }
                )
                .setRequired(true)
            ).addStringOption(option => 
                option.setName("support_player")
                .setDescription("Do you play support?")
                .addChoices(
                    { name: "Yes", value: "1" },
                    { name: "No", value: "0" }
                )
                .setRequired(true)
            ).addStringOption(option => 
                option.setName("offline_notfications")
                .setDescription("Do you want to be notified of possible matches while you are not playing?")
                .addChoices(
                    { name: "Yes", value: "1" },
                    { name: "No", value: "0" }
                )
                .setRequired(true)
            ).addStringOption(option =>
                option.setName("battletag")
                .setDescription("What is your full Battle.Net username?")
                .setRequired(true)
            )
        )
    ),
    async execute(interaction) {

    }
} 