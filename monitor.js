// Import required packages
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');

// Global configuration constants
const CONFIG = {
    MONITOR_INTERVAL_MS: 3000,
    IGNORED_TRADER_ADDRS: []
};

/**
 * Manages configuration settings and Telegram bot instance
 */
class ConfigManager {
    constructor() {
        this.config = {};
        this.bot = null;
    }

    /**
     * Loads configuration from config.json file
     */
    loadConfig() {
        try {
            const data = JSON.parse(fs.readFileSync('./config.json', { encoding: 'utf8' }));
            const oldConfig = { ...this.config };
            this.config = {
                DATA_API: data.DATA_API,
                BOT_TOKEN: data.BOT_TOKEN,
                CHAT_ID: data.CHAT_ID,
                SEND_TO_TG: data.SEND_TO_TG,
                PER_BUY_LOWER_BOUND: data.PER_BUY_LOWER_BOUND
            };
            if (JSON.stringify(oldConfig) !== JSON.stringify(this.config)) {
                console.log('--- config update ---')
                console.log(JSON.stringify(this.config, null, 4))
            }
            this.bot = new TelegramBot(this.config.BOT_TOKEN, { polling: true });
        } catch (err) {
            console.error('loadConfig fail !', JSON.stringify(err))
        }
    }

    getConfig() {
        return this.config;
    }

    getBot() {
        return this.bot;
    }
}

/**
 * Handles all date formatting operations
 */
class DateFormatter {
    /**
     * Formats a timestamp into a readable date string
     * @param {number} timestamp - Unix timestamp
     * @returns {string} Formatted date string
     */
    static formatTimestamp(timestamp) {
        const date = new Date(timestamp.toString().length === 10 ? timestamp * 1000 : timestamp);
        return date.toLocaleString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).replace(/\//g, '-');
    }

    /**
     * Gets current time in formatted string
     * @returns {string} Current formatted time
     */
    static getCurrentFormattedTime() {
        return this.formatTimestamp(Date.now());
    }
}

/**
 * Handles all transaction processing logic
 */
class TransactionProcessor {
    constructor(configManager) {
        this.configManager = configManager;
        this.trackingPair = {};
        this.latestDataTime = 0;
    }

    /**
     * Processes a single transaction and extracts relevant information
     * @param {Object} transaction - Raw transaction data
     * @param {Object} addressMap - Address mapping data
     * @param {Object} tokenMap - Token mapping data
     * @returns {Object|null} Processed transaction data or null if ignored
     */
    processTransaction(transaction, addressMap, tokenMap) {
        const { events, block_time } = transaction;
        const addr = events[0].address;

        if (CONFIG.IGNORED_TRADER_ADDRS.includes(addr)) {
            return null;
        }

        return {
            who: addressMap[addr],
            whoAddr: addr,
            type: events[0].kind,
            fromEvt: {
                addr: events[0].data.input.token,
                amount: events[0].data.input.uni_amount
            },
            toEvt: {
                addr: events[0].data.output.token,
                amount: events[0].data.output.uni_amount
            },
            time: DateFormatter.formatTimestamp(block_time),
            rawTime: block_time
        };
    }

    /**
     * Processes a buy order and sends notifications if necessary
     * @param {Object} order - Processed order data
     * @param {Object} tokenMap - Token mapping data
     */
    async processBuyOrder(order, tokenMap) {
        const { who, whoAddr, fromEvt, toEvt, time } = order;
        const config = this.configManager.getConfig();
        const bot = this.configManager.getBot();

        if (fromEvt.amount <= config.PER_BUY_LOWER_BOUND) {
            return;
        }

        // Track the buy amount for this user-token pair
        const tkey = `${whoAddr}--${toEvt.addr}`;
        this.trackingPair[tkey] = (this.trackingPair[tkey] ?? 0) + toEvt.amount;

        // Console logging
        console.log(`\x1b[93m${time}\x1b[0m`);
        console.log(`\x1b[93m[buy]\t(${tokenMap[toEvt.addr].symbol}) ${who}  ${fromEvt.amount} ${tokenMap[fromEvt.addr].symbol}\x1b[0m`);
        console.log(`\tbuy ${toEvt.amount} ${tokenMap[toEvt.addr].symbol}`);
        console.log(`\t[${toEvt.addr}]`);
        console.log('');

        // Send Telegram notifications if enabled
        if (config.SEND_TO_TG) {
            try {
                await bot.sendMessage(config.CHAT_ID, `--- ${time} [BUY] ---`);
                await bot.sendMessage(config.CHAT_ID, `[BUY] ${tokenMap[toEvt.addr].symbol} (${who})`);
                await bot.sendMessage(config.CHAT_ID, toEvt.addr);
                await bot.sendMessage(config.CHAT_ID, '\t\t');
            } catch (err) {
                console.error('Telegram notification failed:', err.message);
            }
        }
    }

