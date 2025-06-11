const fs = require('fs');
const { Parser } = require('json2csv');

const puppeteer = require('puppeteer');

const run = async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto('https://www.lalpathlabs.com/book-a-test/patiala', {
        waitUntil: 'networkidle2'
    });

    await page.waitForSelector('.panel-block');

    let allData = [];
    let pageIndex = 1;
    const maxPages = 100; 

    while (pageIndex <= maxPages) {
        console.log(`📄 Scraping page ${pageIndex}...`);

        const { pageData, firstTitle } = await page.evaluate(() => {
            const panels = document.querySelectorAll('.panel-block');
            const tests = Array.from(panels).map(panel => {
                const title = panel.querySelector('.testName')?.innerText.trim() || null;
                const parameter = panel.querySelector('.parameterText')?.innerText.trim() || null;

                const priceElement = panel.querySelector('.testPrice');
                let originalPrice = null;
                let updatedPrice = null;

                if (priceElement) {
                    const strike = priceElement.querySelector('.strikePrice s');
                    const updated = priceElement.querySelector('.updated-price');

                    if (strike && updated) {
                        originalPrice = strike.textContent.replace(/[^\d]/g, '');
                        updatedPrice = updated.textContent.replace(/[^\d]/g, '');
                    } else {
                        const simplePrice = priceElement.textContent;
                        originalPrice = simplePrice.replace(/[^\d]/g, '');
                        updatedPrice = originalPrice;
                    }
                }

                return {
                    title,
                    parameter,
                    originalPrice: originalPrice ? `₹${originalPrice}` : null,
                    updatedPrice: updatedPrice ? `₹${updatedPrice}` : null
                };
            });

            const firstTitle = tests[0]?.title || null;
            return { pageData: tests, firstTitle };
        });

        allData.push(...pageData);

        const nextPageBtn = await page.$('li.active + li > a[role="button"]');
        if (!nextPageBtn) {
            console.log(' No more pages.');
            break;
        }

        await nextPageBtn.click();

        try {
            await page.waitForFunction(
                prevTitle => {
                    const first = document.querySelector('.panel-block .testName');
                    return first && first.innerText.trim() !== prevTitle;
                },
                { timeout: 10000 }, 
                firstTitle
            );
        } catch (err) {
            console.warn(` No content change after page ${pageIndex}. Ending scrape.`);
            break;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        pageIndex++;
    }

    console.log(` Scraping complete. Total tests: ${allData.length}`);

    // 🔽 Write to CSV
    try {
        const parser = new Parser();
        const csv = parser.parse(allData);
        fs.writeFileSync('test_data.csv', csv);
    } catch (err) {
        console.error(' Error writing CSV:', err);
    }

    await browser.close();
    return allData;
};

run().catch(console.error);
