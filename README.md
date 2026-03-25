## Meta-library search

This is an application which searches for volumes across libraries; right now, it will search across:
- [The Boston Athenaeum](https://catalog.bostonathenaeum.org), and
- [The Boston Public Library](https://www.bpl.org/)

Because the BPL is on bibliocommons, it seems as if it will be trivial to onboard other bilbiocommons requests

Sample entrypoints:

BPL:
https://gateway.bibliocommons.com/v2/libraries/bpl/rss/search?query=%28contributor%3A%28Kerouac%29%20AND%20title%3A%28On%20the%20road%29%20%29&origin=sam-meta-search&searchType=bl

-> to entry: https://gateway.bibliocommons.com/v2/libraries/bpl/bibs/S75C872538/availability?locale=en-US

Athenaeum: https://catalog.bostonathenaeum.org/vwebv/search?searchArg1=On+the+road&argType1=phrase&searchCode1=TKEY&combine2=and&searchArg2=Jack&argType2=phrase&searchCode2=NKEY&combine3=and&searchArg3=&argType3=any&searchCode3=GKEY&year=2025-2026&fromYear=&toYear=&location=all&place=all&type=all&status=all&medium=all&language=all&content=all&media=all&carrier=all&recCount=50&searchType=2&page.search.search.button=Search

Each result attribute will contain:
- Author(s)
- Title
- Description (possibly abridged?)
- Publish date
- Link to library page (for request, etc
- Image URL (if present)
- Hosting library (to start, just BA/BPL)

Then also hopefully:
- location availability
-  
