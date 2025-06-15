const express = require('express');
const puppeteer = require('puppeteer');
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.get('/scrape', async (req, res) => {
    const targetURL = req.query.url;

    if (!targetURL) {
        return res.status(400).json({ success: false, message: '❌ Missing "url" parameter' });
    }

    try {
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.goto(targetURL, { waitUntil: 'networkidle2' });

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
                console.log('🚩 No more pages.');
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
                console.warn(`⚠️ No content change after page ${pageIndex}. Ending scrape.`);
                break;
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
            pageIndex++;
        }

        await browser.close();

        const parser = new Parser();
        const csv = parser.parse(allData);

        const filePath = path.join(__dirname, 'scraped_data.csv');
        fs.writeFileSync(filePath, csv);

        res.download(filePath, 'scraped_data.csv', err => {
            if (err) {
                console.error('Error sending file:', err);
                res.status(500).send('Error sending file');
            }
            fs.unlink(filePath, () => {});
        });

    } catch (error) {
        console.error('Scrape error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 CSV API running at http://localhost:${PORT}/scrape?url=YOUR_TARGET_URL`);
});
