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

switch (env) {
  case 'debug':
    Sailthru.enableLogging();
    break
  default:
    Sailthru.disableLogging();
    break
}

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
             
        // if not in debug mode, send email
        env != "debug" 
          ? sendEmail(templateObject.name, recipients)
          : console.log(kleur.green(`!!MOCK!! Sent "${templateObject.name}" to ${recipients}`));
           
        break;
      case "pull":
        // adds option to pull all templates in the dev environment
        if(env === "dev") {templateInfo.templateNames.push("ALL TEMPLATES")}

        templateObject = await ask_whichTemplateToSend(templateInfo, 'Which template would you like to pull?')

        if(templateObject.name === "ALL TEMPLATES") {
          let confirmOverwrite = await ask_confirm('WARNING: This will overwrite any existing files in the templates folder of the same name. Continue?')
          shouldWatchFile = await ask_confirm(`Enable file watcher? (push template to SailThru as code updates)`)

          // get all templates
          if(confirmOverwrite){
            templateInfo.templateNames.forEach(templateName => {
              getTemplate(templateName);
            });
          }          
        }
        else{
          shouldWatchFile = await ask_confirm(`Enable file watcher? (push template to SailThru as code updates)`)     
          getTemplate(templateObject.name)     
        }          
        
        if(shouldWatchFile){watchFilesForChanges(templateObject.name)}

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

        // if env is not debug, push the template
        await new Promise(async (resolve, reject) => {
          if(env != 'debug') {
            await pushTemplate(templateObject.name)
            resolve(true)
          }
          else {
            console.log(kleur.green("!!MOCK!! Pushed template to Sailthru"))            
          }
        });
         
        shouldWatchFile = await ask_confirm(`Enable file watcher? (push template to SailThru as code updates)`)
        if(shouldWatchFile){await watchFilesForChanges(templateObject.name)}
        
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

    const fileNames = fileData.map((file) => {
      return file.name;
    });

    return fileNames;
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

      // if env is not debug, push the template
      env != "debug" 
        ? await pushTemplate(templateName) 
        : console.log(kleur.green("!!MOCK!! Pushed template to Sailthru"))
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
    templateJson = templateJson.templates.find(item => item.name == answers.templateName);

    // if the template doesn't exist, just return the name
    if(templateJson == undefined) {
      templateJson = {
        "name": answers.templateName
      }
    }
    
    return templateJson
  }

  function sendEmail(templateName, recipients) {
    Sailthru.multiSend(templateName, recipients, function(err, response) {
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

  async function getTemplate(templateName) {
    await Sailthru.getTemplate(templateName, async function(err, response) {
      if (err) {
        console.log(kleur.red("ERROR:"));
        console.log(err);
      } else {
        let shouldSaveToFile = false
        
        // in dev nd debug, always save to file        
        switch(env) {
          case 'debug':            
            // Success
            console.log(kleur.cyan("Template Info:"));
            console.log(kleur.cyan(`Name: ${response.name}`));
            console.log(kleur.cyan(`Id: ${response.template_id}`));
            console.log(kleur.cyan(`Subject: ${response.subject}`));
            
            shouldSaveToFile = true
          case 'dev':
            shouldSaveToFile = true
            break;
          case 'prod':
            shouldSaveToFile = await ask_confirm('Save file?')
            break;
        }
        
        if (shouldSaveToFile == true) {
          saveFiles(response)
        }        
      }
    });
  }

  function saveFiles(response) {
    
    if(response.content_html && response.name) {
      fs.writeFile(`./templates/${response.name}.html`, response.content_html, function(err) {
        if (err) {
          return console.log(err);
        }
        console.log(kleur.green(`File saved: ./templates/${response.name}.html`));
      });
    }
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

    env == 'debug' ? console.log(kleur.white(`Template preview: ${htmlFileContent.substring(0, 100)}`)) : ''    
   
    let options = {
      content_html: htmlFileContent,
      subject: 'Test Subject Line 123'
    };

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