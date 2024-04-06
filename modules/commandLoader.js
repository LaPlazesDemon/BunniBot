const fs = require("fs");
const path = require("path");
const config = require("../config.json");
const sql = require('../bot').sql;
const token = config.discord.token;
const appid = config.discord.appID;
const guild_id = config.discord.guildID;
const {Collection, REST, Routes, Events} = require("discord.js");

module.exports.info = {name: "Command Loader"};
module.exports.startModule = (bot) => {
    bot.commands = new Collection();

    const commands = [];
    const commandsPath = path.join(__dirname, '../commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            bot.commands.set(command.data.name, command);
            commands.push(command.data.toJSON());
        } else {
            console.log(`[Command Loader][WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }

    // Construct and prepare an instance of the REST module
    const rest = new REST().setToken(token);

    (async () => {
        try {    
            // The put method is used to fully refresh all commands in the guild with the current set
            const data = await rest.put(
                Routes.applicationGuildCommands(appid, guild_id),
                { body: commands },
            );
    
            console.log(`[Command Loader] Successfully loaded ${data.length} application commands.`);
        } catch (error) {
            console.error(error)
        }
    })();
    


    bot.on(Events.InteractionCreate, async interaction => {
        if (!interaction.isChatInputCommand()) return;
    
        const command = interaction.client.commands.get(interaction.commandName);
        
        if (!command) return;
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
        }
    });

}