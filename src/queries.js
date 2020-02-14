const csv = require('csv-parser');
const fs = require('fs');
const { Client } = require('@elastic/elasticsearch');

const client = new Client({ node: 'http://localhost:9200' });

client
  .search({
    index: 'imdb',
    body: {
      size: 1,
      sort: [{ birth_date: 'asc' }]
    }
  })
  .then(resp => console.log(resp.body.hits.hits[0]._source.name));

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

client.close();