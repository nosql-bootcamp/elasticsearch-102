# ElasticSearch 102

![elastic-logo](https://static-www.elastic.co/v3/assets/bltefdd0b53724fa2ce/blt6ae3d6980b5fd629/5bbca1d1af3a954c36f95ed3/logo-elastic.svg)

**ElasticSearch 102** est un workshop permettant de découvrir le driver Node.js
pour ElasticSearch.

<a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/"><img alt="Creative Commons Licence" style="border-width:0" src="https://i.creativecommons.org/l/by-nc-sa/4.0/88x31.png" /></a>

<span xmlns:dct="http://purl.org/dc/terms/" property="dct:title">elasticsearch-102</span>
par
<a xmlns:cc="http://creativecommons.org/ns#" href="https://github.com/nosql-bootcamp/elasticsearch-101" property="cc:attributionName" rel="cc:attributionURL">Benjamin
CAVY et Sébastien PRUNIER</a> est distribué sous les termes de la licence
<a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/">Creative
Commons - Attribution - NonCommercial - ShareAlike</a>.

## Pré requis

Nous considérons que vous avez déjà réalisé les workshops suivants :

* [elasticsearch-101](https://github.com/nosql-bootcamp/elasticsearch-101)

Vous allez également avoir besoin de [Node.js](https://nodejs.org). Si ce n'est pas déjà fait, [installez `node` et `npm`](https://nodejs.org/en/download/) sur votre machine.

Vérifiez les versions installées de `node` (minimum `v10.x`) et `npm` (minimum `v6.x`) :

```bash
node -v
v10.16.0
```

```bash
npm -v
6.9.0
```

## Le jeu de données

Le jeu de données utilisé pour le workshop est un ensemble d'actrices et d'acteurs, issus de la base [IMDb](http://www.imdb.com/).

Plus précisément, deux fichiers nous servent de source de données :

* `Top_1000_Actors_and_Actresses.csv` est un fichier CSV contenant le Top 1000
  des actrices et acteurs, depuis lequel nous pourrons extraire le nom de
  l'actrice ou de l'acteur, sa date de naissance et son identifiant IMDb.
* `Top_1000_Actors_and_Actresses.json` est un fichier contenant une fiche
  détaillée au format JSON de chacun des 1000 actrices et acteur. Nous pourrons
  extraire de ce fichier une description, un lien vers une photos et une liste
  de métiers (acteur, réalisateur, producteur, etc...)

Ces deux fichiers sont disponibles dans le dossier `src/data`.

## Driver natif ElasticSearch pour Node.js

Les exemples de code du workshop se basent sur le [driver natif ElasticSearch pour Node.js](https://github.com/elastic/elasticsearch-js).
La version utilisée est la [version 7.5.0](https://www.npmjs.com/package/@elastic/elasticsearch).

L'avantage d'utiliser Node.js et le driver natif est que la syntaxe des requêtes du driver est quasiment identique à celles effectuées dans le shell.

La dépendance au driver elasticsearch est déjà présente dans le fichier `package.json`, ainsi que la dépendance au module `csv-parser` nécessaire pour
la suite :

```json
"dependencies": {
  "@elastic/elasticsearch": "^7.5.0",
  "csv-parser": "^2.3.2"
}
```

## Création des acteurs

L'objectif de cette première partie est d'alimenter un index `imdb` à partir du
fichier CSV `Top_1000_Actors_and_Actresses.csv`.

Pour cela nous nous appuyons sur le module `csv-parser` pour lire le fichier CSV
et sur
[l'api bulk d'elasticsearch](https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-bulk.html),
qui va permettre l'insertion de tous les documents en un seul appel :

```javascript
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
```

Ce code est disponible dans le fichier `src/insert_actors.js`. Vous pouvez
l'exécuter afin d'alimenter une première fois la base :

```bash
cd src

# A ne lancer qu'une seule fois pour récupérer les dépendances
npm install

node insert_actors.js
```

## Mise à jour des acteurs

L'objectif de cette seconde partie est de compléter chaque document de la
collection `actors` à partir des données du fichier
`Top_1000_Actors_and_Actresses.json`.

Pour cela, nous nous appuyons à nouveau sur l'api bulk.

```javascript
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
```

Ce code est disponible dans le fichier `src/update_actors.js`. Vous pouvez
l'exécuter :

```bash
cd src

# A ne lancer qu'une seule fois pour récupérer les dépendances
npm install

node update_actors.js
```

## Requêtes

A vous de jouer pour exécuter quelques requêtes intéressantes sur les données !

Par exemple pour récupérer l'acteur le plus vieux du Top 1000 :

```javascript
client
  .search({
    index: 'imdb',
    body: {
      size: 1,
      sort: [{ birth_date: 'asc' }]
    }
  })
  .then(resp => console.log(resp.body.hits.hits[0]._source.name));
```

Autre exemple pour compter le nombre d'acteurs qui sont aussi des producteurs :

```javascript
client
  .count({
    index: 'imdb',
    body: {
      query: {
        term: {
          occupation: {
            value: 'producer'
          }
        }
      }
    }
  })
  .then(resp => {
    console.log(resp.body.count);
  });
```
