const puppeteer = require('puppeteer');

const run = async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('https://www.lalpathlabs.com/book-a-test/patiala');
    // collect data from panel block
    const data = await page.evaluate(() => {
        const panels = document.querySelectorAll('.panel-block');
        return Array.from(panels).map(panel => {
            const title = panel.querySelector('.panel-title')?.textContent;
            const description = panel.querySelector('.panel-description')?.textContent;
            return { title, description };
        });
    });
    console.log(data);
    await browser.close();
    return data;
}
run().catch(console.error);
