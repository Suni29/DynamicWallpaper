import puppeteer from 'puppeteer';
import wait from 'wait';
import { execSync } from 'child_process';
import dns from 'dns';
import { readFileSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

let browser;
let page;
let initDone = false;
const __dirname = dirname(fileURLToPath(import.meta.url));

const config = JSON.parse(readFileSync('./config.json', 'utf-8'));

const init = async () => {
  browser = await puppeteer.launch({ headless: true, args: ['--no-first-run', '--no-sandbox', '--no-zygote'] });
  page = await browser.newPage();

  await page.goto('https://web.tabliss.io/', {waitUntil: "domcontentloaded"});

  // Set screen size
  await page.setViewport({width: config.width || 2560, height: config.height || 1080});

  // Add custom style
  await page.addStyleTag({ path: 'custom.css' });

  // Open settings
  let sel = '.Overlay > a:nth-child(1)';
  await page.waitForSelector(sel);
  await page.click('.Overlay > a:nth-child(1)')

  // Set to every 5 minutes
  sel = '.UnsplashSettings > label:nth-child(1) > select:nth-child(2)';
  await page.waitForSelector(sel);
  await page.select('.UnsplashSettings > label:nth-child(1) > select:nth-child(2)', '300')

  // Set topic
  sel = '.UnsplashSettings > label:nth-child(3) > input:nth-child(1)';
  await page.waitForSelector(sel);
  await page.click('.UnsplashSettings > label:nth-child(3) > input:nth-child(1)')

  // Set topic to wallpapers
  sel = '.UnsplashSettings > label:nth-child(6) > select:nth-child(1)';
  await page.waitForSelector(sel);
  await page.select('.UnsplashSettings > label:nth-child(6) > select:nth-child(1)', 'bo8jQKTaE0Y')

  // Open display settings for background
  sel = 'div.Widget:nth-child(3) > p:nth-child(3) > a:nth-child(1)';
  await page.waitForSelector(sel);
  await page.click('div.Widget:nth-child(3) > p:nth-child(3) > a:nth-child(1)')

  // Set Luminosity
  sel = '.image';
  await page.waitForSelector(sel);
  await page.evaluate(() => {
    const selector = '.image';
    const element = document.querySelector(selector);
    element.style.opacity = `0.5`;
  });

  // Delete greeting
  sel = 'fieldset.Widget:nth-child(4) > div:nth-child(1) > button:nth-child(1)';
  await page.waitForSelector(sel);
  await page.click('fieldset.Widget:nth-child(4) > div:nth-child(1) > button:nth-child(1)')

  // Add weather
  sel = '.plane > div:nth-child(3) > label:nth-child(2) > select:nth-child(1)';
  await page.waitForSelector(sel);
  await page.select('.plane > div:nth-child(3) > label:nth-child(2) > select:nth-child(1)', 'widget/weather')

  // Edit weather 
  sel = 'fieldset.Widget:nth-child(4) > div:nth-child(1) > button:nth-child(2)';
  await page.waitForSelector(sel);
  await page.click('fieldset.Widget:nth-child(4) > div:nth-child(1) > button:nth-child(2)')

  // Set location for weather
  sel = '#LocationInput__query';
  await page.waitForSelector(sel);
  await page.type('#LocationInput__query', config.weatherLocation || "Budapest");
  // Submit it
  sel = 'button.button--primary:nth-child(4)';
  await page.waitForSelector(sel);
  await page.click('button.button--primary:nth-child(4)')
  // Set font size
  await page.evaluate(() => {
    const selector = 'div.Widget:nth-child(2)';
    const style = 'font-size: ' + 56 + 'px; font-family: \'Ubuntu\', sans-serif;';
    const element = document.querySelector(selector);
    element.style.cssText += style;
  });

  // Set font size for time
  await page.evaluate(() => {
    const selector = 'div.Widget:nth-child(1)';
    const style = 'font-family: \'Ubuntu\', sans-serif; font-size: ' + 36 + 'px;';
    const element = document.querySelector(selector);
    element.style.cssText += style;
  });
  
  // Edit time
  sel = 'fieldset.Widget:nth-child(3) > div:nth-child(1) > button:nth-child(2)';
  await page.waitForSelector(sel);
  await page.click('fieldset.Widget:nth-child(3) > div:nth-child(1) > button:nth-child(2)')
  // Set 12hr format 
  sel = '.TimeSettings > label:nth-child(4) > input:nth-child(1)';
  await page.waitForSelector(sel);
  await page.click('.TimeSettings > label:nth-child(4) > input:nth-child(1)')

  // Exit settings
  sel = 'a.fullscreen';
  await page.waitForSelector(sel);
  await page.click('a.fullscreen');

  initDone = true;
}

const takeScreenshot = async () => {
  // Wait for image to load
  await wait(1000);

  await page.screenshot({ path: 'screenshot.png' });

  await execSync('gsettings set org.gnome.desktop.background picture-uri-dark file://' + __dirname + '/screenshot.png')
};

async function scheduleAtStartOfMinute() {
  const now = new Date();
  const nextMinute = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes() + 1, 0, 0);
  const delay = nextMinute - now;
  console.log('Next update will be in ' + delay + 'ms.')
  let p;
  try {
    p = await lookupPromise();
  } catch(err) {
    p = false;
  }
  if(!p) { await execSync('gsettings set org.gnome.desktop.background picture-uri-dark file://' + config.offlineWallpaperPath); console.log('Can\'t reach start page, aborting.') }
  setTimeout(async () => {
    if(!initDone && p) await init();
    if(p) takeScreenshot();
    scheduleAtStartOfMinute();
  }, delay);
}

async function lookupPromise() {
  return new Promise((resolve, reject) => {
      dns.lookup("web.tabliss.io", (err, address, family) => {
          if(err) reject(err);
          resolve(true);
      });
 });
};

(async () => {
  try {
    await lookupPromise();
    await init();
  } catch(err) {}
  await scheduleAtStartOfMinute();
})();
