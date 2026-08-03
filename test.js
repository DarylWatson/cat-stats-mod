fetch('https://battlecats.miraheze.org/w/api.php?action=query&format=json&prop=revisions&titles=MediaWiki%3ACustom-CatData.json&rvprop=content&rvslots=main&formatversion=2&origin=*')
  .then(r => r.json()).then(console.log).catch(console.error)
