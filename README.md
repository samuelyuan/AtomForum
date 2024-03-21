# AtomForum

<div style="display:inline-block;">
<img src="https://raw.githubusercontent.com/samuelyuan/AtomForum/master/screenshots/homepage.png" alt="homepage" width="400" height="250" />
<img src="https://raw.githubusercontent.com/samuelyuan/AtomForum/master/screenshots/summary.png" alt="summary" width="400" height="250" />
</div>

A website that takes entire forum threads and outputs a summary. It was mainly designed for Reddit back in 2016 and no longer works because the website has changed a lot since this project was developed.

1. User enters a URL into the front page or toolbar.
2. Take the content of the submitted URL.
3. Parse and clean up the contents of the entire webpage.
4. For each parent post, summarize post replies and determine sentiment of each reply as positive, neutral, or negative.
5. Display the results page with the summary. For each parent post, display the first sentence and under the parent post, display a summarized reply.

## Getting Started

1. Clone the project

2. Install npm dependencies
```
cd AtomForum
npm install
```

3. Run nodejs
```
npm run start
```

4. Visit localhost:3000 to view the page.
