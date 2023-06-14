import sailthru_client from "sailthru-client";
import dotenv from "dotenv";
import kleur from 'kleur';
import fs from 'fs';
import * as EmailValidator from 'email-validator';
import prompts from 'prompts'
import chokidar from 'chokidar'
import minimist from 'minimist'


const argv = minimist(process.argv.slice(2));

// set environment variables based on command line argument
const env = argv.env ? argv.env.toLowerCase() : '';

// load environment variables from .env file based on environment
switch (env) {
  case (env):
    dotenv.config({ path: `./${env}.env` });
    break
  default:
    dotenv.config({ path: '.env' });
    break
}

// if a template's length is smaller than this, it's considered tiny and will throw a warning
const tinyTemplateThreshold = 100;

const SAILTHRU_API_KEY = process.env.SAILTHRU_API_KEY;
const SAILTHRU_API_SECRET = process.env.SAILTHRU_API_SECRET;

if (!SAILTHRU_API_KEY || !SAILTHRU_API_SECRET) {
  console.log(kleur.red("ERROR: Missing API Key or Secret"));
  process.exit(0);
}

var Sailthru = sailthru_client.createSailthruClient(SAILTHRU_API_KEY, SAILTHRU_API_SECRET);

// disable logging
Sailthru.disableLogging();

// add config for email addresses
import config from './config.js'

const emailShorthands = config.emails

let templateJson
let templateNames = [];

