const browser = require('./src/browser/browser');
const scraper = require('./src/browser/scraper');

async function debugScraper() {
    console.log('Launching browser...');
    const { page } = await browser.launch();
    
    console.log('Waiting for chat list...');
    await page.waitForSelector('[data-testid="chat-list"]', { timeout: 15000 }).catch(() => {});
    
    const html = await page.evaluate(() => {
        const row = document.querySelector('[data-testid="cell-frame-container"]');
        if (!row) return 'No row found';
        
        const clone = row.cloneNode(true);
        // Remove massive SVG/img strings to keep output clean
        clone.querySelectorAll('img, svg, path').forEach(n => n.remove());
        return clone.outerHTML;
    });

    console.log('\n--- RAW ROW HTML ---\n');
    console.log(html);
    console.log('\n--------------------\n');

    const chats = await scraper.scrapeChats(page);
    console.log('First chat scraped:\n', JSON.stringify(chats[0], null, 2));

    process.exit(0);
}

debugScraper().catch(console.error);
