# Meme Monitor TG Bot

fetch data from https://chain.fm/channel/1305381392003109041?eventKinds=token%3Abuy&eventKinds=token%3Asell

set TG related data to .config
### Installation
```sh
npm install node-telegram-bot-api axios
node monitor.js
```

### Configuration

fill tg related data to config.json (copy from config-example.json) file
>>> {
>>> "BOT_TOKEN":"xxxx", // get from tg
>>> "CHAT_ID":"xxxx", // get from tg
>>> "PER_BUY_LOWER_BOUND": 11.9, // the minimum spent for buying token
>>> "SEND_TO_TG": true // whether send msg to tg (or only in console)
>>>}

### Tracking Scenario

token:buy / token:sell