(async () => {
  //get template list from SailThru, needed for all commands
  await new Promise(async (resolve, reject) => {
    Sailthru.getTemplates(function(err, response) {
      if (err) {
        reject(kleur.red("ERROR: " + err));
      } else {
        templateJson = JSON.stringify(response);
        response.templates.forEach(template => {
          templateNames.push(template.name);
        });
        resolve(true);
      }
    });
  });

  const response = await getUserCommand();

  handleTemplateCommand(response.templateCommand, {templateJson, templateNames});
})();

  async function getUserCommand() {
    return await prompts([
      {
        type: 'autocomplete',
        name: 'templateCommand',
        message: 'What do you want to do?',
        choices: [
          { title: 'Send SailThru Test', value: 'test' },
          { title: 'Pull SailThru code', value: 'pull'},
          { title: 'Push your code', value: 'push'}
        ]
      }
    ]);
  }

  async function handleTemplateCommand(command, templateInfo) {
    let templateObject
    let shouldWatchFile

    switch (command.toLowerCase()) {
      case "test":
        let recipients = await ask_whichEmailToSendTo()

        templateObject = await ask_whichTemplateToSend(templateInfo, 'Which template would you like to send?')

        sendEmail(templateObject.name, recipients)

        break;
      case "pull":
        // adds option to pull all templates, go 'up' one in the CLI to find this option
        {templateInfo.templateNames.push("ALL TEMPLATES")}

        templateObject = await ask_whichTemplateToSend(templateInfo, 'Which template would you like to pull?')

        if(templateObject.name === "ALL TEMPLATES") {
          let confirmOverwrite = await ask_confirm('WARNING: This will overwrite any existing files in the templates folder of the same name. Continue?')
          shouldWatchFile = await ask_confirm(`Enable file watcher? (push template to SailThru as code updates)`)

          // get all templates
          if(confirmOverwrite){
            templateInfo.templateNames.forEach(templateName => {
              // don't try to get a template named "ALL TEMPLATES"
              if(templateName != "ALL TEMPLATES") { getTemplate(templateName) }
            });
          }
          if (shouldWatchFile) { watchFilesForChanges(templateObject.name) }
        }
        else{
          shouldWatchFile = await ask_confirm(`Enable file watcher? (push template to SailThru as code updates)`)
          getTemplate(templateObject.name)
          if (shouldWatchFile) { watchFilesForChanges(templateObject.name) }
        }

        break;
      case "push":
        let templateNamesOnFile = fs.readdirSync('./templates');


        // filter the files to get only HTML files
        templateNamesOnFile = templateNamesOnFile.filter((file) => {
            return file.endsWith('.html');
        });

        // remove the file extension from the file names
        let trimmedFileNames = templateNamesOnFile.map(fileName => fileName.replace(/\.[^/.]+$/, ""));

        // sort the file names by last modified date
        trimmedFileNames = sortByLastModifiedDate(trimmedFileNames)

        // set the template list to the names of the files in the templates folder
        templateInfo.templateNames = trimmedFileNames;

        // adds option to pushe all templates, go 'up' one in the CLI to find this option
        templateInfo.templateNames.push("ALL TEMPLATES")

        // ask for the template to push and return any existing template info from sailthru
        templateObject = await ask_whichTemplateToSend(templateInfo, 'These files exist in "/templates/". Which template to push?')

        let overwriteConfirmation

        // if the template exists in Sailthru, ask for overwrite confirmation
        if(templateObject.template_id) {
          overwriteConfirmation = await ask_confirm(kleur.red(`Template already exists in SailThru. Confirm overwrite of "${templateObject.name}"?`))

          // if overwrite is not confirmed, exit the program
          if(!overwriteConfirmation) {
            console.log(kleur.red("Push cancelled - Exiting."));
            process.exit(0);
          }
        }


        if (templateObject.name === "ALL TEMPLATES") {
          // push all templates
          templateInfo.templateNames.forEach(async templateName => {
            // don't try to push a template named "ALL TEMPLATES"
            if (templateName != "ALL TEMPLATES") {
              // push the template
              await new Promise(async (resolve, reject) => {
                await pushTemplate(templateName)
                resolve(true)
              });
             }
          });
        }
        else {
          // push the template
          await new Promise(async (resolve, reject) => {
            await pushTemplate(templateObject.name)
            resolve(true)
          });

          shouldWatchFile = await ask_confirm(`Enable file watcher? (push template to SailThru as code updates)`)
          if (shouldWatchFile) { await watchFilesForChanges(templateObject.name) }
        }


        break;
      case "Exit":
        console.log(kleur.red("Exiting"));
        process.exit(0);
        break;
    }
  }

  function sortByLastModifiedDate(files) {
    // create an array to store the file name and last modified date
    const fileData = [];

    // loop through the files and get the last modified date
    files.forEach((file) => {
        const stats = fs.statSync(`./templates/${file}.html`);
        fileData.push({
            name: file,
            date: stats.mtime
        });
    });

    // sort the array by last modified date
    fileData.sort((a, b) => {
      return b.date - a.date;
    });

    return fileData.map(file => file.name);
}

  async function watchFilesForChanges(templateName) {
    const log = console.log.bind(console);

    console.log(kleur.yellow(`Watching: templates/${templateName}.html`));

    // Initialize watcher.
    const watcher = chokidar.watch(`templates/${templateName}.html`, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true
    });

    // Add event listeners.
    watcher
    .on('change', async path => {
      log()
      log(kleur.yellow(`Updated: ${path} --> Pushing to Sailthru...`))

      // Push the template
      await pushTemplate(templateName)
    })
    .on('unlink', path => {
      log(kleur.red(`${path} removed. Shutting down...`))
      process.exit(0);
    });
  }

  async function ask_whichEmailToSendTo() {
    let response = await prompts([
      {
        type: 'text',
        name: 'emails',
        message: `What emails to send to? (separate by comma)`
      }
    ]);
    let emails = removeWhitespace(response.emails)

    emails = emails.split(",");

    emails.forEach(async (email, i) => {
      if (email in emailShorthands) {
        emails[i] = emailShorthands[email]
      }
    });

    // make sure there are emails
    checkIfRecipientsEntered(emails);

    // make sure the emails are valid
    checkIfEmailsAreValid(emails)

    return emails
  }

  function removeWhitespace(string) {
    return string.replace(/\s/g, '');
  }

  function checkIfEmailsAreValid(emails) {
    emails.forEach(email => {
      if(!EmailValidator.validate(email)) {
        console.log(kleur.red(`ERROR: Invalid email: ${email}`));
        process.exit(0);
      }
    });
  }

  function checkIfRecipientsEntered(recipients) {
    if(recipients.length == 0) {
      console.log(kleur.red("ERROR: No valid emails entered"));
      process.exit(0);
    }
  }

  async function ask_whichTemplateToSend(templateInfo, question) {
    let templateJson = JSON.parse(templateInfo.templateJson);

    let answers = await prompts({
      type: 'autocomplete',
      name: 'templateName',
      message: question,
      choices: templateInfo.templateNames.map(name => {
        return {
          title: name,
          value: name
        }
      })
    });

    // Get just the object with the matching template name from the full list
    // if the template doesn't exist, just return the name
    return templateJson.templates.find(item => item.name == answers.templateName) || { name: answers.templateName };
  }

  function sendEmail(templateName, recipients) {
    let options = { "options": { "test": 1 } }
    Sailthru.multiSend(templateName, recipients, options, function(err, response) {
      if (err) {
        console.log(kleur.red("ERROR:"));
        console.log(err);
      } else {
        console.log(kleur.green(`Sent "${templateName}" to ${recipients}`));

        // if dev, log the send id
        env == 'dev' ? console.log(kleur.cyan(`Send id: ${response.send_id}`)) : ''
      }
    });
  }

  async function getTemplate(templateName, userChoice) {
    await Sailthru.getTemplate(templateName, async function(err, response) {
      if (err) {
        console.log(kleur.red("ERROR:"));
        console.log(err);
      } else {
        saveFiles(response, userChoice)
      }
    });
  }

