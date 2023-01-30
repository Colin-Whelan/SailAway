<h1 align="center">Welcome to SailLaVie 👋</h1>
<p>
  <img alt="Version" src="https://img.shields.io/badge/version-1.0-blue.svg?cacheSeconds=2592000" />
</p>

> Helper functions for SailThru to enable local code development with live syncing and the ability to send tests to several recipients with ease.

# Features

## Live Syncing
When code is pushed or pulled you will have the option to sync the code to the SailThru server every time the file is saved. This lets you work on HTML + Zephyr code with the setup and all the tools you are used to without having to manually upload each time.

### Github Copilot 
If Github Copilot is enabled, this tool is even better. Copilot is able to assist in writing the Zephyr code for SailThru, but has limited success so always check the outputs.

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