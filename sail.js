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

let source

(async () => {
  const section = await prompts(ask_section);
  console.log(kleur.green(`Section: ${section.value}`));

  const source = await async function() {
    switch (section.value) {
      case 'test':
        response = await prompts(ask_source);
        return response.value
      case 'push':
        return 'local'
      case 'pull':
        return 'pull'
    }
  }()
  console.log(kleur.green(`Source: ${source}`));

  
  console.log(source);
  

  const template = await ask_whichTemplate(source)
      
  console.log(template);
  
})();

async function ask_whichTemplate(source) {
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
      const response_local = await prompts(ask_local);
      return response_local.value
      break
    case 'sailthru':
      const sailthru_templates = await sailthru.apiGet('template', { format: 'json' })
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
      const response_sailthru = await prompts(ask_sailthru);
      return response_sailthru.value
      break
    }
}