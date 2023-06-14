<h1 align="center">Streamline your coding journey with SailAway ⛵</h1>
<h2 align="center">A command line tool for SailThru</h2>

<p>
  <img alt="Version" src="https://img.shields.io/badge/version-1.0.1-blue.svg?cacheSeconds=2592000" />
</p>

> Enables local code development with live code syncing and email shorthands for quick testing.

# Features
SailAway brings development of SailThru templates back to your local coding environment. Gone are the days of manually/downloading uploading code in SailThru or using the online editor. Use all the dev tools you are used to and let SailAway handle syncing the code to SailThru.

## Live Syncing
When code is pushed or pulled you will have the option to sync the code to the SailThru server every time the file is saved. This lets you work on HTML + Zephyr code with all the setup and the tools you are used to without having to manually upload each time.

WARNING: Be VERY careful with this. This will can/will overwrite all local templates, and all templates in the selected environment. Be very careful!

## Bulk Template Download and Upload (WIP)
Download all templates from an environment, or upload an entire folder's worth of emails to another. Bulk upload requires that all from and reply-to email addresses are already set up in the environment.

## Email Shorthands
When sending tests, you can also configure email shorthands instead of typing addresses. To update the shorthands, edit the ```config.js``` file in the root directory. Shorthands and email addresses can be mixed in the recipients list.

```sh
What emails to send to? (separate by comma) » example@gmail.com, me, test, etc
```

### Github Copilot 
If Github Copilot is enabled, working locally is even better. Copilot is able to assist in writing the Zephyr code for SailThru, but has limited success so always check the outputs.

## Install
Download the repo and run the following command in the root directory:

```sh
npm install
```

## Setup
Create a .env file in the root directory with the following variables:
```sh
SAILTHRU_API_KEY=your_api_key
SAILTHRU_API_SECRET=your_api_secret
```

For different SailThru environment, you can create a .env file for each. For example: ```dev.env``` and then in the command line you can specify the environment with ```--env=dev```. 

If no environment is specified, it will use the settings in the ```.env``` file.

## Usage

```sh 
node sail [--env=dev]
```

This will start the CLI and you will be prompted to select an option.

### Send SailThru Test
This will prompt for recipients and a choice from a list of all templates in the SailThru account. It will then send a test to each recipient entered. The recipients can be a comma separated list of emails and shorthands. 

### Pull SailThru Code
This will show a list of all templates in the SailThru account. Select the template you want to pull and it will be saved to the ```/templates``` directory.  

Note: if the template already exists in the ```/templates``` directory, it will be overwritten. 

### Push Local Code
This will show a list of all templates in the ```/templates``` directory. Select the template you want to push and it will be uploaded to the SailThru account. 

If the template already exists in the SailThru account, there will be a prompt to confirm the overwrite of the existing template.

## Author

👤 **Colin Whelan**

* Website: https://colin-whelan.github.io/
* Github: [@Colin-Whelan](https://github.com/Colin-Whelan)
* LinkedIn: [@https:\/\/www.linkedin.com\/in\/colin-whelan\/](https://linkedin.com/in/https:\/\/www.linkedin.com\/in\/colin-whelan\/)

## Show your support

Give a ⭐️ if this project helped you!