    /**
     * Processes a sell order and sends notifications if necessary
     * @param {Object} order - Processed order data
     * @param {Object} tokenMap - Token mapping data
     */
    async processSellOrder(order, tokenMap) {
        const { who, whoAddr, fromEvt, time, toEvt } = order;
        const config = this.configManager.getConfig();
        const bot = this.configManager.getBot();

        const tkey = `${whoAddr}--${fromEvt.addr}`;
        this.trackingPair[tkey] = this.trackingPair[tkey] ?? 0;

        if (this.trackingPair[tkey] <= 0) {
            return;
        }

        // Update tracking amount and reset if below threshold
        this.trackingPair[tkey] -= fromEvt.amount;
        if (this.trackingPair[tkey] < 10) {
            this.trackingPair[tkey] = 0;
        }

        // Console logging
        console.log(`\x1b[34m(${time})\x1b[0m`);
        console.log(`\x1b[34m[sell]\t(${tokenMap[fromEvt.addr].symbol}) ${who}  ${fromEvt.amount}\x1b[0m`);
        console.log(`\tgain ${fromEvt.amount} ${tokenMap[toEvt.addr].symbol}`);
        console.log(`\t[${fromEvt.addr}]`);
        console.log('');

        // Send Telegram notifications if enabled
        if (config.SEND_TO_TG) {
            try {
                await bot.sendMessage(config.CHAT_ID, `--- ${time} [SELL] ---`);
                await bot.sendMessage(config.CHAT_ID, `[SELL] ${tokenMap[fromEvt.addr].symbol} (${who})`);
                await bot.sendMessage(config.CHAT_ID, fromEvt.addr);
                await bot.sendMessage(config.CHAT_ID, '\t\t');
            } catch (err) {
                console.error('Telegram notification failed:', err.message);
            }
        }
    }
}

/**
 * Main monitor class that orchestrates the entire monitoring process
 */
class Monitor {
    constructor() {
        this.configManager = new ConfigManager();
        this.transactionProcessor = new TransactionProcessor(this.configManager);
    }

    /**
     * Starts the monitoring process
     */
    async start() {
        // Initialize configuration
        this.configManager.loadConfig();

        // Periodically reload configuration
        setInterval(() => {
            this.configManager.loadConfig();
        }, CONFIG.MONITOR_INTERVAL_MS / 2);

        // Start monitoring
        setInterval(this.monitor.bind(this), CONFIG.MONITOR_INTERVAL_MS);
    }

    /**
     * Main monitoring function that checks for new transactions
     */
    async monitor() {
        try {
            const response = await axios.get(this.configManager.getConfig().DATA_API);
            const data = response.data[0].result.data.json.data;
            const { parsedTransactions, renderContext } = data;
            const { addressLabelMap, tokenSymbolMap } = renderContext;

            // Process each transaction
            for (const transaction of parsedTransactions) {
                if (transaction.block_time <= this.transactionProcessor.latestDataTime) {
                    continue;
                }

                const order = this.transactionProcessor.processTransaction(
                    transaction,
                    addressLabelMap,
                    tokenSymbolMap
                );

                if (!order) continue;

                if (order.type === 'token:buy') {
                    await this.transactionProcessor.processBuyOrder(order, tokenSymbolMap);
                } else if (order.type === 'token:sell') {
                    await this.transactionProcessor.processSellOrder(order, tokenSymbolMap);
                }
            }

            // Update latest monitored time
            if (parsedTransactions.length > 0) {
                this.transactionProcessor.latestDataTime = parsedTransactions[0].block_time;
            }

            // Print timestamp every 5 minutes
            if (parseInt(Date.now() / 1000) % (5 * 60) === 0) {
                console.log(`\x1b[1m${DateFormatter.getCurrentFormattedTime()}\x1b[0m`);
            }
        } catch (error) {
            //console.error('Monitor error:', error.message);
        }
    }
}

// Initialize and start the monitor
const monitor = new Monitor();
monitor.start().catch(console.error);