function saveFiles(response, userChoice) {
  if (response.content_html && response.name) {
    const filePath = `./templates/${response.name}.html`;

    // save the file options, without the html
    const fileOptions = response;
    // delete fileOptions.content_html;

    // save the options file to the /options/ folder
    const optionsFilePath = `./options/${response.name}.json`;


    fs.access(filePath, fs.constants.F_OK, async (err) => {
      if (err) {
        // File does not exist, so it can be safely saved
        fs.writeFile(optionsFilePath, JSON.stringify(fileOptions), (err) => {
          if (err) {
            return console.log(err);
          }
          console.log(kleur.green(`Options saved: ${optionsFilePath}`));
        });
        fs.writeFile(filePath, response.content_html, (err) => {
          if (err) {
            return console.log(err);
          }
          console.log(kleur.green(`File saved: ${filePath}`));
        });
      } else {
        let shouldOverwriteFile

        if (userChoice == 'ALL TEMPLATES') {
          shouldOverwriteFile = true
        }
        else {
          shouldOverwriteFile = await ask_confirm(`File already exists: ${filePath}. Overwrite?`)
        }

        if (shouldOverwriteFile) {
          fs.writeFile(optionsFilePath, JSON.stringify(fileOptions), (err) => {
            if (err) {
              return console.log(err);
            }
            console.log(kleur.green(`Options saved: ${optionsFilePath}`));
          });
          fs.writeFile(filePath, response.content_html, (err) => {
            if (err) {
              return console.log(err);
            }
            console.log(kleur.green(`File saved: ${filePath}`));
          });
        }
      }
    });
  }
}

function convertArrayToObject(array) {
  return array.reduce((obj, item) => {
    obj[item] = 1;
    return obj;
  }, {});
}

  async function ask_confirm(message) {
    const answers = await prompts([
      {
        type: 'confirm',
        name: 'overwrite',
        message: message
      }
    ]);

    return answers.overwrite
  }

  // only actually pushes the template if the user confirms, and if the content is different than what's already on Sailthru
  // the diffcheck part happens automatically in the Sailthru API
  async function pushTemplate(templateName) {
    let htmlFileContent = ''

    // todo: update to use promises
    // wait for the template to be properly loaded, but only for 5 seconds
    // not the best way to do this, but it other methods were not working
    let timeout = Date.now() + 5000;
    while (htmlFileContent === '') {
      htmlFileContent = fs.readFileSync(`./templates/${templateName}.html`, 'utf8')
      // Wait for a short period of time before checking again
      await new Promise(resolve => setTimeout(resolve, 250));
      if (Date.now() > timeout) {
        console.log(kleur.redBright("Error: No content found after 5 seconds, canceling push."));
        return
      }
    }

    // check if the template is tiny to prevent accidental pushes
    if(await htmlContentIsTiny(htmlFileContent)) {
      if(!(await ask_confirm(`Template is tiny(less than ${tinyTemplateThreshold}). Are you sure you want to push?`))) {
        console.log(kleur.redBright(`Error: template is less than ${tinyTemplateThreshold}, canceling push.`));
        return
      }
    }

    let options = {}

    try {
      let optionsFile = fs.readFileSync(`./options/${templateName}.json`, 'utf8');

      // if the template is a visual template, remove the revisions
      if (JSON.parse(optionsFile).mode == 'visual_email') {
        // from emails and reply to emails must be pre-existing in Sailthru or this will fail silently
        let labels = JSON.parse(optionsFile).labels

        options = {
          name: templateName,
          public_name: templateName,
          from_name: fromName,
          from_email: fromEmail,
          replyto_email: JSON.parse(optionsFile).replyto_email,
          subject: JSON.parse(optionsFile).subject,
          sample: JSON.parse(optionsFile).sample,
          preheader: JSON.parse(optionsFile).preheader,
          setup: JSON.parse(optionsFile).setup,
          labels: convertArrayToObject(labels),
          tags: JSON.parse(optionsFile).tags,
          is_basic: JSON.parse(optionsFile).is_basic,
          link_params: JSON.parse(optionsFile).link_params,
          is_link_tracking: JSON.parse(optionsFile).is_link_tracking,
          content_html: htmlFileContent,
          content_text: '',
          content_json: JSON.parse(optionsFile).content_json,
          mode: 'visual_email'
        }
      }
      else {
        options.content_html = htmlFileContent;
      }
    }
    catch (err) {
      options.content_html = htmlFileContent;
    }

    await new Promise(async (resolve, reject) => {
      // Save the template in Sailthru
      Sailthru.saveTemplate(templateName, options, function(err, response) {
        if (err) {
          console.log(kleur.red("ERROR:"));
          reject(err);
        } else {
          // Success
          console.log(kleur.cyan("Template pushed to Sailthru!"));
          resolve(response);
        }
      });
    });

  }

  async function htmlContentIsTiny(htmlFileContent) {
    return htmlFileContent.length < tinyTemplateThreshold
  }