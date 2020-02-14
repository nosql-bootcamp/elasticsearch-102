const fs = require('fs');
const { Client } = require('@elastic/elasticsearch');

const client = new Client({ node: 'http://localhost:9200' });

fs.readFile(
  './data/Top_1000_Actors_and_Actresses.json',
  'utf8',
  (err, data) => {
    const actorsToUpdate = data
      .split('\n')
      // Chaque ligne correspond à un document JSON décrivant un acteur en détail
      .map(line => JSON.parse(line))
      // On transforme chaque ligne en requête de mise à jour qui sera utilisée dans un 'bulkWrite()'
      .map(actor => actor.data);

    client.bulk(createBulkUpdateQuery(actorsToUpdate), (err, resp) => {
      if (err) console.trace(err.message);
      else console.log(`Updated ${resp.body.items.length} actors`);
      client.close();
    });
  }
);

function createBulkUpdateQuery(actors) {
  const body = actors.reduce((acc, actor) => {
    const {
      description = 'No description provided',
      image,
      occupation
    } = actor;
    acc.push({ update: { _index: 'imdb', _type: '_doc', _id: actor.id } })
    acc.push({
      doc: {
        description: description.replace(
          '                                See full bio &raquo;',
          ''
        ),
        image,
        occupation
      }
    })

    return acc
  }, []);

  return { body };
}
