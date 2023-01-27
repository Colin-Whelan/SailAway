const fs = require('fs-extra')
const prompts = require('prompts');
const chokidar = require('chokidar');
const kleur = require('kleur');
const dotenv = require('dotenv');

const env = 'dev'

switch (env) {
  case 'prod':
    dotenv.config({ path: './.env.prod' });
    break
  default:
    dotenv.config({ path: './.env.dev' });
}

const SAILTHRU_API_KEY = process.env.SAILTHRU_API_KEY
const SAILTHRU_API_SECRET = process.env.SAILTHRU_API_SECRET
    
const sailthru = require('sailthru-client').createSailthruClient(SAILTHRU_API_KEY, SAILTHRU_API_SECRET);

env == 'debug' ? sailthru.enableLogging() : null


const shorthands = require('./config');
 

const ask_section = [
  {
    type: 'select',
    name: 'value',
    message: 'Pick a section',
    choices: [
      { title: 'Send email test', value: 'test' },
      { title: 'Push local code', value: 'push' },
      { title: 'Pull Sailthru code', value: 'pull' }
    ],
    initial: 0
  }
];

const ask_source = [
  {
    type: 'select',
    name: 'value',
    message: 'Pick a source',
    choices: [
      { title: 'Local', value: 'local' },
      { title: 'Sailthru', value: 'sailthru' }
    ],
    initial: 0
  }
];

(async () => {
  const section = await prompts(ask_section);
  console.log(kleur.green(`Section: ${section.value}`));

  const templateSource = await async function() {
    switch (section.value) {
      case 'push':
        return 'local'
      case 'test':
      case 'pull':
        return 'sailthru'
    }
  }()
  console.log(kleur.green(`Source: ${templateSource}`));
  

  const templateChoice = await async function() {
    return await ask_whichTemplate(templateSource)
  }()
  console.log(kleur.green(`Template: ${templateChoice}`));

  let recipients 

  if(section.value == 'test') {
    await async function() {
      switch (section.value) {
        case 'test':
          const ask_recipients = [
            {
              type: 'text',
              name: 'value',
              message: 'Enter recipients (comma separated)'
            }
          ];
          recipients = await prompts(ask_recipients);
          recipients = recipients.value.split(',').map(recipient => recipient.trim())
          console.log(kleur.green(`Recipients: ${recipients}`));
          break
      }
    }()

    recipients.forEach(async (email, i) => {
        if (email in shorthands) {
          recipients[i] = shorthands[email]
        }
    })
  }


  let options = {};
  let template
  await async function() {
    switch (section.value) {
      case 'test':   
        sailthru.multiSend(templateChoice, recipients, options, function(err, response) {
          if (err) {
            console.log(kleur.red("ERROR:"));        
            console.log(err);
          } else {        
            console.log(kleur.green(`Sent "${templateChoice}" to ${recipients}`));  
            
            // if dev, log the send id
            env == 'dev' ? console.log(kleur.cyan(`Send id: ${response.send_id}`)) : ''
          }
        });         
        break       
      case 'pull':
        template = await new Promise((resolve, reject) => {
          sailthru.getTemplate(templateChoice, (err, response) => {
            if (err) {
              reject(err);
            } else {
              resolve(response);
            }
          });
        });        
        console.log('Pulling template from Sailthru');
        break
      case 'push':        
        template = {
          "name": templateChoice,
          "content_html": await fs.readFile(`./templates/${templateChoice}`, 'utf8')
        }        
        console.log('Pushing template to Sailthru');
        break
    }
  }()  

  // save template to file if pulling
  await async function() {
    if(section.value == 'pull') {
      saveTemplateToFile(template)
    }
  }()


  
})();

function saveTemplateToFile(template) {    
  if(template.content_html && template.name) {
    fs.writeFile(`./templates/${template.name}.html`, template.content_html, function(err) {
      if (err) {
        return console.log(err);
      }
      console.log(kleur.green(`File saved: ./templates/${template.name}.html`));
    });
  }
}

async function ask_whichTemplate(source) {
  let template

  switch (source) {
    case 'local':
      const local_templates = await fs.readdir('./templates')
      const ask_local = [
        {
          type: 'select',
          name: 'value',
          message: 'Pick a template',
          choices: local_templates.map(template => {
            return { title: template, value: template }
          }),
          initial: 0
        }
      ];
      template = await prompts(ask_local);
      return template.value
      break
    case 'sailthru':
      const sailthru_templates = await new Promise((resolve, reject) => {
        sailthru.apiGet('template', { format: 'json' }, (err, response) => {
          if (err) {
            reject(err);
          } else {
            resolve(response);
          }
        });
      });
      
      const ask_sailthru = [
        {
          type: 'select',
          name: 'value',
          message: 'Pick a template',
          choices: sailthru_templates.templates.map(template => {
            return { title: template.name, value: template.name }
          }),
          initial: 0
        }
      ];
      template = await prompts(ask_sailthru);
      return template.value
      break
    }
}