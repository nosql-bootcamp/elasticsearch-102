const csv = require('csv-parser');
const fs = require('fs');
const { Client } = require('@elastic/elasticsearch');

const client = new Client({ node: 'http://localhost:9200' });

// Création de l'indice
client.indices.create({ index: 'imdb' }, (err, resp) => {
  if (err) console.trace(err.message);
});

let actors = [];
fs
  .createReadStream('./data/Top_1000_Actors_and_Actresses.csv')
  .pipe(csv())
  // Pour chaque ligne on créé un document JSON pour l'acteur correspondant
  .on('data', data => {
    actors.push({
      imdb_id: data.imdb_id,
      name: data.name,
      birth_date: data.birth_date
    });
  })
  // A la fin on créé l'ensemble des acteurs dans ElasticSearch
  .on('end', () => {
    client.bulk(createBulkInsertQuery(actors), (err, resp) => {
      if (err) console.trace(err.message);
      else console.log(`Inserted ${resp.body.items.length} actors`);
      client.close();
    });
  });

// Fonction utilitaire permettant de formatter les données pour l'insertion "bulk" dans elastic
function createBulkInsertQuery(actors) {
  const body = actors.reduce((acc, actor) => {
    const { name, birth_date } = actor;
    acc.push({ index: { _index: 'imdb', _type: '_doc', _id: actor.imdb_id } })
    acc.push({ name, birth_date })
    return acc
  }, []);

  return { body };
}
