# Meme Monitor TG Bot

![suibianwanwan-meme-monitor.png](https://www.sam-huang.info/images/suibianwanwan-meme-monitor.png)

fetch data from chain.fm
eg. https://chain.fm/channel/1305381392003109041?eventKinds=token%3Abuy&eventKinds=token%3Asell from ( ![suibianwanwan's X account](https://x.com/bbbaaahhh200) )

set TG related data to .config
### Installation
```sh
npm install node-telegram-bot-api axios
node monitor.js 2>/dev/null
```

### Configuration

fill tg related data to config.json (copy from config-example.json) file
```
{
  "DATA_API": "xxxx", // chain fm API
  "BOT_TOKEN":"xxxx", // get from tg
  "CHAT_ID":"xxxx", // get from tg
  "PER_BUY_LOWER_BOUND": 11.9, // tacking orders that exceed this amount of SOL
  "SEND_TO_TG": true // whether send msg to tg (or only in console)
}
```
### Tracking Scenario

token:buy / token:sell