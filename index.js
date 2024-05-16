const { Telegraf } = require('telegraf');
const puppeteer = require('puppeteer');
const antibotbrowser = require('antibotbrowser');
require('dotenv').config();
const bot = new Telegraf(process.env.BOT);

bot.command('screenshot', async (ctx) => {
    const url = 'https://eva.ua/ua/promotion/retail/';

    // Start antibotbrowser
    const antibrowser = await antibotbrowser.startbrowser({ args: ['--no-sandbox'] });

    // Connect to Puppeteer with antibotbrowser
    const browser = await puppeteer.connect({
        browserWSEndpoint: antibrowser.websokcet,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        // Navigate to the website
        await page.goto(url);

        // Take screenshot
        const screenshot = await page.screenshot({ fullPage: false });

        // Send the screenshot to the user
        await ctx.replyWithPhoto({ source: screenshot });

    } catch (error) {
        console.error('Error:', error);
        await ctx.reply('An error occurred while taking the screenshot.');
    } finally {
        // Close the browser
        await browser.close();
    }
});

bot.launch();
